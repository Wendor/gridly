use crate::models::{
    AppSettings, AppStateData, DbConnection, DbConnectionMeta, HistoryItem, TabsState, UiState,
};
use std::fs;
use std::path::PathBuf;


const APP_DIR: &str = ".gridly";
const CONNECTIONS_FILE: &str = "connections.json";
const SETTINGS_FILE: &str = "settings.json";
const STATE_FILE: &str = "state.json";
const HISTORY_FILE: &str = "history.json";

pub struct StorageService {
    config_dir: PathBuf,
}

impl StorageService {
    pub fn new() -> Self {
        let mut config_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        config_dir.push(APP_DIR);

        if let Err(e) = fs::create_dir_all(&config_dir) {
            eprintln!("Failed to create config dir: {}", e);
        }

        StorageService { config_dir }
    }

    fn get_file_path(&self, filename: &str) -> PathBuf {
        self.config_dir.join(filename)
    }

    pub fn get_connections(&self) -> Vec<DbConnection> {
        let path = self.get_file_path(CONNECTIONS_FILE);
        if !path.exists() {
            return Vec::new();
        }

        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    pub fn get_connections_meta(&self) -> Vec<DbConnectionMeta> {
        let connections = self.get_connections();
        connections
            .into_iter()
            .map(|c| DbConnectionMeta {
                id: c.id,
                db_type: c.db_type,
                name: c.name,
                host: c.host,
                port: c.port,
                user: c.user,
                database: c.database,
                exclude_list: c.exclude_list,
                use_ssh: c.use_ssh,
                ssh_host: c.ssh_host,
                ssh_port: c.ssh_port,
                ssh_user: c.ssh_user,
                ssh_key_path: c.ssh_key_path,
            })
            .collect()
    }

    pub fn save_connection(&self, connection: DbConnection) -> Result<(), String> {
        let mut connections = self.get_connections();
        if let Some(pos) = connections.iter().position(|c| c.id == connection.id) {
            // Merge passwords if not provided
            let existing = &connections[pos];
            let mut new_conn = connection;
            if new_conn.password.is_none() {
                new_conn.password = existing.password.clone();
            }
            if new_conn.ssh_password.is_none() {
                new_conn.ssh_password = existing.ssh_password.clone();
            }
            connections[pos] = new_conn;
        } else {
            connections.push(connection);
        }

        self.save_json(CONNECTIONS_FILE, &connections)
    }

    pub fn delete_connection(&self, id: &str) -> Result<(), String> {
        let mut connections = self.get_connections();
        connections.retain(|c| c.id != id);
        self.save_json(CONNECTIONS_FILE, &connections)
    }

    pub fn get_settings(&self) -> AppSettings {
        let path = self.get_file_path(SETTINGS_FILE);
        if !path.exists() {
            return self.default_settings();
        }

        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| self.default_settings()),
            Err(_) => self.default_settings(),
        }
    }

    pub fn save_settings(&self, settings: AppSettings) -> Result<(), String> {
        self.save_json(SETTINGS_FILE, &settings)
    }

    pub fn get_state(&self) -> AppStateData {
        let path = self.get_file_path(STATE_FILE);
        if !path.exists() {
            return self.default_state();
        }

        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| self.default_state()),
            Err(_) => self.default_state(),
        }
    }

    pub fn save_state(&self, state: AppStateData) -> Result<(), String> {
        self.save_json(STATE_FILE, &state)
    }

    pub fn update_state(&self, updates: serde_json::Value) -> Result<(), String> {
        let path = self.get_file_path(STATE_FILE);
        
        // Read current state as JSON Value to allow flexible merging
        let mut current_json: serde_json::Value = if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).unwrap_or_else(|_| serde_json::to_value(self.default_state()).unwrap())
        } else {
            serde_json::to_value(self.default_state()).map_err(|e| e.to_string())?
        };

        // Merge updates
        self.json_merge(&mut current_json, updates);
        
        // Write back
        let content = serde_json::to_string_pretty(&current_json).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())
    }

    fn json_merge(&self, a: &mut serde_json::Value, b: serde_json::Value) {
        match (a, b) {
            (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
                for (k, v) in b {
                    self.json_merge(a.entry(k).or_insert(serde_json::Value::Null), v);
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

    pub fn save_history(&self, history: Vec<HistoryItem>) -> Result<(), String> {
        self.save_json(HISTORY_FILE, &history)
    }

    fn save_json<T: serde::Serialize>(&self, filename: &str, data: &T) -> Result<(), String> {
        let path = self.get_file_path(filename);
        let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())
    }

    fn default_settings(&self) -> AppSettings {
        AppSettings {
            theme: "atom-one-dark".to_string(),
            locale: "en".to_string(),
            font_size: 14,
        }
    }

    fn default_state(&self) -> AppStateData {
        AppStateData {
            tabs: TabsState {
                open_tabs: Vec::new(),
                active_tab_id: None,
                next_tab_id: 1,
            },
            ui: UiState {
                sidebar_width: 250,
                editor_height: 300,
                expanded_connections: Vec::new(),
            },
        }
    }
}
