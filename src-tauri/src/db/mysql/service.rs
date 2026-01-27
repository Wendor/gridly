use crate::db::common::{build_select_sql, build_update_sql, QuoteStyle};
use crate::db::traits::DatabaseService;
use crate::error::{DbError, Result};
use crate::models::{
    ConnectionConfig, DashboardMetrics, DataRequest, DbSchema, QueryResult, RowUpdate,
    UpdateResult,
};
use async_trait::async_trait;
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};
use sqlx::{Column, MySql, Pool, Row, TypeInfo};
use std::collections::HashMap;
use std::time::Instant;

pub struct MysqlService {
    pool: Option<Pool<MySql>>,
    last_config: Option<ConnectionConfig>,
}

impl MysqlService {
    pub fn new() -> Self {
        MysqlService {
            pool: None,
            last_config: None,
        }
    }

    fn pool(&self) -> Result<&Pool<MySql>> {
        self.pool.as_ref().ok_or(DbError::NotConnected)
    }

    fn map_row(&self, row: &sqlx::mysql::MySqlRow) -> HashMap<String, serde_json::Value> {
        let mut row_map = HashMap::new();

        for col in row.columns() {
            let name = col.name().to_string();
            let type_info = col.type_info().name();

            let value: serde_json::Value = match type_info {
                "TINYINT" => {
                    if let Ok(Some(v)) = row.try_get::<Option<i8>, _>(col.ordinal()) {
                         serde_json::Value::Number(v.into())
                    } else if let Ok(Some(v)) = row.try_get::<Option<bool>, _>(col.ordinal()) {
                         serde_json::Value::Bool(v)
                    } else if let Ok(Some(v)) = row.try_get::<Option<i16>, _>(col.ordinal()) {
                         serde_json::Value::Number(v.into())
                    } else {
                         // Last resort, try string
                         row.try_get::<Option<String>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .map(serde_json::Value::String)
                            .unwrap_or(serde_json::Value::Null)
                    }
                },
                "BOOLEAN" => {
                     if let Ok(Some(v)) = row.try_get::<Option<bool>, _>(col.ordinal()) {
                         serde_json::Value::Bool(v)
                     } else if let Ok(Some(v)) = row.try_get::<Option<i8>, _>(col.ordinal()) {
                         serde_json::Value::Number(v.into())
                     } else {
                         serde_json::Value::Null
                     }
                },
                "SMALLINT" | "INT" | "BIGINT" | "YEAR" => row
                    .try_get::<Option<i64>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|v| serde_json::Value::Number(v.into()))
                    .unwrap_or(serde_json::Value::Null),
                "FLOAT" | "DOUBLE" | "DECIMAL" => {
                    // Start with BigDecimal for precision (DECIMAL usually maps to this)
                    if let Ok(Some(v)) = row.try_get::<Option<sqlx::types::BigDecimal>, _>(col.ordinal()) {
                         serde_json::Value::String(v.to_string())
                    } else if let Ok(Some(v)) = row.try_get::<Option<f64>, _>(col.ordinal()) {
                         serde_json::Number::from_f64(v)
                            .map(serde_json::Value::Number)
                            .unwrap_or(serde_json::Value::Null)
                    } else {
                         // Fallback string
                         row.try_get::<Option<String>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .map(serde_json::Value::String)
                            .unwrap_or(serde_json::Value::Null)
                    }
                },
                "VARCHAR" | "CHAR" | "TEXT" | "ENUM" | "SET" => row
                    .try_get::<Option<String>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null),
                "JSON" => row
                    .try_get::<Option<serde_json::Value>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .unwrap_or(serde_json::Value::Null),
                "DATETIME" | "TIMESTAMP" => row
                    .try_get::<Option<chrono::NaiveDateTime>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|t| serde_json::Value::String(t.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "DATE" => row
                    .try_get::<Option<chrono::NaiveDate>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|d| serde_json::Value::String(d.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "TIME" => row
                    .try_get::<Option<chrono::NaiveTime>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|t| serde_json::Value::String(t.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "BINARY" | "VARBINARY" | "TINYBLOB" | "BLOB" | "MEDIUMBLOB" | "LONGBLOB" => row
                    .try_get::<Option<Vec<u8>>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|bytes| {
                        serde_json::Value::String(format!("(binary {} bytes)", bytes.len()))
                    })
                    .unwrap_or(serde_json::Value::Null),
                "BIT" => row
                    .try_get::<Option<u64>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|v| serde_json::Value::Number(v.into()))
                    .unwrap_or(serde_json::Value::Null),
                _ => row
                    .try_get::<Option<String>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null),
            };
            row_map.insert(name, value);
        }

        row_map
    }
}

