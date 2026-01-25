use crate::db::DbService;
use crate::models::{
    DashboardMetrics, DataRequest, DbConnection, DbResult, DbSchema, RowUpdate, UpdateResult,
};
use async_trait::async_trait;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgSslMode};
use sqlx::{Column, Pool, Postgres, Row, TypeInfo, Executor};
use std::collections::HashMap;

use std::time::Instant;

pub struct PostgresService {
    pool: Option<Pool<Postgres>>,
    last_config: Option<DbConnection>,
}

impl PostgresService {
    pub fn new() -> Self {
        PostgresService { pool: None, last_config: None }
    }
}

#[async_trait]
impl DbService for PostgresService {
    async fn connect(&mut self, config: &DbConnection) -> Result<String, String> {
        self.last_config = Some(config.clone());

        let mut options = PgConnectOptions::new()
            .host(&config.host)
            .port(config.port.parse().unwrap_or(5432))
            .username(&config.user)
            .database(&config.database)
            .ssl_mode(PgSslMode::Prefer);

        if let Some(password) = &config.password {
            options = options.password(password);
        }

        let pool = PgPoolOptions::new()
            .max_connections(20)
            .connect_with(options)
            .await
            .map_err(|e| e.to_string())?;

        self.pool = Some(pool);
        Ok("Connected to Postgres".to_string())
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
                } else {
                    // fallback via describe
                    if let Ok(desc) = pool.describe(sql).await {
                         for col in desc.columns() {
                             columns.push(col.name().to_string());
                         }
                    }
                }

