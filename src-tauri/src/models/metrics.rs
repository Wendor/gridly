use serde::{Deserialize, Serialize};

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

pub fn format_uptime(seconds: i64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if days > 0 {
        format!("{}d {:02}:{:02}:{:02}", days, hours, minutes, secs)
    } else {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    }
}