impl Default for MysqlService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseService for MysqlService {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<String> {
        self.last_config = Some(config.clone());

        let mut options = MySqlConnectOptions::new()
            .host(&config.host)
            .port(config.port)
            .username(&config.user)
            .database(&config.database);

        if let Some(password) = &config.password {
            options = options.password(password);
        }

        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        self.pool = Some(pool);
        Ok("Connected to MySQL".to_string())
    }

    async fn disconnect(&mut self) -> Result<()> {
        if let Some(pool) = &self.pool {
            pool.close().await;
        }
        self.pool = None;
        Ok(())
    }

    async fn execute(&self, sql: &str, query_id: Option<String>) -> Result<QueryResult> {
        let pool = self.pool()?;
        let start = Instant::now();

        let final_sql = if let Some(qid) = query_id {
            format!("/* query_id: {} */ {}", qid, sql)
        } else {
            sql.to_string()
        };

        let result = sqlx::query(&final_sql).fetch_all(pool).await;
        let duration = start.elapsed().as_secs_f64() * 1000.0;

        match result {
            Ok(rows) => {
                let mut columns = Vec::new();

                if !rows.is_empty() {
                    for col in rows[0].columns() {
                        columns.push(col.name().to_string());
                    }
                }

                let data: Vec<_> = rows.iter().map(|row| self.map_row(row)).collect();

                Ok(QueryResult {
                    rows: data,
                    columns,
                    error: None,
                    duration,
                })
            }
            Err(e) => Ok(QueryResult::with_error(e.to_string(), duration)),
        }
    }

    async fn cancel_query(&self, query_id: String) -> Result<()> {
        let pool = self.pool()?;
        let search_str = format!("/* query_id: {} */", query_id);
        
        let rows = sqlx::query("SELECT ID FROM information_schema.PROCESSLIST WHERE INFO LIKE ?")
            .bind(format!("%{}%", search_str))
            .fetch_all(pool)
            .await?;

        for row in rows {
            let id: u64 = row.get("ID");
            // KILL QUERY id
            let _ = sqlx::query(&format!("KILL QUERY {}", id))
                .execute(pool)
                .await;
        }

        Ok(())
    }

    async fn get_tables(&mut self, db_name: Option<String>) -> Result<Vec<String>> {
        if let Some(db) = &db_name {
            let current_db = self
                .last_config
                .as_ref()
                .map(|c| c.database.clone())
                .unwrap_or_default();
            if *db != current_db {
                self.set_active_database(db.clone()).await?;
            }
        }

        let current_db = self
            .last_config
            .as_ref()
            .map(|c| c.database.clone())
            .unwrap_or_default();

        let pool = self.pool()?;
        let rows = sqlx::query("SELECT CAST(table_name AS CHAR) FROM information_schema.tables WHERE table_schema = ?")
            .bind(current_db)
            .fetch_all(pool)
            .await?;

        let tables: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
        Ok(tables)
    }

    async fn get_databases(&self) -> Result<Vec<String>> {
        let pool = self.pool()?;
        let rows = sqlx::query("SELECT CAST(schema_name AS CHAR) FROM information_schema.schemata")
            .fetch_all(pool)
            .await?;
        let dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
        Ok(dbs)
    }

    async fn get_schema(&mut self, db_name: Option<String>) -> Result<DbSchema> {
        if let Some(db) = &db_name {
            let current_db = self
                .last_config
                .as_ref()
                .map(|c| c.database.clone())
                .unwrap_or_default();
            if *db != current_db {
                self.set_active_database(db.clone()).await?;
            }
        }

        let pool = self.pool()?;
        let db_name = self
            .last_config
            .as_ref()
            .map(|c| c.database.clone())
            .unwrap_or_default();

        let sql = "
            SELECT 
                CAST(table_name AS CHAR) as table_name, 
                CAST(column_name AS CHAR) as column_name 
            FROM information_schema.columns 
            WHERE table_schema = ? 
            ORDER BY table_name, ordinal_position
        ";

        let rows = sqlx::query(sql).bind(db_name).fetch_all(pool).await?;

        let mut schema: DbSchema = HashMap::new();
        for row in rows {
            let table: String = row.get("table_name");
            let column: String = row.get("column_name");
            schema.entry(table).or_default().push(column);
        }

        Ok(schema)
    }

