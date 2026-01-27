use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type DbSchema = HashMap<String, Vec<String>>;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSchemaCache {
    pub databases: HashMap<String, Vec<String>>,
    pub tables: HashMap<String, Vec<String>>,
    pub schemas: HashMap<String, DbSchema>,
}
