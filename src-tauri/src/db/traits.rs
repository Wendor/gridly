use crate::error::Result;
use crate::models::{
    ConnectionConfig, DashboardMetrics, DataRequest, DbSchema, QueryResult, RowUpdate,
    UpdateResult,
};
use async_trait::async_trait;

#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait DatabaseService: Send + Sync {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<String>;
    async fn disconnect(&mut self) -> Result<()>;
    async fn execute(&self, sql: &str, query_id: Option<String>) -> Result<QueryResult>;
    async fn cancel_query(&self, query_id: String) -> Result<()>;
    async fn get_tables(&mut self, db_name: Option<String>) -> Result<Vec<String>>;
    async fn get_databases(&self) -> Result<Vec<String>>;
    async fn get_schema(&mut self, db_name: Option<String>) -> Result<DbSchema>;
    async fn get_table_data(&self, req: DataRequest) -> Result<QueryResult>;
    async fn set_active_database(&mut self, db_name: String) -> Result<()>;
    async fn get_primary_keys(&self, table_name: String) -> Result<Vec<String>>;
    async fn update_rows(&self, updates: Vec<RowUpdate>) -> Result<UpdateResult>;
    async fn get_dashboard_metrics(&self) -> Result<DashboardMetrics>;
}
