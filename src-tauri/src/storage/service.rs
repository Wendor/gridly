use crate::error::Result;
use super::encryption::EncryptionManager;
use crate::models::{
    AppSettings, AppStateData, ConnectionConfig, ConnectionSummary, HistoryItem,
};
use std::fs;
use std::path::PathBuf;


const APP_DIR: &str = ".gridly";
const CONNECTIONS_FILE: &str = "connections.json";
const SETTINGS_FILE: &str = "settings.json";
const STATE_FILE: &str = "state.json";
const HISTORY_FILE: &str = "history.json";
const SCHEMA_CACHE_FILE: &str = "schema_cache.json";

pub struct StorageService {
    config_dir: PathBuf,
    encryption: std::sync::OnceLock<EncryptionManager>,
}

impl StorageService {
    pub fn new() -> Self {
        let mut config_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        config_dir.push(APP_DIR);
        Self::new_with_path(config_dir)
    }

    pub fn new_with_path(config_dir: PathBuf) -> Self {
        if let Err(e) = fs::create_dir_all(&config_dir) {
            log::error!("Failed to create config dir: {}", e);
        }

        StorageService { 
            config_dir,
            encryption: std::sync::OnceLock::new(),
        }
    }

    fn get_encryption(&self) -> Option<&EncryptionManager> {
        self.encryption.get_or_init(|| {
            match EncryptionManager::new() {
                Ok(mgr) => mgr,
                Err(e) => {
                    log::error!("Failed to initialize encryption manager: {}", e);
                    // This is critical, but we can't easily return error from here in OnceLock.
                    // We might panic or just log.
                    // Ideally we should handle this better, but for now we rely on logging.
                    // However, we can't return None from get_or_init easily if we want to retry.
                    // Actually OnceLock stores the value. 
                    // Let's assume for now we panic if we can't get key, as app can't secure secrets.
                    // Or we handle it by returning None and failing operations.
                    // The closure passed to get_or_init must return the value.
                    // We can't return Option from it if the type is EncryptionManager.
                     panic!("Failed to initialize encryption manager (Master Key access): {}", e);
                }
            }
        });
        self.encryption.get()
    }

    fn get_file_path(&self, filename: &str) -> PathBuf {
        self.config_dir.join(filename)
    }

    // Now returns connections with passwords decrypted (if possible)
    // Also handles on-the-fly migration from legacy keyring
    pub fn get_connections(&self) -> Vec<ConnectionConfig> {
        let path = self.get_file_path(CONNECTIONS_FILE);
        if !path.exists() {
            return Vec::new();
        }

        let mut connections: Vec<ConnectionConfig> = match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        };

        if let Some(mgr) = self.get_encryption() {
            for conn in &mut connections {
                // 1. Try to decrypt password
                if let Some(pwd) = &conn.password {
                    if pwd.starts_with("ENC:") {
                        if let Some(plain) = mgr.decrypt(pwd) {
                            conn.password = Some(plain);
                        } else {
                            log::error!("Failed to decrypt password for {}", conn.id);
                            conn.password = None;
                        }
                    }
                }

                // 2. Try to decrypt SSH password
                if let Some(pwd) = &conn.ssh_password {
                    if pwd.starts_with("ENC:") {
                        if let Some(plain) = mgr.decrypt(pwd) {
                            conn.ssh_password = Some(plain);
                        }
                    }
                }
            }
        }

