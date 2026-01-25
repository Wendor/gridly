use crate::db::DbService;
use crate::models::{
    DashboardMetrics, DataRequest, DbConnection, DbResult, DbSchema, RowUpdate, UpdateResult,
};
use async_trait::async_trait;
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};
use sqlx::{Column, MySql, Pool, Row, TypeInfo};
use std::collections::HashMap;
use std::time::Instant;

pub struct MysqlService {
    pool: Option<Pool<MySql>>,
    last_config: Option<DbConnection>,
}

impl MysqlService {
    pub fn new() -> Self {
        MysqlService { pool: None, last_config: None }
    }
}

#[async_trait]
impl DbService for MysqlService {
    async fn connect(&mut self, config: &DbConnection) -> Result<String, String> {
        self.last_config = Some(config.clone());
        
        let mut options = MySqlConnectOptions::new()
            .host(&config.host)
            .port(config.port.parse().unwrap_or(3306))
            .username(&config.user)
            .database(&config.database);

        if let Some(password) = &config.password {
            options = options.password(password);
        }

        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| e.to_string())?;

        self.pool = Some(pool);
        Ok("Connected to MySQL".to_string())
    }

    async fn disconnect(&mut self) -> Result<(), String> {
        if let Some(pool) = &self.pool {
            pool.close().await;
        }
        self.pool = None;
        Ok(())
    }

    async fn execute(&self, sql: &str) -> Result<DbResult, String> {
        let pool = self.pool.as_ref().ok_or("Not connected")?;
        let start = Instant::now();

        let result = sqlx::query(sql).fetch_all(pool).await;
        let duration = start.elapsed().as_secs_f64() * 1000.0;

        match result {
            Ok(rows) => {
                let mut columns = Vec::new();
                let mut data = Vec::new();

                if !rows.is_empty() {
                    let first_row = &rows[0];
                    for col in first_row.columns() {
                        columns.push(col.name().to_string());
                    }
                }

                for row in rows {
                    let mut row_map = HashMap::new();
                    for col in row.columns() {
                        let name = col.name().to_string();
                        let type_info = col.type_info().name();
                        
                         let value: serde_json::Value = match type_info {
                            "TINYINT" | "SMALLINT" | "INT" | "BIGINT" => {
                                let v: Option<i64> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                            "FLOAT" | "DOUBLE" | "DECIMAL" => {
                                let v: Option<f64> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                            "VARCHAR" | "CHAR" | "TEXT" => {
                                let v: Option<String> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                             "DATETIME" | "TIMESTAMP" | "DATE" | "TIME" => {
                                 let v: Option<String> = row.try_get(col.ordinal()).unwrap_or(None);
                                 serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                             }
                            _ => {
                                let v: Option<String> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                        };
                        row_map.insert(name, value);
                    }
                    data.push(row_map);
                }

                Ok(DbResult {
                    rows: data,
                    columns,
                    error: None,
                    duration,
                })
            }
            Err(e) => Ok(DbResult {
                rows: Vec::new(),
                columns: Vec::new(),
                error: Some(e.to_string()),
                duration,
            })
        }
    }

    async fn get_tables(&mut self, db_name: Option<String>) -> Result<Vec<String>, String> {
        if let Some(db) = &db_name {
            let current_db = self.last_config.as_ref().map(|c| c.database.clone()).unwrap_or_default();
            if *db != current_db {
               self.set_active_database(db.clone()).await?;
            }
        }

        let pool = self.pool.as_ref().ok_or("Not connected")?;
        let sql = "SHOW TABLES";
        let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
        
        let tables: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
        Ok(tables)
    }

    async fn get_databases(&self) -> Result<Vec<String>, String> {
         let pool = self.pool.as_ref().ok_or("Not connected")?;
         let sql = "SHOW DATABASES";
         let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
         let dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
         Ok(dbs)
    }

    async fn get_schema(&mut self, db_name: Option<String>) -> Result<DbSchema, String> {
        if let Some(db) = &db_name {
             let current_db = self.last_config.as_ref().map(|c| c.database.clone()).unwrap_or_default();
             if *db != current_db {
                self.set_active_database(db.clone()).await?;
             }
        }
        
        let pool = self.pool.as_ref().ok_or("Not connected")?;
        
        let db_name = self.last_config.as_ref().map(|c| c.database.clone()).unwrap_or_default();
        
        let sql = "
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = ? 
            ORDER BY table_name, ordinal_position
        ";
        
        let rows = sqlx::query(sql)
            .bind(db_name)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
            
        let mut schema: DbSchema = HashMap::new();
        
        for row in rows {
            let table: String = row.get("table_name");
            let column: String = row.get("column_name");
            
            schema.entry(table).or_insert_with(Vec::new).push(column);
        }
        
        Ok(schema)
    }

    async fn get_table_data(&self, req: DataRequest) -> Result<DbResult, String> {
        let offset = req.offset;
        let limit = req.limit;
        let sql = format!("SELECT * FROM {} LIMIT {} OFFSET {}", req.table_name, limit, offset);
        self.execute(&sql).await
    }

    async fn set_active_database(&mut self, db_name: String) -> Result<(), String> {
        if let Some(mut config) = self.last_config.clone() {
            // Close existing pool if exists
            if let Some(pool) = &self.pool {
                pool.close().await;
            }
            // Update config and reconnect
            config.database = db_name;
            self.connect(&config).await.map(|_| ())
        } else {
            Err("No active connection configuration found".to_string())
        }
    }

    async fn get_primary_keys(&mut self, table_name: String) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("Not connected")?;
        // Use SHOW KEYS which is much faster than information_schema joins
        let sql = format!("SHOW KEYS FROM `{}` WHERE Key_name = 'PRIMARY'", table_name);
        
        let rows = sqlx::query(&sql)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
            
        let keys: Vec<String> = rows.iter().map(|r| r.get::<String, _>("Column_name")).collect();
        Ok(keys)
    }
    
    async fn update_rows(&self, updates: Vec<RowUpdate>) -> Result<UpdateResult, String> {
        let pool = self.pool.as_ref().ok_or("Not connected")?;
        let mut affected = 0;
        
        for update in updates {
            let mut set_parts = Vec::new();
            for (k, v) in &update.changes {
                let val_str = match v {
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
                    serde_json::Value::Null => "NULL".to_string(),
                    serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
                    _ => format!("'{}'", v.to_string().replace("'", "''")),
                };
                set_parts.push(format!("`{}` = {}", k, val_str));
            }
            
            let mut where_parts = Vec::new();
            for (k, v) in &update.primary_keys {
                let val_str = match v {
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
                    serde_json::Value::Null => "NULL".to_string(),
                    serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
                    _ => format!("'{}'", v.to_string().replace("'", "''")),
                };
                where_parts.push(format!("`{}` = {}", k, val_str));
            }
            
            if set_parts.is_empty() { continue; }
            
            let sql = format!(
                "UPDATE `{}` SET {} WHERE {}", 
                update.table_name, 
                set_parts.join(", "), 
                where_parts.join(" AND ")
            );
            
            let res = sqlx::query(&sql).execute(pool).await.map_err(|e| e.to_string())?;
            affected += res.rows_affected();
        }
        
        Ok(UpdateResult { success: true, affected_rows: affected, error: None })
    }

    async fn get_dashboard_metrics(&self) -> Result<DashboardMetrics, String> {
         let pool = self.pool.as_ref().ok_or("Not connected")?;
         
         // 1. Version
         let version: String = sqlx::query("SELECT VERSION()")
            .fetch_one(pool).await.map_err(|e| e.to_string())?
            .get(0);
            
         // 2. Uptime
         let uptime_str: String = sqlx::query("SHOW GLOBAL STATUS LIKE 'Uptime'")
             .fetch_one(pool).await.map_err(|e| e.to_string())?
             .get(1); // Value column
         
         let uptime_seconds = uptime_str.parse::<i64>().unwrap_or(0);
         let uptime = uptime_seconds;
             
         // 3. Size
         // Filter by current DB if possible, or all? 
         // config.database is available in self.last_config
         let db_name = self.last_config.as_ref().map(|c| c.database.clone()).unwrap_or_default();
         
         let size_row = sqlx::query("
            SELECT 
                SUM(data_length + index_length) as size_bytes,
                SUM(index_length) as index_size_bytes,
                COUNT(*) as table_count
            FROM information_schema.TABLES 
            WHERE table_schema = ?
         ")
         .bind(&db_name)
         .fetch_one(pool).await.map_err(|e| e.to_string())?;
         
         let db_size_bytes: f64 = size_row.try_get("size_bytes").unwrap_or(0.0);
         let index_size_bytes: f64 = size_row.try_get("index_size_bytes").unwrap_or(0.0);
         let table_count: i64 = size_row.try_get("table_count").unwrap_or(0);
         
         // 4. Active Connections
         let conn_row = sqlx::query("SHOW STATUS LIKE 'Threads_connected'")
             .fetch_one(pool).await.map_err(|e| e.to_string())?;
         let active_conns: String = conn_row.get(1);
         
         // 5. Max Connections
         let max_conn_row = sqlx::query("SHOW VARIABLES LIKE 'max_connections'")
             .fetch_one(pool).await.map_err(|e| e.to_string())?;
         let max_conns: String = max_conn_row.get(1);

         
         Ok(DashboardMetrics {
             version,
             uptime,
             active_connections: active_conns.parse().unwrap_or(0),
             max_connections: max_conns.parse().unwrap_or(100),
             db_size: format!("{:.2} MB", db_size_bytes / 1024.0 / 1024.0),
             indexes_size: format!("{:.2} MB", index_size_bytes / 1024.0 / 1024.0),
             table_count: table_count as i32,
             cache_hit_ratio: 0.0, // Hard to calc simply in MySQL
             top_queries: Vec::new(), // IMPLEMENT later if needed or leave empty
         })
    }
}
