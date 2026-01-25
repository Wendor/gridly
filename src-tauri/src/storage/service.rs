use crate::error::Result;
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

pub struct StorageService {
    config_dir: PathBuf,
}

impl StorageService {
    pub fn new() -> Self {
        let mut config_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        config_dir.push(APP_DIR);

        if let Err(e) = fs::create_dir_all(&config_dir) {
            log::error!("Failed to create config dir: {}", e);
        }

        StorageService { config_dir }
    }

    fn get_file_path(&self, filename: &str) -> PathBuf {
        self.config_dir.join(filename)
    }

    pub fn get_connections(&self) -> Vec<ConnectionConfig> {
        let path = self.get_file_path(CONNECTIONS_FILE);
        if !path.exists() {
            return Vec::new();
        }

        match fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    pub fn get_connections_meta(&self) -> Vec<ConnectionSummary> {
        self.get_connections()
            .into_iter()
            .map(ConnectionSummary::from)
            .collect()
    }

    pub fn save_connection(&self, connection: ConnectionConfig) -> Result<()> {
        let mut connections = self.get_connections();
        if let Some(pos) = connections.iter().position(|c| c.id == connection.id) {
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

    pub fn delete_connection(&self, id: &str) -> Result<()> {
        let mut connections = self.get_connections();
        connections.retain(|c| c.id != id);
        self.save_json(CONNECTIONS_FILE, &connections)
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
