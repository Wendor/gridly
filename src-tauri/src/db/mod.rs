pub mod common;
mod mysql;
mod postgres;
pub mod ssh;
mod traits;

pub use mysql::MysqlService;
pub use postgres::PostgresService;
pub use traits::DatabaseService;

use crate::error::{DbError, Result};
use crate::models::{
    ConnectionConfig, DashboardMetrics, DatabaseDriver, DataRequest, DbSchema, QueryResult,
    RowUpdate, UpdateResult,
};
use ssh::SshTunnelService;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;



#[derive(Clone)]
pub struct DatabaseManager {
    services: Arc<Mutex<HashMap<String, Box<dyn DatabaseService>>>>,
    ssh_services: Arc<Mutex<HashMap<String, SshTunnelService>>>,
}

impl DatabaseManager {
    pub fn new() -> Self {
        DatabaseManager {
            services: Arc::new(Mutex::new(HashMap::new())),
            ssh_services: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(&self, id: String, mut config: ConnectionConfig) -> Result<String> {
        self.disconnect(id.clone()).await?;

        if config.use_ssh.unwrap_or(false) && config.ssh_host.is_some() {
            let mut ssh = SshTunnelService::new();


            let remote_port = config.port;
            let remote_host = config.host.clone();

            let local_port = ssh.create_tunnel(&config, &remote_host, remote_port).await?;

            self.ssh_services.lock().await.insert(id.clone(), ssh);

            config.host = "127.0.0.1".to_string();
            config.port = local_port;
        }

        let mut service: Box<dyn DatabaseService> = match config.driver {
            DatabaseDriver::Mysql => Box::new(MysqlService::new()),
            DatabaseDriver::Postgres => Box::new(PostgresService::new()),
        };

        service.connect(&config).await?;
        self.services.lock().await.insert(id, service);

        Ok("Connected".to_string())
    }

    pub async fn disconnect(&self, id: String) -> Result<()> {
        let mut services = self.services.lock().await;
        if let Some(mut service) = services.remove(&id) {
            let _ = service.disconnect().await;
        }

        let mut ssh_services = self.ssh_services.lock().await;
        if let Some(mut ssh) = ssh_services.remove(&id) {
            ssh.close();
        }

        Ok(())
    }

    pub async fn execute(&self, id: String, sql: String) -> Result<QueryResult> {
        let services = self.services.lock().await;
        let service = services.get(&id).ok_or(DbError::ConnectionNotFound(id))?;
        service.execute(&sql).await
    }

    pub async fn get_tables(&self, id: String, db_name: Option<String>) -> Result<Vec<String>> {
        let mut services = self.services.lock().await;
        let service = services
            .get_mut(&id)
            .ok_or(DbError::ConnectionNotFound(id))?;
        service.get_tables(db_name).await
    }

    pub async fn get_databases(&self, id: String) -> Result<Vec<String>> {
        let services = self.services.lock().await;
        let service = services.get(&id).ok_or(DbError::ConnectionNotFound(id))?;
        service.get_databases().await
    }

    pub async fn get_schema(&self, id: String, db_name: Option<String>) -> Result<DbSchema> {
        let mut services = self.services.lock().await;
        let service = services
            .get_mut(&id)
            .ok_or(DbError::ConnectionNotFound(id))?;
        service.get_schema(db_name).await
    }

    pub async fn get_table_data(&self, id: String, req: DataRequest) -> Result<QueryResult> {
        let services = self.services.lock().await;
        let service = services.get(&id).ok_or(DbError::ConnectionNotFound(id))?;
        service.get_table_data(req).await
    }

    pub async fn set_active_database(&self, id: String, db_name: String) -> Result<()> {
        let mut services = self.services.lock().await;
        let service = services
            .get_mut(&id)
            .ok_or(DbError::ConnectionNotFound(id))?;
        service.set_active_database(db_name).await
    }

    pub async fn get_primary_keys(&self, id: String, table_name: String) -> Result<Vec<String>> {
        let mut services = self.services.lock().await;
        let service = services
            .get_mut(&id)
            .ok_or(DbError::ConnectionNotFound(id))?;
        service.get_primary_keys(table_name).await
    }

    pub async fn update_rows(&self, id: String, updates: Vec<RowUpdate>) -> Result<UpdateResult> {
        let services = self.services.lock().await;
        let service = services.get(&id).ok_or(DbError::ConnectionNotFound(id))?;
        service.update_rows(updates).await
    }

    pub async fn get_dashboard_metrics(&self, id: String) -> Result<DashboardMetrics> {
        let services = self.services.lock().await;
        let service = services.get(&id).ok_or(DbError::ConnectionNotFound(id))?;
        service.get_dashboard_metrics().await
    }
}

impl Default for DatabaseManager {
    fn default() -> Self {
        Self::new()
    }
}
