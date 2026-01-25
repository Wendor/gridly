use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub locale: String,
    pub font_size: i32,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            theme: "atom-one-dark".to_string(),
            locale: "en".to_string(),
            font_size: 14,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub sql: String,
    pub connection_id: Option<String>,
    pub timestamp: i64,
    pub status: String,
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SerializableTab {
    pub id: i32,
    #[serde(rename = "type")]
    pub tab_type: String,
    pub name: String,
    pub connection_id: Option<String>,
    pub database: Option<String>,
    pub sql: Option<String>,
    pub table_name: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
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

impl Default for TabsState {
    fn default() -> Self {
        TabsState {
            open_tabs: Vec::new(),
            active_tab_id: None,
            next_tab_id: 1,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub sidebar_width: i32,
    pub editor_height: i32,
    pub expanded_connections: Vec<String>,
}

impl Default for UiState {
    fn default() -> Self {
        UiState {
            sidebar_width: 250,
            editor_height: 300,
            expanded_connections: Vec::new(),
        }
    }
}
