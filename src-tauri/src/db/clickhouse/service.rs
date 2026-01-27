use crate::db::traits::DatabaseService;
use crate::error::{DbError, Result};
use crate::models::{
    ConnectionConfig, DashboardMetrics, DataRequest, DbSchema, QueryResult, RowUpdate,
    UpdateResult,
};
use async_trait::async_trait;
use reqwest::{Client, Url};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ClickHouseResponse {
    meta: Option<Vec<ClickHouseMeta>>,
    data: Option<Vec<HashMap<String, Value>>>,
    rows: Option<u64>,
    statistics: Option<ClickHouseStatistics>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ClickHouseMeta {
    name: String,
    #[serde(rename = "type")]
    type_: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ClickHouseStatistics {
    elapsed: f64,
    rows_read: u64,
    bytes_read: u64,
}

pub struct ClickhouseService {
    client: Option<Client>,
    config: Option<ConnectionConfig>,
}

impl ClickhouseService {
    pub fn new() -> Self {
        ClickhouseService {
            client: None,
            config: None,
        }
    }

    fn get_url(&self, extra_params: &[(&str, &str)]) -> Result<Url> {
        let config = self.config.as_ref().ok_or(DbError::NotConnected)?;
        let host = if config.host == "localhost" {
            "127.0.0.1"
        } else {
            &config.host
        };
        let port = if config.port == 0 { 8123 } else { config.port };
        
        let url_str = format!("http://{}:{}/", host, port);
        
        let mut url = Url::parse(&url_str).map_err(|e| DbError::Config(e.to_string()))?;
        
        {
            let mut pairs = url.query_pairs_mut();
            if !config.database.is_empty() {
                pairs.append_pair("database", &config.database);
            }
            pairs.append_pair("default_format", "JSON");
            pairs.append_pair("output_format_json_quote_64bit_integers", "1");
            pairs.append_pair("output_format_json_quote_denormals", "1");
            
            for (k, v) in extra_params {
                pairs.append_pair(k, v);
            }
        }

        Ok(url)
    }

    async fn send_query(&self, sql: &str) -> Result<ClickHouseResponse> {
        let client = self.client.as_ref().ok_or(DbError::NotConnected)?;
        let config = self.config.as_ref().ok_or(DbError::NotConnected)?;
        
        let url = self.get_url(&[])?;
        
        let mut req = client.post(url).body(sql.to_string());

        if !config.user.is_empty() {
            req = req.header("X-ClickHouse-User", &config.user);
        }
        if let Some(pass) = &config.password {
             req = req.header("X-ClickHouse-Key", pass);
        }

        let res = req.send().await.map_err(|e| DbError::Connection(e.to_string()))?;
        
        if !res.status().is_success() {
             let text = res.text().await.unwrap_or_default();
             return Err(DbError::Query(text));
        }

        let text = res.text().await.map_err(|e| DbError::Connection(e.to_string()))?;
        
        if text.trim().is_empty() {
             return Ok(ClickHouseResponse {
                 meta: None,
                 data: None,
                 rows: Some(0),
                 statistics: None
             });
        }

        // Attempt to parse JSON. If it fails, it might be that the query output is not JSON 
        // (if user overrode FORMAT). In that case we can't do much for grid, 
        // but we should avoid crashing.
        match serde_json::from_str::<ClickHouseResponse>(&text) {
            Ok(r) => Ok(r),
            Err(_) => {
                // If it's valid JSON but not our structure (e.g. strict format) or plain text
                // Return a dummy response with raw text?
                // For now error out
                Err(DbError::Query(format!("Failed to parse response. Ensure query returns JSON compatible format. Response: {}", text)))
            }
        }
    }
}

#[async_trait]
impl DatabaseService for ClickhouseService {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<String> {
        self.config = Some(config.clone());
        self.client = Some(Client::new());
        
        // Test connection
        self.send_query("SELECT 1").await?;
        
        Ok("Connected to ClickHouse".to_string())
    }

    async fn disconnect(&mut self) -> Result<()> {
        self.client = None;
        self.config = None;
        Ok(())
    }

    async fn execute(&self, sql: &str) -> Result<QueryResult> {
        let start = Instant::now();
        match self.send_query(sql).await {
            Ok(response) => {
                let duration = start.elapsed().as_secs_f64() * 1000.0;
                let columns = response.meta.unwrap_or_default()
                    .into_iter()
                    .map(|m| m.name)
                    .collect();
                let rows = response.data.unwrap_or_default();
                
                Ok(QueryResult {
                    rows,
                    columns,
                    error: None,
                    duration,
                })
            }
            Err(e) => {
                let duration = start.elapsed().as_secs_f64() * 1000.0;
                Ok(QueryResult::with_error(e.to_string(), duration))
            }
        }
    }

    async fn get_tables(&mut self, db_name: Option<String>) -> Result<Vec<String>> {
         // If db_name provided, verify it?
         // ClickHouse: SHOW TABLES FROM db
         let sql = if let Some(db) = db_name {
             format!("SHOW TABLES FROM \"{}\"", db)
         } else {
             "SHOW TABLES".to_string()
         };
         
         let result = self.execute(&sql).await?;
         if let Some(_) = result.error {
             return Err(DbError::Query("Failed to get tables".to_string()));
         }
         
         let tables = result.rows.iter()
             .filter_map(|r| r.get("name").or(r.get("name"))) // Column name is usually "name" for SHOW TABLES
             .filter_map(|v| v.as_str().map(|s| s.to_string()))
             .collect();
             
         Ok(tables)
    }

    async fn get_databases(&self) -> Result<Vec<String>> {
        let result = self.execute("SHOW DATABASES").await?;
         if let Some(_) = result.error {
             return Err(DbError::Query("Failed to get databases".to_string()));
         }
         
         let dbs = result.rows.iter()
             .filter_map(|r| r.get("name"))
             .filter_map(|v| v.as_str().map(|s| s.to_string()))
             .collect();
             
         Ok(dbs)
    }

    async fn get_schema(&mut self, db_name: Option<String>) -> Result<DbSchema> {
        let db = db_name.or(self.config.as_ref().map(|c| c.database.clone())).unwrap_or("default".to_string());
        
        let sql = format!(
            "SELECT table, name FROM system.columns WHERE database = '{}' ORDER BY table, position", 
            db
        );
        
        let result = self.execute(&sql).await?;
         if let Some(_) = result.error {
             return Err(DbError::Query("Failed to get schema".to_string()));
         }
         
        let mut schema: DbSchema = HashMap::new();
        for row in result.rows {
            if let (Some(table_val), Some(col_val)) = (row.get("table"), row.get("name")) {
                if let (Some(table), Some(col)) = (table_val.as_str(), col_val.as_str()) {
                    schema.entry(table.to_string()).or_default().push(col.to_string());
                }
            }
        }

        Ok(schema)
    }

    async fn get_table_data(&self, req: DataRequest) -> Result<QueryResult> {
        let order_clause = if let Some(sorts) = req.sort {
            if sorts.is_empty() {
                 "".to_string()
            } else {
                 let parts: Vec<String> = sorts.iter()
                     .map(|s| format!("{} {}", s.col_id, s.sort))
                     .collect();
                 format!("ORDER BY {}", parts.join(", "))
            }
        } else {
            "".to_string()
        };

        let sql = format!(
            "SELECT * FROM \"{}\" {} LIMIT {} OFFSET {}",
            req.table_name,
            order_clause,
            req.limit,
            req.offset
        );
        
        self.execute(&sql).await
    }

    async fn set_active_database(&mut self, db_name: String) -> Result<()> {
        if let Some(config) = self.config.as_mut() {
            config.database = db_name;
            // No persistent connection state to update, next request will use new db param
            Ok(())
        } else {
            Err(DbError::NotConnected)
        }
    }

    async fn get_primary_keys(&mut self, table_name: String) -> Result<Vec<String>> {
        let db = self.config.as_ref().map(|c| c.database.clone()).unwrap_or("default".to_string());
        let sql = format!(
            "SELECT name FROM system.columns WHERE database = '{}' AND table = '{}' AND is_in_primary_key = 1",
            db, table_name
        );
        
        let result = self.execute(&sql).await?;
        let keys = result.rows.iter()
             .filter_map(|r| r.get("name"))
             .filter_map(|v| v.as_str().map(|s| s.to_string()))
             .collect();
             
        Ok(keys)
    }

    async fn update_rows(&self, _updates: Vec<RowUpdate>) -> Result<UpdateResult> {
        // ClickHouse updates are heavy (ALTER TABLE UPDATE). 
        // Implementing generic row update is risky/hard.
        // For now return not supported or implement naive approach?
        // Let's return error saying not supported for now.
        Err(DbError::Query("Updates are not supported for ClickHouse".to_string()))
    }

    async fn get_dashboard_metrics(&self) -> Result<DashboardMetrics> {
        // Run parallel queries or seq
        let version_res = self.execute("SELECT version() as v").await?;
        let version = version_res.rows.first()
            .and_then(|r| r.get("v"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
            
        let uptime_res = self.execute("SELECT uptime() as u").await?;
        let uptime: i64 = uptime_res.rows.first()
            .and_then(|r| r.get("u"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as i64;
            
        // DB Size
        // SELECT sum(bytes) FROM system.parts
        let size_res = self.execute("SELECT formatReadableSize(sum(bytes)) as s FROM system.parts").await?;
        let db_size = size_res.rows.first()
            .and_then(|r| r.get("s"))
            .and_then(|v| v.as_str())
            .unwrap_or("0 B")
            .to_string();
            
        let table_count_res = self.execute("SELECT count() as c FROM system.tables WHERE database != 'system'").await?;
        let table_count = table_count_res.rows.first()
            .and_then(|r| r.get("c"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as i32;

        Ok(DashboardMetrics {
            version,
            uptime,
            active_connections: 0, // ClickHouse HTTP is stateless
            max_connections: 0,
            db_size,
            indexes_size: "N/A".to_string(),
            table_count,
            cache_hit_ratio: 0.0, 
            top_queries: vec![]
        })
    }
}