    async fn get_table_data(&self, req: DataRequest) -> Result<QueryResult> {
        let sql = build_select_sql(&req.table_name, req.limit, req.offset, QuoteStyle::Backtick)?;
        self.execute(&sql, None).await
    }

    async fn set_active_database(&mut self, db_name: String) -> Result<()> {
        if let Some(mut config) = self.last_config.clone() {
            if let Some(pool) = &self.pool {
                pool.close().await;
            }
            config.database = db_name;
            self.connect(&config).await.map(|_| ())
        } else {
            Err(DbError::Config(
                "No active connection configuration found".to_string(),
            ))
        }
    }

    async fn get_primary_keys(&self, table_name: String) -> Result<Vec<String>> {
        let pool = self.pool()?;
        let sql = format!(
            "SHOW KEYS FROM `{}` WHERE Key_name = 'PRIMARY'",
            table_name.replace('`', "``")
        );

        let rows = sqlx::query(&sql).fetch_all(pool).await?;

        let keys: Vec<String> = rows.iter().map(|r| r.get::<String, _>("Column_name")).collect();
        Ok(keys)
    }

    async fn update_rows(&self, updates: Vec<RowUpdate>) -> Result<UpdateResult> {
        let pool = self.pool()?;
        let mut affected = 0;

        for update in updates {
            if update.changes.is_empty() {
                continue;
            }

            let sql = build_update_sql(
                &update.table_name,
                &update.changes,
                &update.primary_keys,
                QuoteStyle::Backtick,
            )?;

            let res = sqlx::query(&sql).execute(pool).await?;
            affected += res.rows_affected();
        }

        Ok(UpdateResult::success(affected))
    }

    async fn get_dashboard_metrics(&self) -> Result<DashboardMetrics> {
        let pool = self.pool()?;

        let version: String = sqlx::query("SELECT VERSION()")
            .fetch_one(pool)
            .await?
            .get(0);

        let uptime_str: String = sqlx::query("SHOW GLOBAL STATUS LIKE 'Uptime'")
            .fetch_one(pool)
            .await?
            .get(1);
        let uptime_seconds = uptime_str.parse::<i64>().unwrap_or(0);

        let db_name = self
            .last_config
            .as_ref()
            .map(|c| c.database.clone())
            .unwrap_or_default();

        let size_row = sqlx::query(
            "
            SELECT 
                SUM(data_length + index_length) as size_bytes,
                SUM(index_length) as index_size_bytes,
                COUNT(*) as table_count
            FROM information_schema.TABLES 
            WHERE table_schema = ?
        ",
        )
        .bind(&db_name)
        .fetch_one(pool)
        .await?;

        let db_size_bytes: f64 = size_row.try_get("size_bytes").unwrap_or(0.0);
        let index_size_bytes: f64 = size_row.try_get("index_size_bytes").unwrap_or(0.0);
        let table_count: i64 = size_row.try_get("table_count").unwrap_or(0);

        let conn_row = sqlx::query("SHOW STATUS LIKE 'Threads_connected'")
            .fetch_one(pool)
            .await?;
        let active_conns: String = conn_row.get(1);

        let max_conn_row = sqlx::query("SHOW VARIABLES LIKE 'max_connections'")
            .fetch_one(pool)
            .await?;
        let max_conns: String = max_conn_row.get(1);

        Ok(DashboardMetrics {
            version,
            uptime: uptime_seconds,
            active_connections: active_conns.parse().unwrap_or(0),
            max_connections: max_conns.parse().unwrap_or(100),
            db_size: format!("{:.2} MB", db_size_bytes / 1024.0 / 1024.0),
            indexes_size: format!("{:.2} MB", index_size_bytes / 1024.0 / 1024.0),
            table_count: table_count as i32,
            cache_hit_ratio: 0.0,
            top_queries: Vec::new(),
        })
    }
}
