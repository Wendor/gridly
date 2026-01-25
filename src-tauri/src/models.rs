use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type DbSchema = HashMap<String, Vec<String>>;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbConnection {
    pub id: String,
    #[serde(rename = "type")]
    pub db_type: String, // 'mysql' | 'postgres'
    pub name: String,
    pub host: String,
    pub port: String,
    pub user: String,
    pub password: Option<String>,
    pub database: String,
    pub exclude_list: Option<String>,
    pub use_ssh: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<String>,
    pub ssh_user: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbConnectionMeta {
    pub id: String,
    #[serde(rename = "type")]
    pub db_type: String,
    pub name: String,
    pub host: String,
    pub port: String,
    pub user: String,
    pub database: String,
    pub exclude_list: Option<String>,
    pub use_ssh: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<String>,
    pub ssh_user: Option<String>,
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub locale: String,
    pub font_size: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub sql: String,
    pub connection_id: Option<String>,
    pub timestamp: i64,
    pub status: String, // 'success' | 'error'
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SerializableTab {
    pub id: i32,
    #[serde(rename = "type")]
    pub tab_type: String,
    pub name: String,
    // Optional fields depending on type
    pub connection_id: Option<String>,
    pub database: Option<String>,
    pub sql: Option<String>,
    pub table_name: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppStateData {
    pub tabs: TabsState,
    pub ui: UiState,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TabsState {
    pub open_tabs: Vec<SerializableTab>,
    pub active_tab_id: Option<i32>,
    pub next_tab_id: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub sidebar_width: i32,
    pub editor_height: i32,
    pub expanded_connections: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbResult {
    pub rows: Vec<HashMap<String, serde_json::Value>>, // Dynamic rows
    pub columns: Vec<String>,
    pub error: Option<String>,
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DataRequest {
    pub table_name: String,
    pub offset: i32,
    pub limit: i32,
    pub sort: Option<Vec<SortItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SortItem {
    pub col_id: String,
    pub sort: String, // 'asc' | 'desc'
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RowUpdate {
    pub table_name: String,
    pub primary_keys: HashMap<String, serde_json::Value>,
    pub changes: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub success: bool,
    pub affected_rows: u64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DashboardMetrics {
    pub version: String,
    pub uptime: i64,
    pub active_connections: i32,
    pub max_connections: i32,
    pub db_size: String,
    pub indexes_size: String,
    pub table_count: i32,
    pub cache_hit_ratio: f64,
    pub top_queries: Vec<TopQuery>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopQuery {
    pub pid: i32,
    pub user: String,
    pub state: String,
    pub duration: String,
    pub query: String,
}
