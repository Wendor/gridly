use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub columns: Vec<String>,
    pub error: Option<String>,
    pub duration: f64,
}

impl QueryResult {
    pub fn empty() -> Self {
        QueryResult {
            rows: Vec::new(),
            columns: Vec::new(),
            error: None,
            duration: 0.0,
        }
    }

    pub fn with_error(error: String, duration: f64) -> Self {
        QueryResult {
            rows: Vec::new(),
            columns: Vec::new(),
            error: Some(error),
            duration,
        }
    }
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
    pub sort: String,
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

impl UpdateResult {
    pub fn success(affected_rows: u64) -> Self {
        UpdateResult {
            success: true,
            affected_rows,
            error: None,
        }
    }
}
