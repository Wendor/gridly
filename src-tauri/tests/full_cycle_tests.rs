use app_lib::db::DatabaseManager;
use app_lib::models::{ConnectionConfig, DatabaseDriver, DataRequest, RowUpdate};
use std::collections::HashMap;
use serde_json::json;

#[tokio::test]
async fn test_postgres_full_cycle() {
    let manager = DatabaseManager::new();
    let conn_id = "cycle_pg".to_string();
    
    // 1. Connect
    let config = ConnectionConfig {
        id: conn_id.clone(),
        name: "Cycle Postgres".to_string(),
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

    let result = manager.connect(conn_id.clone(), config).await;
    assert!(result.is_ok(), "Connect failed: {:?}", result.err());

    // 2. Metadata (Tables)
    let tables = manager.get_tables(conn_id.clone(), None).await;
    assert!(tables.is_ok());
    let tables = tables.unwrap();
    assert!(tables.contains(&"users".to_string()));

    // 3. Metadata (Schema)
    let schema = manager.get_schema(conn_id.clone(), None).await;
    assert!(schema.is_ok());
    let schema = schema.unwrap();
    assert!(schema.contains_key("users"));
    let columns = schema.get("users").unwrap();
    assert!(columns.contains(&"id".to_string()));
    assert!(columns.contains(&"name".to_string()));
    assert!(columns.contains(&"email".to_string()));

    // 4. Read Data
    let req = DataRequest {
        table_name: "users".to_string(),
        offset: 0,
        limit: 10,
        sort: None,
    };
    let data = manager.get_table_data(conn_id.clone(), req).await;
    assert!(data.is_ok());
    let result = data.unwrap();
    let initial_count = result.rows.len();
    assert!(initial_count >= 2);

    // 5. Write Data (INSERT via update_rows hack or custom query)
    // NOTE: update_rows currently only does UPDATE. We need to use execute for INSERT to simulate app usage correctly,
    // or if the app supports INSERT via update_rows (it usually doesn't, it generates UPDATE statements).
    // Let's use execute for INSERT.
    let insert_sql = "INSERT INTO users (name, email) VALUES ('TestUser', 'test@example.com')";
    let insert_res = manager.execute(conn_id.clone(), insert_sql.to_string()).await;
    assert!(insert_res.is_ok(), "Insert failed: {:?}", insert_res.err());

    // 6. Verify Insert
    let req_verify = DataRequest {
        table_name: "users".to_string(),
        offset: 0,
        limit: 100,
        sort: None,
    };
    let data_verify = manager.get_table_data(conn_id.clone(), req_verify).await.unwrap();
    let new_user = data_verify.rows.iter().find(|r| 
        r.get("email").and_then(|v| v.as_str()) == Some("test@example.com")
    );
    assert!(new_user.is_some(), "New user not found");
    
    // Get ID for update
    let id_val = new_user.unwrap().get("id").unwrap();
    let user_id = id_val.as_i64()
        .or_else(|| id_val.as_str().and_then(|s| s.parse::<i64>().ok()))
        .expect(&format!("ID should be i64 or parsable string, got: {:?}", id_val));

    // 7. Update Row
    let mut primary_keys = HashMap::new();
    primary_keys.insert("id".to_string(), json!(user_id));
    
    let mut changes = HashMap::new();
    changes.insert("name".to_string(), json!("UpdatedUser"));

    let update = RowUpdate {
        table_name: "users".to_string(),
        primary_keys,
        changes,
    };

    let update_res = manager.update_rows(conn_id.clone(), vec![update]).await;
    assert!(update_res.is_ok(), "Update rows failed: {:?}", update_res.err());
    assert_eq!(update_res.unwrap().affected_rows, 1);

    // 8. Metrics
    let metrics = manager.get_dashboard_metrics(conn_id.clone()).await;
    assert!(metrics.is_ok());
    let metrics = metrics.unwrap();
    assert!(metrics.uptime > 0);
    assert!(!metrics.version.is_empty());

    // 9. Cleanup (Delete test user)
    let _ = manager.execute(conn_id.clone(), "DELETE FROM users WHERE email = 'test@example.com'".to_string()).await;
    
    // 10. Disconnect
    let disc_res = manager.disconnect(conn_id.clone()).await;
    assert!(disc_res.is_ok());
}

#[tokio::test]
async fn test_mysql_full_cycle() {
    let manager = DatabaseManager::new();
    let conn_id = "cycle_mysql".to_string();
    
    // 1. Connect
    let config = ConnectionConfig {
        id: conn_id.clone(),
        name: "Cycle MySQL".to_string(),
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

    let result = manager.connect(conn_id.clone(), config).await;
    assert!(result.is_ok(), "Connect failed: {:?}", result.err());

    // 2. Metadata (Tables)
    let tables = manager.get_tables(conn_id.clone(), Some("test_db".to_string())).await;
    assert!(tables.is_ok());
    let tables = tables.unwrap();
    assert!(tables.contains(&"users".to_string()));

    // 3. Metadata (Schema)
    let schema = manager.get_schema(conn_id.clone(), Some("test_db".to_string())).await;
    assert!(schema.is_ok());
    let schema = schema.unwrap();
    assert!(schema.contains_key("users"));

    // 4. Read Data
    let req = DataRequest {
        table_name: "users".to_string(),
        offset: 0,
        limit: 10,
        sort: None,
    };
    let data = manager.get_table_data(conn_id.clone(), req).await;
    assert!(data.is_ok());
    let result = data.unwrap();
    let initial_count = result.rows.len();
    assert!(initial_count >= 2);

    // 5. Write Data (INSERT)
    let insert_sql = "INSERT INTO users (name, email) VALUES ('TestUserMysql', 'test@mysql.com')";
    let insert_res = manager.execute(conn_id.clone(), insert_sql.to_string()).await;
    assert!(insert_res.is_ok(), "Insert failed: {:?}", insert_res.err());

    // 6. Verify Insert
    let req_verify = DataRequest {
        table_name: "users".to_string(),
        offset: 0,
        limit: 100,
        sort: None,
    };
    let data_verify = manager.get_table_data(conn_id.clone(), req_verify).await.unwrap();
    let new_user = data_verify.rows.iter().find(|r| 
        r.get("email").and_then(|v| v.as_str()) == Some("test@mysql.com")
    );
    assert!(new_user.is_some(), "New user not found");
    
    // Get ID for update
    // MySQL IDs are usually numbers, ensure correct extraction
    let user_id = new_user.unwrap().get("id").unwrap().as_i64().expect("ID should be i64");

    // 7. Update Row
    let mut primary_keys = HashMap::new();
    primary_keys.insert("id".to_string(), json!(user_id));
    
    let mut changes = HashMap::new();
    changes.insert("name".to_string(), json!("UpdatedUserMysql"));

    let update = RowUpdate {
        table_name: "users".to_string(),
        primary_keys,
        changes,
    };

    let update_res = manager.update_rows(conn_id.clone(), vec![update]).await;
    assert!(update_res.is_ok(), "Update rows failed: {:?}", update_res.err());
    assert_eq!(update_res.unwrap().affected_rows, 1);

    // 8. Metrics
    let metrics = manager.get_dashboard_metrics(conn_id.clone()).await;
    assert!(metrics.is_ok());
    let metrics = metrics.unwrap();
    assert!(metrics.uptime > 0);
    assert!(!metrics.version.is_empty());

    // 9. Cleanup
    let _ = manager.execute(conn_id.clone(), "DELETE FROM users WHERE email = 'test@mysql.com'".to_string()).await;
    
    // 10. Disconnect
    let disc_res = manager.disconnect(conn_id.clone()).await;
    assert!(disc_res.is_ok());
}