        connections
    }

    // Helper to save connection list with encryption
    fn save_connections_internal(&self, connections: &[ConnectionConfig]) -> Result<()> {
        let mut to_save = connections.to_vec();
        
        if let Some(mgr) = self.get_encryption() {
            for conn in &mut to_save {
                if let Some(pwd) = &conn.password {
                    if !pwd.is_empty() && !pwd.starts_with("ENC:") {
                        conn.password = Some(mgr.encrypt(pwd));
                    }
                }
                if let Some(pwd) = &conn.ssh_password {
                    if !pwd.is_empty() && !pwd.starts_with("ENC:") {
                        conn.ssh_password = Some(mgr.encrypt(pwd));
                    }
                }
            }
        }

        self.save_json(CONNECTIONS_FILE, &to_save)
    }

    // Since we now have all connections in memory (decrypted) via get_connections(),
    // get_connection is just a filter on that list.
    pub fn get_connection(&self, id: &str) -> Option<ConnectionConfig> {
        self.get_connections().into_iter().find(|c| c.id == id)
    }

    pub fn get_connections_meta(&self) -> Vec<ConnectionSummary> {
        // We can just read from disk and ignore password fields for meta
        // But get_connections() does migration which is good.
        // However, if we just want summary, we don't need passwords.
        let path = self.get_file_path(CONNECTIONS_FILE);
        if !path.exists() {
            return Vec::new();
        }
        let connections: Vec<ConnectionConfig> = match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        };
        
        connections.into_iter().map(ConnectionSummary::from).collect()
    }

    pub fn save_connection(&self, mut connection: ConnectionConfig) -> Result<()> {
        // Handle partial updates where password might be None (preserve existing)
        if connection.password.is_none() || connection.ssh_password.is_none() {
            if let Some(existing) = self.get_connection(&connection.id) {
                if connection.password.is_none() {
                    connection.password = existing.password;
                }
                if connection.ssh_password.is_none() {
                    connection.ssh_password = existing.ssh_password;
                }
            }
        }

        let mut connections = self.get_connections(); // Load existing (decrypted)
        
        if let Some(pos) = connections.iter().position(|c| c.id == connection.id) {
            connections[pos] = connection;
        } else {
            connections.push(connection);
        }

        self.save_connections_internal(&connections)
    }

    pub fn delete_connection(&self, id: &str) -> Result<()> {
        let mut connections = self.get_connections();
        connections.retain(|c| c.id != id);
        self.save_connections_internal(&connections)
    }

    pub fn get_settings(&self) -> AppSettings {
        let path = self.get_file_path(SETTINGS_FILE);
        if !path.exists() {
            return AppSettings::default();
        }

        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => AppSettings::default(),
        }
    }

    pub fn save_settings(&self, settings: AppSettings) -> Result<()> {
        self.save_json(SETTINGS_FILE, &settings)
    }

    pub fn get_state(&self) -> AppStateData {
        let path = self.get_file_path(STATE_FILE);
        if !path.exists() {
            return AppStateData::default();
        }

        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => AppStateData::default(),
        }
    }

    pub fn save_state(&self, state: AppStateData) -> Result<()> {
        self.save_json(STATE_FILE, &state)
    }

    pub fn update_state(&self, updates: serde_json::Value) -> Result<()> {
        let path = self.get_file_path(STATE_FILE);

        let mut current_json: serde_json::Value = if path.exists() {
            let content = fs::read_to_string(&path)?;
            serde_json::from_str(&content)
                .unwrap_or_else(|_| serde_json::to_value(AppStateData::default()).unwrap())
        } else {
            serde_json::to_value(AppStateData::default())?
        };

        Self::json_merge(&mut current_json, updates);

        let content = serde_json::to_string_pretty(&current_json)?;
        fs::write(path, content)?;
        Ok(())
    }

    fn json_merge(a: &mut serde_json::Value, b: serde_json::Value) {
        match (a, b) {
            (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
                for (k, v) in b {
                    Self::json_merge(a.entry(k).or_insert(serde_json::Value::Null), v);
                }
            }
            (a, b) => *a = b,
        }
    }

    pub fn get_history(&self) -> Vec<HistoryItem> {
        let path = self.get_file_path(HISTORY_FILE);
        if !path.exists() {
            return Vec::new();
        }
        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    pub fn save_history(&self, history: Vec<HistoryItem>) -> Result<()> {
        self.save_json(HISTORY_FILE, &history)
    }

    pub fn get_schema_cache(&self) -> crate::models::AppSchemaCache {
        let path = self.get_file_path(SCHEMA_CACHE_FILE);
        if !path.exists() {
            return crate::models::AppSchemaCache::default();
        }
        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => crate::models::AppSchemaCache::default(),
        }
    }

    pub fn save_schema_cache(&self, cache: crate::models::AppSchemaCache) -> Result<()> {
        self.save_json(SCHEMA_CACHE_FILE, &cache)
    }

    fn save_json<T: serde::Serialize>(&self, filename: &str, data: &T) -> Result<()> {
        let path = self.get_file_path(filename);
        let content = serde_json::to_string_pretty(data)?;
        fs::write(path, content)?;
        Ok(())
    }
}

impl Default for StorageService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_storage_settings_persistence() {
        let dir = tempdir().unwrap();
        let service = StorageService::new_with_path(dir.path().to_path_buf());

        let settings = AppSettings {
            theme: "test-theme".to_string(),
            locale: "fr".to_string(),
            font_size: 20,
        };

        let result = service.save_settings(settings.clone());
        assert!(result.is_ok());

        let loaded = service.get_settings();
        assert_eq!(loaded.theme, "test-theme");
        assert_eq!(loaded.locale, "fr");
        assert_eq!(loaded.font_size, 20);
    }

    #[test]
    fn test_storage_connections_persistence() {
        let dir = tempdir().unwrap();
        let service = StorageService::new_with_path(dir.path().to_path_buf());

        let conn = ConnectionConfig {
            id: "conn1".to_string(),
            name: "Test DB".to_string(),
            driver: crate::models::DatabaseDriver::Postgres,
            host: "localhost".to_string(),
            port: 5432,
            user: "admin".to_string(),
            password: Some("secret".to_string()),
            database: "testdb".to_string(),
            exclude_list: None,
            use_ssh: None,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_password: None,
            ssh_key_path: None,
        };

        service.save_connection(conn.clone()).unwrap();

        let connections = service.get_connections();
        assert_eq!(connections.len(), 1);
        assert_eq!(connections[0].id, "conn1");
        assert_eq!(connections[0].name, "Test DB");
        
        // Test update
        let mut updated_conn = conn.clone();
        updated_conn.name = "Renamed DB".to_string();
        service.save_connection(updated_conn).unwrap();
        
        let connections_v2 = service.get_connections();
        assert_eq!(connections_v2.len(), 1);
        assert_eq!(connections_v2[0].name, "Renamed DB");

        // Test delete
        service.delete_connection("conn1").unwrap();
        assert!(service.get_connections().is_empty());
    }
}
