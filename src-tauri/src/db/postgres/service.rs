use crate::db::common::{build_select_sql, build_update_sql, QuoteStyle};
use crate::db::traits::DatabaseService;
use crate::error::{DbError, Result};
use crate::models::{
    ConnectionConfig, DashboardMetrics, DataRequest, DbSchema, QueryResult, RowUpdate,
    UpdateResult,
};
use async_trait::async_trait;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgSslMode};
use sqlx::{Column, Executor, Pool, Postgres, Row, TypeInfo};
use std::collections::HashMap;
use std::time::Instant;

pub struct PostgresService {
    pool: Option<Pool<Postgres>>,
    last_config: Option<ConnectionConfig>,
}

impl PostgresService {
    pub fn new() -> Self {
        PostgresService {
            pool: None,
            last_config: None,
        }
    }

    fn pool(&self) -> Result<&Pool<Postgres>> {
        self.pool.as_ref().ok_or(DbError::NotConnected)
    }

    fn map_row(&self, row: &sqlx::postgres::PgRow) -> HashMap<String, serde_json::Value> {
        let mut row_map = HashMap::new();

        for col in row.columns() {
            let name = col.name().to_string();
            let type_info = col.type_info().name().to_lowercase();

            let value: serde_json::Value = match type_info.as_str() {
                "bool" => row
                    .try_get::<Option<bool>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(serde_json::Value::Bool)
                    .unwrap_or(serde_json::Value::Null),
                "int2" => row
                    .try_get::<Option<i16>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|v| serde_json::Value::Number((v as i64).into()))
                    .unwrap_or(serde_json::Value::Null),
                "int4" => row
                    .try_get::<Option<i32>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|v| serde_json::Value::Number((v as i64).into()))
                    .unwrap_or(serde_json::Value::Null),
                "int8" | "oid" => row
                    .try_get::<Option<i64>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|v| serde_json::Value::Number(v.into()))
                    .unwrap_or(serde_json::Value::Null),
                "float4" | "float8" => row
                    .try_get::<Option<f64>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .and_then(serde_json::Number::from_f64)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null),
                "numeric" => {
                    // Try BigDecimal first for precision
                    if let Ok(Some(v)) = row.try_get::<Option<sqlx::types::BigDecimal>, _>(col.ordinal()) {
                         serde_json::Value::String(v.to_string())
                    } else if let Ok(Some(v)) = row.try_get::<Option<String>, _>(col.ordinal()) {
                         serde_json::Value::String(v)
                    } else {
                         row.try_get::<Option<f64>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .and_then(serde_json::Number::from_f64)
                            .map(serde_json::Value::Number)
                            .unwrap_or(serde_json::Value::Null)
                    }
                },
                "money" => {
                     // Try PgMoney (i64 cents)
                     if let Ok(Some(v)) = row.try_get::<Option<sqlx::postgres::types::PgMoney>, _>(col.ordinal()) {
                         // PgMoney(pub i64) - it's cents.
                         // Format as 123.45
                         let val = v.0;
                         let abs_val = val.abs();
                         let dollars = abs_val / 100;
                         let cents = abs_val % 100;
                         let sign = if val < 0 { "-" } else { "" };
                         serde_json::Value::String(format!("{}{}.{:02}", sign, dollars, cents))
                     } else if let Ok(Some(v)) = row.try_get::<Option<i64>, _>(col.ordinal()) {
                         let abs_val = v.abs();
                         let dollars = abs_val / 100;
                         let cents = abs_val % 100;
                         let sign = if v < 0 { "-" } else { "" };
                         serde_json::Value::String(format!("{}{}.{:02}", sign, dollars, cents))
                     } else {
                         // Fallback string/f64
                         row.try_get::<Option<String>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .map(serde_json::Value::String)
                            .unwrap_or(serde_json::Value::Null)
                     }
                },
                "varchar" | "text" | "bpchar" | "name" | "char" | "xml" | "citext" => row
                    .try_get::<Option<String>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null),
                "uuid" => row
                    .try_get::<Option<uuid::Uuid>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|u| serde_json::Value::String(u.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "json" | "jsonb" => row
                    .try_get::<Option<serde_json::Value>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .unwrap_or(serde_json::Value::Null),
                "timestamp" => row
                    .try_get::<Option<chrono::NaiveDateTime>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|t| serde_json::Value::String(t.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "timestamptz" => row
                    .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|t| serde_json::Value::String(t.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "date" => row
                    .try_get::<Option<chrono::NaiveDate>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|d| serde_json::Value::String(d.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "time" => row
                    .try_get::<Option<chrono::NaiveTime>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|t| serde_json::Value::String(t.to_string()))
                    .unwrap_or(serde_json::Value::Null),
                "bytea" => row
                    .try_get::<Option<Vec<u8>>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|bytes| {
                        serde_json::Value::String(format!("(binary {} bytes)", bytes.len()))
                    })
                    .unwrap_or(serde_json::Value::Null),
                // Boolean Array
                "_bool" | "bool[]" => row
                    .try_get::<Option<Vec<bool>>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|v| serde_json::Value::Array(v.into_iter().map(serde_json::Value::Bool).collect()))
                    .unwrap_or(serde_json::Value::Null),
                // Integer Arrays
                "_int2" | "int2[]" => row
                     .try_get::<Option<Vec<i16>>, _>(col.ordinal())
                     .ok()
                     .flatten()
                     .map(|v| serde_json::Value::Array(v.into_iter().map(|n| serde_json::Value::Number((n as i64).into())).collect()))
                     .unwrap_or(serde_json::Value::Null),
                "_int4" | "int4[]" => row
                     .try_get::<Option<Vec<i32>>, _>(col.ordinal())
                     .ok()
                     .flatten()
                     .map(|v| serde_json::Value::Array(v.into_iter().map(|n| serde_json::Value::Number((n as i64).into())).collect()))
                     .unwrap_or(serde_json::Value::Null),
                "_int8" | "int8[]" => row
                     .try_get::<Option<Vec<i64>>, _>(col.ordinal())
                     .ok()
                     .flatten()
                     .map(|v| serde_json::Value::Array(v.into_iter().map(|n| serde_json::Value::Number(n.into())).collect()))
                     .unwrap_or(serde_json::Value::Null),
                 // String Arrays
                "_text" | "_varchar" | "_char" | "_bpchar" | "text[]" | "varchar[]" | "char[]" | "bpchar[]" => row
                     .try_get::<Option<Vec<String>>, _>(col.ordinal())
                     .ok()
                     .flatten()
                     .map(|v| serde_json::Value::Array(v.into_iter().map(serde_json::Value::String).collect()))
                     .unwrap_or(serde_json::Value::Null),
                // Network Types
                "inet" | "cidr" => {
                    if let Ok(Some(v)) = row.try_get::<Option<sqlx::types::ipnetwork::IpNetwork>, _>(col.ordinal()) {
                         serde_json::Value::String(v.to_string())
                    } else {
                         row.try_get::<Option<String>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .map(serde_json::Value::String)
                            .unwrap_or(serde_json::Value::Null)
                    }
                },
                "macaddr" | "macaddr8" => {
                    if let Ok(Some(v)) = row.try_get::<Option<sqlx::types::mac_address::MacAddress>, _>(col.ordinal()) {
                         serde_json::Value::String(v.to_string())
                    } else {
                         row.try_get::<Option<String>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .map(serde_json::Value::String)
                            .unwrap_or(serde_json::Value::Null)
                    }
                },
                // Bit Strings
                "bit" | "varbit" => {
                     // Try sqlx::types::BitVec (requires bit-vec feature)
                     if let Ok(Some(v)) = row.try_get::<Option<sqlx::types::BitVec>, _>(col.ordinal()) {
                         let s: String = v.iter().map(|b| if b { '1' } else { '0' }).collect();
                         serde_json::Value::String(s)
                     } else {
                         // Try as String directly
                        row.try_get::<Option<String>, _>(col.ordinal())
                            .ok()
                            .flatten()
                            .map(serde_json::Value::String)
                            .unwrap_or(serde_json::Value::Null)
                     }
                },
                // Interval
                "interval" => row
                     // sqlx PgInterval
                    .try_get::<Option<sqlx::postgres::types::PgInterval>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(|i| serde_json::Value::String(format!("{} months, {} days, {} us", i.months, i.days, i.microseconds)))
                    .unwrap_or(serde_json::Value::Null),
                // Text Search
                "tsvector" | "tsquery" => row
                    .try_get::<Option<String>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null),
                 // Geometry (fallback to string)
                "point" | "box" | "lseg" | "path" | "polygon" | "circle" | "line" => row
                    .try_get::<Option<String>, _>(col.ordinal())
                    .ok()
                    .flatten()
                    .map(serde_json::Value::String)
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

