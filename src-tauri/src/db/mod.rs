use crate::models::{
    DataRequest, DashboardMetrics, DbConnection, DbResult, DbSchema, RowUpdate, UpdateResult,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod mysql;
pub mod postgres;
pub mod ssh;

use mysql::MysqlService;
use postgres::PostgresService;
use ssh::SshTunnelService;

#[async_trait]
pub trait DbService: Send + Sync {
    async fn connect(&mut self, config: &DbConnection) -> Result<String, String>;
    async fn disconnect(&mut self) -> Result<(), String>;
    async fn execute(&self, sql: &str) -> Result<DbResult, String>;
    async fn get_tables(&mut self, db_name: Option<String>) -> Result<Vec<String>, String>;
    async fn get_databases(&self) -> Result<Vec<String>, String>;
    async fn get_schema(&mut self, db_name: Option<String>) -> Result<DbSchema, String>;
    async fn get_table_data(&self, req: DataRequest) -> Result<DbResult, String>;
    async fn set_active_database(&mut self, db_name: String) -> Result<(), String>;
    async fn get_primary_keys(&mut self, table_name: String) -> Result<Vec<String>, String>;
    async fn update_rows(&self, updates: Vec<RowUpdate>) -> Result<UpdateResult, String>;
    async fn get_dashboard_metrics(&self) -> Result<DashboardMetrics, String>;
}

#[derive(Clone)]
pub struct DatabaseManager {
    services: Arc<Mutex<HashMap<String, Box<dyn DbService>>>>,
    ssh_services: Arc<Mutex<HashMap<String, SshTunnelService>>>,
}

impl DatabaseManager {
    pub fn new() -> Self {
        DatabaseManager {
            services: Arc::new(Mutex::new(HashMap::new())),
            ssh_services: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(&self, id: String, mut config: DbConnection) -> Result<String, String> {
        // cleanup existing
        self.disconnect(id.clone()).await?;

        // Handle SSH
        if config.use_ssh.unwrap_or(false) && config.ssh_host.is_some() {
            let mut ssh = SshTunnelService::new();
            
            let default_port = if config.db_type == "postgres" { 5432 } else { 3306 };
            let remote_port = config.port.parse().unwrap_or(default_port);
            
            let remote_host = config.host.clone();
            
            let local_port = ssh.create_tunnel(&config, &remote_host, remote_port).await?;
            
            self.ssh_services.lock().await.insert(id.clone(), ssh);
            
            // Override config to point to local tunnel
            config.host = "127.0.0.1".to_string();
            config.port = local_port.to_string();
        }

        let mut service: Box<dyn DbService>;
        
        if config.db_type == "mysql" {
            service = Box::new(MysqlService::new());
        } else {
            service = Box::new(PostgresService::new());
        }
        
        service.connect(&config).await?;
        self.services.lock().await.insert(id, service);
        
        Ok("Connected".to_string())
    }

    pub async fn disconnect(&self, id: String) -> Result<(), String> {
        let mut services = self.services.lock().await;
        if let Some(mut service) = services.remove(&id) {
             let _ = service.disconnect().await; // ignore disconnect error
        }
        
        let mut ssh_services = self.ssh_services.lock().await;
        if let Some(mut ssh) = ssh_services.remove(&id) {
            ssh.close();
        }

        Ok(())
    }
    
    pub async fn execute(&self, id: String, sql: String) -> Result<DbResult, String> {
        let services = self.services.lock().await;
        if let Some(service) = services.get(&id) {
            service.execute(&sql).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    pub async fn get_tables(&self, id: String, db_name: Option<String>) -> Result<Vec<String>, String> {
        let mut services = self.services.lock().await;
        if let Some(service) = services.get_mut(&id) {
            service.get_tables(db_name).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }
    
    pub async fn get_databases(&self, id: String) -> Result<Vec<String>, String> {
        let services = self.services.lock().await;
        if let Some(service) = services.get(&id) {
            service.get_databases().await
        } else {
           Err(format!("Connection {} not found", id))
        }
    }

    pub async fn get_schema(&self, id: String, db_name: Option<String>) -> Result<DbSchema, String> {
        let mut services = self.services.lock().await;
        if let Some(service) = services.get_mut(&id) {
            service.get_schema(db_name).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    pub async fn get_table_data(&self, id: String, req: DataRequest) -> Result<DbResult, String> {
        let services = self.services.lock().await;
        if let Some(service) = services.get(&id) {
            service.get_table_data(req).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    pub async fn set_active_database(&self, id: String, db_name: String) -> Result<(), String> {
        let mut services = self.services.lock().await;
        if let Some(service) = services.get_mut(&id) {
            service.set_active_database(db_name).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    pub async fn get_primary_keys(&self, id: String, table_name: String) -> Result<Vec<String>, String> {
        let mut services = self.services.lock().await;
        if let Some(service) = services.get_mut(&id) {
            service.get_primary_keys(table_name).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    pub async fn update_rows(&self, id: String, updates: Vec<RowUpdate>) -> Result<UpdateResult, String> {
        let services = self.services.lock().await;
        if let Some(service) = services.get(&id) {
            service.update_rows(updates).await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    pub async fn get_dashboard_metrics(&self, id: String) -> Result<DashboardMetrics, String> {
        let services = self.services.lock().await;
        if let Some(service) = services.get(&id) {
            service.get_dashboard_metrics().await
        } else {
            Err(format!("Connection {} not found", id))
        }
    }

    // TODO: Forward other methods similarly
}
