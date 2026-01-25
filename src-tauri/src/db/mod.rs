pub mod common;
mod mysql;
mod clickhouse;
mod postgres;
pub mod ssh;
mod traits;

pub use mysql::MysqlService;
pub use clickhouse::ClickhouseService;
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




#[cfg_attr(test, mockall::automock)]
pub trait DatabaseServiceFactory: Send + Sync {
    fn create(&self, driver: &DatabaseDriver) -> Box<dyn DatabaseService>;
}

pub struct DefaultDatabaseServiceFactory;

impl DatabaseServiceFactory for DefaultDatabaseServiceFactory {
    fn create(&self, driver: &DatabaseDriver) -> Box<dyn DatabaseService> {
        match driver {
            DatabaseDriver::Mysql => Box::new(MysqlService::new()),

            DatabaseDriver::Postgres => Box::new(PostgresService::new()),
            DatabaseDriver::Clickhouse => Box::new(ClickhouseService::new()),
        }
    }
}

#[derive(Clone)]
pub struct DatabaseManager {
    services: Arc<Mutex<HashMap<String, Box<dyn DatabaseService>>>>,
    ssh_services: Arc<Mutex<HashMap<String, SshTunnelService>>>,
    // Arc<Box<...>> needed because DatabaseManager is specific to be Clone + Send + Sync
    // But Box<dyn IsNotClone>. We need to share the factory.
    // DatabaseManager is Clone, so fields must be Clone.
    // Box<dyn Trait> is not Clone. Arc<Box<dyn Trait>> is Clone.
    factory: Arc<Box<dyn DatabaseServiceFactory>>,
}

impl DatabaseManager {
    pub fn new() -> Self {
        Self::new_with_factory(Box::new(DefaultDatabaseServiceFactory))
    }

    pub fn new_with_factory(factory: Box<dyn DatabaseServiceFactory>) -> Self {
        DatabaseManager {
            services: Arc::new(Mutex::new(HashMap::new())),
            ssh_services: Arc::new(Mutex::new(HashMap::new())),
            factory: Arc::new(factory),
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

        let mut service = self.factory.create(&config.driver);

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




#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::traits::MockDatabaseService;

    #[tokio::test]
    async fn test_connect_success() {
        let mut mock_factory = MockDatabaseServiceFactory::new();
        let mut mock_service = MockDatabaseService::new();

        mock_service.expect_connect()
            .times(1)
            .returning(|_| Ok("Connected".to_string()));

        mock_factory.expect_create()
            .times(1)
            .return_once(move |_| Box::new(mock_service));

        let manager = DatabaseManager::new_with_factory(Box::new(mock_factory));
        let config = ConnectionConfig {
            id: "conn1".to_string(),
            name: "Test Connection".to_string(),
            driver: DatabaseDriver::Postgres,
            host: "localhost".to_string(),
            port: 5432,
            user: "user".to_string(),
            password: Some("pass".to_string()),
            database: "db".to_string(),
            exclude_list: None,
            use_ssh: Some(false),
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_password: None,
            ssh_key_path: None,
        };

        let result = manager.connect("conn1".to_string(), config).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Connected");
    }

    #[tokio::test]
    async fn test_disconnect() {
        let mut mock_factory = MockDatabaseServiceFactory::new();
        let mut mock_service = MockDatabaseService::new();

        mock_service.expect_connect()
            .returning(|_| Ok("Connected".to_string()));
        mock_service.expect_disconnect()
            .times(1)
            .returning(|| Ok(()));

        mock_factory.expect_create()
            .return_once(move |_| Box::new(mock_service));

        let manager = DatabaseManager::new_with_factory(Box::new(mock_factory));
        let config = ConnectionConfig {
            id: "conn1".to_string(),
            name: "Test Connection".to_string(),
            driver: DatabaseDriver::Postgres,
            host: "localhost".to_string(),
            port: 5432,
            user: "user".to_string(),
            password: Some("pass".to_string()),
            database: "db".to_string(),
            exclude_list: None,
            use_ssh: None,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_password: None,
            ssh_key_path: None,
        };

        let _ = manager.connect("conn1".to_string(), config).await;
        let result = manager.disconnect("conn1".to_string()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_execute_query() {
        let mut mock_factory = MockDatabaseServiceFactory::new();
        let mut mock_service = MockDatabaseService::new();

        mock_service.expect_connect()
            .returning(|_| Ok("Connected".to_string()));
        
        mock_service.expect_execute()
            .with(mockall::predicate::eq("SELECT 1"))
            .times(1)
            .returning(|_| Ok(QueryResult {
                rows: vec![],
                columns: vec![],
                error: None,
                duration: 0.0,
            }));

        mock_factory.expect_create()
            .return_once(move |_| Box::new(mock_service));

        let manager = DatabaseManager::new_with_factory(Box::new(mock_factory));
        let config = ConnectionConfig {
            id: "conn1".to_string(),
            name: "Test Connection".to_string(),
            driver: DatabaseDriver::Mysql, // Test different driver
            host: "localhost".to_string(),
            port: 3306,
            user: "user".to_string(),
            password: None,
            database: "".to_string(),
            exclude_list: None,
            use_ssh: None,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_password: None,
            ssh_key_path: None,
        };

        let _ = manager.connect("conn1".to_string(), config).await;
        let result = manager.execute("conn1".to_string(), "SELECT 1".to_string()).await;
        assert!(result.is_ok());
    }
}
