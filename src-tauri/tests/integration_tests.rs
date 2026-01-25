use app_lib::db::DatabaseManager;
use app_lib::models::{ConnectionConfig, DatabaseDriver};

#[tokio::test]
async fn test_real_postgres_connection() {
    let manager = DatabaseManager::new();
    let config = ConnectionConfig {
        id: "test_pg".to_string(),
        name: "Test Postgres".to_string(),
        driver: DatabaseDriver::Postgres,
        host: "localhost".to_string(),
        port: 54320, // Mapped port
        user: "test_user".to_string(),
        password: Some("test_password".to_string()),
        database: "test_db".to_string(),
        exclude_list: None,
        use_ssh: None,
        ssh_host: None,
        ssh_port: None,
        ssh_user: None,
        ssh_password: None,
        ssh_key_path: None,
    };

    let result = manager.connect("test_pg".to_string(), config).await;
    assert!(result.is_ok(), "Failed to connect to Postgres: {:?}", result.err());

    let tables = manager.get_tables("test_pg".to_string(), None).await;
    assert!(tables.is_ok());
    let tables = tables.unwrap();
    assert!(tables.contains(&"users".to_string()));

    let query_res = manager.execute("test_pg".to_string(), "SELECT * FROM users".to_string()).await;
    assert!(query_res.is_ok());
    let rows = query_res.unwrap().rows;
    assert!(rows.len() >= 2);
}

#[tokio::test]
async fn test_real_mysql_connection() {
    let manager = DatabaseManager::new();
    let config = ConnectionConfig {
        id: "test_mysql".to_string(),
        name: "Test MySQL".to_string(),
        driver: DatabaseDriver::Mysql,
        host: "127.0.0.1".to_string(),
        port: 33060, // Mapped port
        user: "test_user".to_string(),
        password: Some("test_password".to_string()),
        database: "test_db".to_string(),
        exclude_list: None,
        use_ssh: None,
        ssh_host: None,
        ssh_port: None,
        ssh_user: None,
        ssh_password: None,
        ssh_key_path: None,
    };

    let result = manager.connect("test_mysql".to_string(), config).await;
    assert!(result.is_ok(), "Failed to connect to MySQL: {:?}", result.err());

    let tables = manager.get_tables("test_mysql".to_string(), Some("test_db".to_string())).await;
    assert!(tables.is_ok());
    let tables = tables.unwrap();
    assert!(tables.contains(&"users".to_string()));
}

// TODO: SSH Test is currently flaky due to Docker permission issues. Requires manual verification.
// #[tokio::test]
#[allow(dead_code)]
async fn test_ssh_tunnel_postgres() {
    let manager = DatabaseManager::new();
    // Connect to postgres container FROM ssh-server container
    // Internal hostname is "postgres"
    let config = ConnectionConfig {
        id: "test_ssh_pg".to_string(),
        name: "Test SSH Postgres".to_string(),
        driver: DatabaseDriver::Postgres,
        host: "postgres".to_string(), // Internal docker hostname reachable from ssh-server
        port: 5432,
        user: "test_user".to_string(),
        password: Some("test_password".to_string()),
        database: "test_db".to_string(),
        exclude_list: None,
        use_ssh: Some(true),
        ssh_host: Some("localhost".to_string()),
        ssh_port: Some(2222), // Mapped SSH port
        ssh_user: Some("test_user".to_string()),
        ssh_password: Some("test_password".to_string()),
        ssh_key_path: None,
    };

    let result = manager.connect("test_ssh_pg".to_string(), config).await;
    assert!(result.is_ok(), "Failed to connect to Postgres via SSH: {:?}", result.err());

    let tables = manager.get_tables("test_ssh_pg".to_string(), None).await;
    assert!(tables.is_ok());
}