                for row in rows {
                    let mut row_map = HashMap::new();
                    for col in row.columns() {
                        let name = col.name().to_string();
                        let type_info = col.type_info().name().to_lowercase();
                        
                        let value: serde_json::Value = match type_info.as_str() {
                            "bool" => {
                                let v: Option<bool> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                            "int2" | "int4" | "int8" | "oid" => {
                                let v: Option<i64> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                            "float4" | "float8" | "numeric" | "money" => {
                                let v: Option<f64> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                            "varchar" | "text" | "bpchar" | "name" | "char" => {
                                let v: Option<String> = row.try_get(col.ordinal()).ok();
                                serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
                            }
                            "uuid" => {
                                let v: Option<uuid::Uuid> = row.try_get(col.ordinal()).ok();
                                v.map(|u| serde_json::Value::String(u.to_string())).unwrap_or(serde_json::Value::Null)
                            }
                            "json" | "jsonb" => {
                                let v: Option<serde_json::Value> = row.try_get(col.ordinal()).ok();
                                v.unwrap_or(serde_json::Value::Null)
                            }
                            "timestamp" => {
                                 let v: Option<chrono::NaiveDateTime> = row.try_get(col.ordinal()).ok();
                                 v.map(|t| serde_json::Value::String(t.to_string())).unwrap_or(serde_json::Value::Null)
                            }
                            "timestamptz" => {
                                 let v: Option<chrono::DateTime<chrono::Utc>> = row.try_get(col.ordinal()).ok();
                                 v.map(|t| serde_json::Value::String(t.to_string())).unwrap_or(serde_json::Value::Null)
                            }
                            "date" => {
                                 let v: Option<chrono::NaiveDate> = row.try_get(col.ordinal()).ok();
                                 v.map(|d| serde_json::Value::String(d.to_string())).unwrap_or(serde_json::Value::Null)
                            }
                             "time" => {
                                 let v: Option<chrono::NaiveTime> = row.try_get(col.ordinal()).ok();
                                 v.map(|t| serde_json::Value::String(t.to_string())).unwrap_or(serde_json::Value::Null)
                             }
                             "bytea" => {
                                 let v: Option<Vec<u8>> = row.try_get(col.ordinal()).ok();
                                 v.map(|bytes| serde_json::Value::String(format!("(binary {} bytes)", bytes.len())))
                                  .unwrap_or(serde_json::Value::Null)
                             }
                            _ => {
                                // Default try string
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
        
        // Always query public schema for now, or maybe parameterize later?
        // But since we switched DB, we get tables of that DB.
        let schema = "public";
        
        let sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = $1";
        let rows = sqlx::query(sql)
            .bind(schema)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
        
        let tables: Vec<String> = rows.iter().map(|r| r.get::<String, _>("table_name")).collect();
        Ok(tables)
    }

    async fn get_databases(&self) -> Result<Vec<String>, String> {
         let pool = self.pool.as_ref().ok_or("Not connected")?;
         let sql = "SELECT datname FROM pg_database WHERE datistemplate = false;";
         let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
         let dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>("datname")).collect();
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
        
        let sql = "
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position
        ";
        
        let rows = sqlx::query(sql)
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
        let sql = format!("SELECT * FROM \"{}\" LIMIT {} OFFSET {}", req.table_name, limit, offset);
        self.execute(&sql).await
    }

    async fn set_active_database(&mut self, db_name: String) -> Result<(), String> {
        if let Some(mut config) = self.last_config.clone() {
            if let Some(pool) = &self.pool {
                pool.close().await;
            }
            config.database = db_name;
            self.connect(&config).await.map(|_| ())
        } else {
             Err("No active connection configuration found".to_string())
        }
    }

    async fn get_primary_keys(&mut self, table_name: String) -> Result<Vec<String>, String> {
        let pool = self.pool.as_ref().ok_or("Not connected")?;
        
        let (schema, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.split('.').collect();
            (parts[0], parts[1])
        } else {
            ("public", table_name.as_str())
        };
        
        let full_name = format!("\"{}\".\"{}\"", schema, table);

        let sql = "
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid
                                 AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = $1::regclass
            AND    i.indisprimary
        ";
        
        let rows = sqlx::query(sql)
            .bind(full_name)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
            
        let keys: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
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
                set_parts.push(format!("\"{}\" = {}", k, val_str));
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
                where_parts.push(format!("\"{}\" = {}", k, val_str));
            }
            
            if set_parts.is_empty() { continue; }
            
            let sql = format!(
                "UPDATE \"{}\" SET {} WHERE {}", 
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
         let version: String = sqlx::query("SHOW server_version")
             .fetch_one(pool).await.map_err(|e| e.to_string())?
             .get(0);
             
         // 2. Uptime
         // Cast to text explicitly to ensure string mapping
         let uptime_row = sqlx::query("SELECT (now() - pg_postmaster_start_time())::text")
              .fetch_one(pool).await.map_err(|e| e.to_string())?;
         let uptime: String = uptime_row.get(0);
         
         // 3. Database Size
         let db_name = self.last_config.as_ref().map(|c| c.database.clone()).unwrap_or("postgres".to_string());
         let size_sql = format!("SELECT pg_database_size('{}')", db_name); 
         let size_row = sqlx::query(&size_sql)
              .fetch_one(pool).await.map_err(|e| e.to_string())?;
         let size_bytes: i64 = size_row.get(0);
         
         // 4. Index Size
         // To get TOTAL index size of DB: SELECT sum(pg_indexes_size(oid)) FROM pg_class WHERE relkind = 'r'
         let idx_size_row = sqlx::query("SELECT sum(pg_indexes_size(oid))::bigint FROM pg_class WHERE relkind = 'r'")
              .fetch_one(pool).await.map_err(|e| e.to_string())?;
         let idx_size_bytes = idx_size_row.try_get::<Option<i64>, _>(0).unwrap_or(None).unwrap_or(0);

         // 5. Table Count
         // Optimized: use pg_class instead of slow information_schema
         let table_count: i64 = sqlx::query("SELECT count(*) FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace")
              .fetch_one(pool).await.map_err(|e| e.to_string())?
              .get(0);
              
         // 6. Connections
         let conns: i64 = sqlx::query("SELECT count(*) FROM pg_stat_activity")
              .fetch_one(pool).await.map_err(|e| e.to_string())?
              .get(0);
              
         let max_conns: String = sqlx::query("SHOW max_connections")
              .fetch_one(pool).await.map_err(|e| e.to_string())?
              .get(0);
              
         Ok(DashboardMetrics {
             version,
             uptime,
             active_connections: conns as i32,
             max_connections: max_conns.parse().unwrap_or(100),
             db_size: format!("{:.2} MB", size_bytes as f64 / 1024.0 / 1024.0),
             indexes_size: format!("{:.2} MB", idx_size_bytes as f64 / 1024.0 / 1024.0),
             table_count: table_count as i32,
             cache_hit_ratio: 0.99,
             top_queries: Vec::new(),
         })
    }
}