impl Default for PostgresService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseService for PostgresService {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<String> {
        self.last_config = Some(config.clone());

        let mut options = PgConnectOptions::new()
            .host(&config.host)
            .port(config.port)
            .username(&config.user)
            .database(&config.database)
            .ssl_mode(PgSslMode::Prefer);

        if let Some(password) = &config.password {
            options = options.password(password);
        }

        let pool = PgPoolOptions::new()
            .max_connections(20)
            .connect_with(options)
            .await?;

        self.pool = Some(pool);
        Ok("Connected to Postgres".to_string())
    }

    async fn disconnect(&mut self) -> Result<()> {
        if let Some(pool) = &self.pool {
            pool.close().await;
        }
        self.pool = None;
        Ok(())
    }

    async fn execute(&self, sql: &str) -> Result<QueryResult> {
        let pool = self.pool()?;
        let start = Instant::now();

        let result = sqlx::query(sql).fetch_all(pool).await;
        let duration = start.elapsed().as_secs_f64() * 1000.0;

        match result {
            Ok(rows) => {
                let mut columns = Vec::new();

                if !rows.is_empty() {
                    for col in rows[0].columns() {
                        columns.push(col.name().to_string());
                    }
                } else if let Ok(desc) = pool.describe(sql).await {
                    for col in desc.columns() {
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

        let pool = self.pool()?;
        let sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = $1";
        let rows = sqlx::query(sql)
            .bind("public")
            .fetch_all(pool)
            .await?;

        let tables: Vec<String> = rows.iter().map(|r| r.get::<String, _>("table_name")).collect();
        Ok(tables)
    }

    async fn get_databases(&self) -> Result<Vec<String>> {
        let pool = self.pool()?;
        let sql = "SELECT datname FROM pg_database WHERE datistemplate = false;";
        let rows = sqlx::query(sql).fetch_all(pool).await?;
        let dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>("datname")).collect();
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
        let sql = "
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position
        ";

        let rows = sqlx::query(sql).fetch_all(pool).await?;

        let mut schema: DbSchema = HashMap::new();
        for row in rows {
            let table: String = row.get("table_name");
            let column: String = row.get("column_name");
            schema.entry(table).or_default().push(column);
        }

        Ok(schema)
    }

    async fn get_table_data(&self, req: DataRequest) -> Result<QueryResult> {
        let sql = build_select_sql(&req.table_name, req.limit, req.offset, QuoteStyle::DoubleQuote)?;
        self.execute(&sql).await
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

        let rows = sqlx::query(sql).bind(full_name).fetch_all(pool).await?;

        let keys: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
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
                QuoteStyle::DoubleQuote,
            )?;

            let res = sqlx::query(&sql).execute(pool).await?;
            affected += res.rows_affected();
        }

        Ok(UpdateResult::success(affected))
    }

    async fn get_dashboard_metrics(&self) -> Result<DashboardMetrics> {
        let pool = self.pool()?;

        let version: String = sqlx::query("SHOW server_version")
            .fetch_one(pool)
            .await?
            .get(0);

        let uptime_row =
            sqlx::query("SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint")
                .fetch_one(pool)
                .await?;
        let uptime_seconds: i64 = uptime_row.get(0);

        let db_name = self
            .last_config
            .as_ref()
            .map(|c| c.database.clone())
            .unwrap_or_else(|| "postgres".to_string());
        let size_sql = format!("SELECT pg_database_size('{}')", db_name);
        let size_row = sqlx::query(&size_sql).fetch_one(pool).await?;
        let size_bytes: i64 = size_row.get(0);

        let idx_size_row =
            sqlx::query("SELECT sum(pg_indexes_size(oid))::bigint FROM pg_class WHERE relkind = 'r'")
                .fetch_one(pool)
                .await?;
        let idx_size_bytes = idx_size_row
            .try_get::<Option<i64>, _>(0)
            .unwrap_or(None)
            .unwrap_or(0);

        let table_count: i64 = sqlx::query(
            "SELECT count(*) FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace",
        )
        .fetch_one(pool)
        .await?
        .get(0);

        let conns: i64 = sqlx::query("SELECT count(*) FROM pg_stat_activity")
            .fetch_one(pool)
            .await?
            .get(0);

        let max_conns: String = sqlx::query("SHOW max_connections")
            .fetch_one(pool)
            .await?
            .get(0);

        Ok(DashboardMetrics {
            version,
            uptime: uptime_seconds,
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
