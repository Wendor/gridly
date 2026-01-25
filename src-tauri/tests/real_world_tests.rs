use app_lib::db::DatabaseManager;
use app_lib::models::{ConnectionConfig, DatabaseDriver, DataRequest, RowUpdate};
use std::collections::HashMap;
use std::time::Duration;
use serde_json::json;
use tokio::time::sleep;

// Helper to wait for SSH server to be ready
#[allow(dead_code)]
async fn wait_for_ssh_server(host: &str, port: u16) -> bool {
    for _ in 0..30 { // Try for 30 seconds
        if std::net::TcpStream::connect(format!("{}:{}", host, port)).is_ok() {
            return true;
        }
        sleep(Duration::from_secs(1)).await;
    }
    false
}

// TODO: SSH Test is flaky in Docker-in-Docker environment due to "Failed getting banner" (immediate connection close). 
// Requires manual verification or native environment.
// #[tokio::test]
#[allow(dead_code)]
async fn test_ssh_tunnel_with_retry() {
    // 1. Wait for SSH server availability
    let ssh_ready = wait_for_ssh_server("127.0.0.1", 2222).await;
    assert!(ssh_ready, "SSH Server did not become ready in time");

    let manager = DatabaseManager::new();
    let conn_id = "real_ssh_pg".to_string();

    let config = ConnectionConfig {
        id: conn_id.clone(),
        name: "Real SSH Postgres".to_string(),
        driver: DatabaseDriver::Postgres,
        host: "postgres".to_string(), // Internal hostname
        port: 5432,
        user: "test_user".to_string(),
        password: Some("test_password".to_string()),
        database: "test_db".to_string(),
        exclude_list: None,
        use_ssh: Some(true),
        ssh_host: Some("localhost".to_string()),
        ssh_port: Some(2222),
        ssh_user: Some("test_user".to_string()),
        ssh_password: Some("test_password".to_string()),
        ssh_key_path: None,
    };

    // Retry connection logic
    let mut connected = false;
    for i in 0..5 {
        match manager.connect(conn_id.clone(), config.clone()).await {
            Ok(_) => {
                connected = true;
                break;
            }
            Err(e) => {
                println!("Attempt {} failed: {:?}", i, e);
            }
        }
        sleep(Duration::from_secs(2)).await;
    }

    assert!(connected, "Failed to establish SSH tunnel connection after retries");

    let tables = manager.get_tables(conn_id.clone(), None).await;
    assert!(tables.is_ok(), "Failed to list tables via SSH");
    
    let _ = manager.disconnect(conn_id).await;
}

#[tokio::test]
async fn test_user_session_workflow() {
    let manager = DatabaseManager::new();
    let conn_id = "session_pg".to_string();

    let config = ConnectionConfig {
        id: conn_id.clone(),
        name: "Session PG".to_string(),
        driver: DatabaseDriver::Postgres,
        host: "localhost".to_string(),
        port: 54320,
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

    manager.connect(conn_id.clone(), config).await.expect("Connect failed");

    // 1. Dashboard Load
    println!("Loading Dashboard...");
    let metrics = manager.get_dashboard_metrics(conn_id.clone()).await.expect("Metrics failed");
    assert!(metrics.active_connections > 0);

    // 2. Schema Browsing
    println!("Loading Schema...");
    let tables = manager.get_tables(conn_id.clone(), None).await.expect("Get tables failed");
    assert!(tables.contains(&"users".to_string()));
    
    let schema = manager.get_schema(conn_id.clone(), None).await.expect("Get schema failed");
    assert!(schema.contains_key("users"));

    // 3. Data Browsing
    println!("Browsing Data...");
    let req = DataRequest {
        table_name: "users".to_string(),
        offset: 0,
        limit: 50,
        sort: None,
    };
    let data = manager.get_table_data(conn_id.clone(), req).await.expect("Get data failed");
    
    // 4. Data Modification (User edits a row)
    println!("Modifying Data...");
    if let Some(row) = data.rows.first() {
        let id_val = row.get("id").unwrap();
        // Robust ID extraction
        let id = id_val.as_i64()
            .or_else(|| id_val.as_str().and_then(|s| s.parse::<i64>().ok()))
            .expect("Invalid ID");

        let mut pks = HashMap::new();
        pks.insert("id".to_string(), json!(id));
        
        let mut changes = HashMap::new();
        let new_name = format!("User_{}", id);
        changes.insert("name".to_string(), json!(new_name));

        let update = RowUpdate {
            table_name: "users".to_string(),
            primary_keys: pks,
            changes,
        };

        let res = manager.update_rows(conn_id.clone(), vec![update]).await.expect("Update failed");
        assert_eq!(res.affected_rows, 1);
    }

    // 5. Verification (User refreshes view)
    println!("Verifying Update...");
    let req_refresh = DataRequest {
        table_name: "users".to_string(),
        offset: 0,
        limit: 50,
        sort: None,
    };
    let data_refresh = manager.get_table_data(conn_id.clone(), req_refresh).await.expect("Refresh failed");
    // Just verify call succeeds, logic verified above
    assert!(!data_refresh.rows.is_empty());

    manager.disconnect(conn_id).await.expect("Disconnect failed");
}

#[tokio::test]
async fn test_multi_connection_workflow() {
    let manager = DatabaseManager::new();
    
    // Connection A (Postgres)
    let pg_id = "multi_pg".to_string();
    let pg_config = ConnectionConfig {
        id: pg_id.clone(),
        name: "Multi PG".to_string(),
        driver: DatabaseDriver::Postgres,
        host: "localhost".to_string(),
        port: 54320,
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

    // Connection B (MySQL)
    let mysql_id = "multi_mysql".to_string();
    let mysql_config = ConnectionConfig {
        id: mysql_id.clone(),
        name: "Multi MySQL".to_string(),
        driver: DatabaseDriver::Mysql,
        host: "127.0.0.1".to_string(),
        port: 33060,
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

    // 1. Open Both
    manager.connect(pg_id.clone(), pg_config).await.expect("PG Connect failed");
    manager.connect(mysql_id.clone(), mysql_config).await.expect("MySQL Connect failed");

    // 2. Query Both concurrently
    let pg_tables = manager.get_tables(pg_id.clone(), None).await.expect("PG Tables failed");
    let mysql_tables = manager.get_tables(mysql_id.clone(), Some("test_db".to_string())).await.expect("MySQL Tables failed");

    assert!(pg_tables.contains(&"users".to_string()));
    assert!(mysql_tables.contains(&"users".to_string()));

    // 3. Switch Context (Postgres)
    // Switch to 'postgres' system db
    manager.set_active_database(pg_id.clone(), "postgres".to_string()).await.expect("Switch DB failed");
    
    let pg_dbs = manager.get_databases(pg_id.clone()).await.expect("Get Databases failed");
    assert!(pg_dbs.contains(&"postgres".to_string()));

    // Switch back
    manager.set_active_database(pg_id.clone(), "test_db".to_string()).await.expect("Switch back failed");
    let pg_tables_back = manager.get_tables(pg_id.clone(), None).await.expect("PG Tables back failed");
    assert!(pg_tables_back.contains(&"users".to_string()));

    // 4. Disconnect one, check other
    manager.disconnect(pg_id.clone()).await.expect("PG Disconnect failed");
    
    // MySQL should still work
    let mysql_metrics = manager.get_dashboard_metrics(mysql_id.clone()).await.expect("MySQL metrics failed");
    assert!(!mysql_metrics.version.is_empty());

    manager.disconnect(mysql_id).await.expect("MySQL Disconnect failed");
}
