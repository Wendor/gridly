use app_lib::db::DatabaseManager;
use app_lib::models::{ConnectionConfig, DatabaseDriver};
use serde_json::Value;
use serde_json::json;

#[tokio::test]
async fn test_mysql_all_types() {
    let manager = DatabaseManager::new();
    let conn_id = "type_test_mysql";

    // 1. Connect
    let config = ConnectionConfig {
        id: conn_id.to_string(),
        name: "Type Test MySQL".to_string(),
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

    let res = manager.connect(conn_id.to_string(), config).await;
    assert!(res.is_ok(), "Failed to connect to MySQL: {:?}", res.err());

    // 2. Setup Table
    let drop_sql = "DROP TABLE IF EXISTS all_types_mysql";
    let _ = manager.execute(conn_id.to_string(), drop_sql.to_string(), None).await;

    let create_sql = r#"
    CREATE TABLE all_types_mysql (
        id INT AUTO_INCREMENT PRIMARY KEY,
        -- Integers
        col_tinyint TINYINT,
        col_smallint SMALLINT,
        col_mediumint MEDIUMINT,
        col_int INT,
        col_bigint BIGINT,
        col_tinyint_1 TINYINT(1), -- Boolean-like
        
        -- Floating Point
        col_float FLOAT,
        col_double DOUBLE,
        col_decimal DECIMAL(10, 2),
        
        -- String
        col_char CHAR(10),
        col_varchar VARCHAR(50),
        col_text TEXT,
        
        -- Binary
        col_binary BINARY(5),
        col_varbinary VARBINARY(10),
        col_blob BLOB,
        
        -- Date & Time
        col_date DATE,
        col_time TIME,
        col_datetime DATETIME,
        col_timestamp TIMESTAMP,
        col_year YEAR,
        
        -- Other
        col_bit BIT(8),
        col_enum ENUM('a', 'b', 'c'),
        col_set SET('x', 'y', 'z'),
        col_json JSON
    )
    "#;

    let create_res = manager.execute(conn_id.to_string(), create_sql.to_string(), None).await;
    assert!(create_res.is_ok(), "Failed to create MySQL table: {:?}", create_res.err());

    // 3. Insert Data
    let insert_sql = r#"
    INSERT INTO all_types_mysql (
        col_tinyint, col_smallint, col_mediumint, col_int, col_bigint, col_tinyint_1,
        col_float, col_double, col_decimal,
        col_char, col_varchar, col_text,
        col_binary, col_varbinary, col_blob,
        col_date, col_time, col_datetime, col_timestamp, col_year,
        col_bit, col_enum, col_set, col_json
    ) VALUES (
        127, 32767, 8388607, 2147483647, 9223372036854775807, 1,
        1.23, 4.56789, 123.45,
        'Fixed', 'Variable', 'Long Text Data',
        'BinFi', 'BinVar', 'BlobData',
        '2023-01-01', '12:34:56', '2023-01-01 12:34:56', '2023-01-01 12:34:56', 2023,
        b'10101010', 'a', 'x,y', '{"key": "value"}'
    )
    "#;
    let insert_res = manager.execute(conn_id.to_string(), insert_sql.to_string(), None).await;
    assert!(insert_res.is_ok(), "Failed to insert MySQL data: {:?}", insert_res.err());

    // 4. Select and Verify
    let select_sql = "SELECT * FROM all_types_mysql WHERE id = 1";
    let select_res = manager.execute(conn_id.to_string(), select_sql.to_string(), None).await;
    assert!(select_res.is_ok());
    
    let result = select_res.unwrap();
    let row = &result.rows[0];
    
    // Helper to get value easily
    let get_val = |col: &str| -> &Value {
        row.get(col).expect(&format!("Column {} missing", col))
    };

    // Verify Integers
    assert_eq!(get_val("col_tinyint"), &json!(127)); // i8 -> number
    assert_eq!(get_val("col_smallint"), &json!(32767));
    assert_eq!(get_val("col_int"), &json!(2147483647));
    assert_eq!(get_val("col_bigint"), &json!(9223372036854775807i64));
    
    // TINYINT(1) - could be bool(true) or 1 depending on driver setting.
    // Our logic handles bool mapping.
    let val_tiny1 = get_val("col_tinyint_1");
    assert!(val_tiny1 == &json!(true) || val_tiny1 == &json!(1), "TINYINT(1) incorrect: {:?}", val_tiny1);
    
    // Verify Floating
    assert_eq!(get_val("col_decimal"), &json!("123.45"));
    
    // Verify String
    assert_eq!(get_val("col_varchar"), &json!("Variable"));
    
    // Verify Binary (Formatted string)
    let bin_val = get_val("col_varbinary").as_str().unwrap();
    assert!(bin_val.contains("(binary"), "Binary not formatted: {}", bin_val);
    
    // Verify Date/Time (Exact strings depend on driver formatting, but check content)
    assert_eq!(get_val("col_date"), &json!("2023-01-01"));
    // Time might come back as "12:34:56"
    
    // Verify JSON
    let json_val = get_val("col_json");
    // Should be parsed object if we did it right, or string. 
    // Wait, our implementation for "JSON" returns Value::Null if parsing fails or flattened Option.
    // If successful, it's a serde_json::Value.
    // However, if the driver returns it as string (which sqlx mysql might), we might not have parsed it?
    // Let's check logic: "JSON" => row...try_get::<Option<serde_json::Value>>...
    // sqlx supports JSON decoding.
    assert!(json_val.is_object() || json_val.is_string(), "JSON incorrect: {:?}", json_val);

    let _ = manager.disconnect(conn_id.to_string()).await;
}

#[tokio::test]
async fn test_postgres_all_types() {
    let manager = DatabaseManager::new();
    let conn_id = "type_test_pg";

    // 1. Connect
    let config = ConnectionConfig {
        id: conn_id.to_string(),
        name: "Type Test PG".to_string(),
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

    let res = manager.connect(conn_id.to_string(), config).await;
    assert!(res.is_ok(), "Failed to connect to PG: {:?}", res.err());

    // 2. Setup Table
    let drop_sql = "DROP TABLE IF EXISTS all_types_pg";
    let _ = manager.execute(conn_id.to_string(), drop_sql.to_string(), None).await;

    let create_sql = r#"
    CREATE TABLE all_types_pg (
        id SERIAL PRIMARY KEY,
        -- Integers
        col_smallint SMALLINT,
        col_integer INTEGER,
        col_bigint BIGINT,
        
        -- Floating
        col_real REAL,
        col_double DOUBLE PRECISION,
        col_numeric NUMERIC(10, 2),
        col_money MONEY,
        
        -- Logic
        col_bool BOOLEAN,
        
        -- Text
        col_char CHAR(10),
        col_varchar VARCHAR(50),
        col_text TEXT,
        
        -- Binary
        col_bytea BYTEA,
        
        -- Date/Time
        col_date DATE,
        col_time TIME,
        col_timestamp TIMESTAMP,
        col_timestamptz TIMESTAMPTZ,
        col_interval INTERVAL,
        
        -- Network
        col_inet INET,
        col_cidr CIDR,
        col_macaddr MACADDR,
        
        -- Bit
        col_bit BIT(5),
        
        -- JSON
        col_json JSON,
        col_jsonb JSONB,
        
        -- UUID
        col_uuid UUID,
        
        -- Arrays
        col_arr_int INTEGER[],
        col_arr_text TEXT[]
    )
    "#;

    let create_res = manager.execute(conn_id.to_string(), create_sql.to_string(), None).await;
    assert!(create_res.is_ok(), "Failed to create PG table: {:?}", create_res.err());

    // 3. Insert Data
    let insert_sql = r#"
    INSERT INTO all_types_pg (
        col_smallint, col_integer, col_bigint,
        col_real, col_double, col_numeric, col_money,
        col_bool,
        col_char, col_varchar, col_text,
        col_bytea,
        col_date, col_time, col_timestamp, col_timestamptz, col_interval,
        col_inet, col_cidr, col_macaddr,
        col_bit,
        col_json, col_jsonb,
        col_uuid,
        col_arr_int, col_arr_text
    ) VALUES (
        32767, 2147483647, 9223372036854775807,
        1.23, 4.56789, 123.45, 100.50,
        true,
        'Fixed', 'Variable', 'Long Text',
        decode('DEADBEEF', 'hex'),
        '2023-01-01', '12:34:56', '2023-01-01 12:34:56', '2023-01-01 12:34:56+00', '1 year 2 months',
        '192.168.1.1', '10.0.0.0/8', '08:00:2b:01:02:03',
        B'10101',
        '{"k":"v"}', '{"x":1}',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ARRAY[1, 2, 3], ARRAY['a', 'b', 'c']
    )
    "#;
    let insert_res = manager.execute(conn_id.to_string(), insert_sql.to_string(), None).await;
    assert!(insert_res.is_ok(), "Failed to insert PG data: {:?}", insert_res.err());

    // 4. Select and Verify
    let select_sql = "SELECT * FROM all_types_pg WHERE id = 1";
    let select_res = manager.execute(conn_id.to_string(), select_sql.to_string(), None).await;
    assert!(select_res.is_ok());
    
    let result = select_res.unwrap();
    let row = &result.rows[0];
    
    let get_val = |col: &str| -> &Value {
        row.get(col).expect(&format!("Column {} missing", col))
    };

    // Verify Integers
    assert_eq!(get_val("col_integer"), &json!(2147483647));
    
    // Verify Numeric (Expect string as per implementation to preserve precision)
    // Handle potential trailing zeros from BigDecimal
    let num_val = get_val("col_numeric").as_str().expect("Numeric should be string");
    assert!(num_val.starts_with("123.45"), "Numeric value wrong: {}", num_val);
    
    // Verify Money (Should be string)
    let money = get_val("col_money").as_str().unwrap();
    assert!(money.contains("100.50") || money.contains("100.5"), "Money format wrong: {}", money);

    // Verify Bool
    assert_eq!(get_val("col_bool"), &json!(true));

    // Verify Binary
    let bytea = get_val("col_bytea").as_str().unwrap();
    assert!(bytea.contains("(binary"), "Bytea not formatted: {}", bytea);
    
    // Verify Network
    assert_eq!(get_val("col_inet"), &json!("192.168.1.1/32"));
    
    // Verify Bit (String of bits)
    // We switched to String fallback, so it should be "10101"
    assert_eq!(get_val("col_bit"), &json!("10101"));

    // Verify Arrays
    let arr_int = get_val("col_arr_int");
    assert!(arr_int.is_array(), "Expected array, got: {:?}", arr_int);
    assert_eq!(arr_int[0], json!(1));
    
    let arr_text = get_val("col_arr_text");
    assert!(arr_text.is_array(), "Expected array, got: {:?}", arr_text);
    assert_eq!(arr_text[0], json!("a"));

    let _ = manager.disconnect(conn_id.to_string()).await;
}

#[tokio::test]
async fn test_clickhouse_all_types() {
    let manager = DatabaseManager::new();
    let conn_id = "type_test_ch";

    // 1. Connect
    let config = ConnectionConfig {
        id: conn_id.to_string(),
        name: "Type Test CH".to_string(),
        driver: DatabaseDriver::Clickhouse,
        host: "127.0.0.1".to_string(),
        port: 18123,
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

    let mut result = manager.connect(conn_id.to_string(), config.clone()).await;
    let mut attempts = 0;
    while result.is_err() && attempts < 30 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        result = manager.connect(conn_id.to_string(), config.clone()).await;
        attempts += 1;
    }
    assert!(result.is_ok(), "Failed to connect to CH: {:?}", result.err());

    // 2. Setup Table
    let drop_sql = "DROP TABLE IF EXISTS all_types_ch";
    let _ = manager.execute(conn_id.to_string(), drop_sql.to_string(), None).await;

    // ClickHouse uses specific engine, usually MergeTree
    let create_sql = r#"
    CREATE TABLE all_types_ch (
        id UInt64,
        
        -- Integers
        col_u8 UInt8,
        col_u16 UInt16,
        col_u32 UInt32,
        col_u64 UInt64,
        col_u128 UInt128,
        col_i8 Int8,
        col_i16 Int16,
        col_i32 Int32,
        col_i64 Int64,
        col_i128 Int128,
        
        -- Float/Decimal
        col_f32 Float32,
        col_f64 Float64,
        col_decimal Decimal(10, 2),
        
        -- String
        col_string String,
        col_fixed FixedString(10),
        
        -- Date/Time
        col_date Date,
        col_date32 Date32,
        col_datetime DateTime,
        col_datetime64 DateTime64(3),
        
        -- Complex
        col_array Array(Int32),
        col_map Map(String, Int32),
        col_tuple Tuple(Int32, String),
        
        -- Network
        col_ipv4 IPv4,
        col_ipv6 IPv6,
        
        -- Other
        col_uuid UUID,
        col_enum Enum('a' = 1, 'b' = 2)
    ) ENGINE = MergeTree() ORDER BY id
    "#;

    let create_res = manager.execute(conn_id.to_string(), create_sql.to_string(), None).await;
    assert!(create_res.is_ok(), "Failed to create CH table: {:?}", create_res.err());

    // 3. Insert Data
    let insert_sql = r#"
    INSERT INTO all_types_ch (
        id,
        col_u8, col_u16, col_u32, col_u64, col_u128,
        col_i8, col_i16, col_i32, col_i64, col_i128,
        col_f32, col_f64, col_decimal,
        col_string, col_fixed,
        col_date, col_date32, col_datetime, col_datetime64,
        col_array, col_map, col_tuple,
        col_ipv4, col_ipv6,
        col_uuid, col_enum
    ) VALUES (
        1,
        255, 65535, 4294967295, 18446744073709551615, 123456789012345678901234567890,
        127, 32767, 2147483647, 9223372036854775807, 123456789012345678901234567890,
        1.23, 4.56789, 123.45,
        'Variable', 'Fixed',
        '2023-01-01', '2023-01-01', '2023-01-01 12:34:56', '2023-01-01 12:34:56.789',
        [1, 2, 3], {'k1': 1, 'k2': 2}, (100, 'tuple'),
        '192.168.1.1', '2001:db8::1',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a'
    )
    "#;
    let insert_res = manager.execute(conn_id.to_string(), insert_sql.to_string(), None).await;
    assert!(insert_res.is_ok(), "Failed to insert CH data: {:?}", insert_res.err());

    // 4. Select and Verify
    let select_sql = "SELECT * FROM all_types_ch WHERE id = 1";
    let select_res = manager.execute(conn_id.to_string(), select_sql.to_string(), None).await;
    assert!(select_res.is_ok(), "Failed to select: {:?}", select_res.err());
    
    let result = select_res.unwrap();
    // ClickHouse JSON format usually returns data directly in rows
    let row = &result.rows[0];
    
    let get_val = |col: &str| -> &Value {
        row.get(col).expect(&format!("Column {} missing", col))
    };

    // Verify Integers (Large ints should be strings due to settings)
    assert_eq!(get_val("col_u8"), &json!(255));
    assert_eq!(get_val("col_i32"), &json!(2147483647));
    // Check 64-bit and 128-bit are strings
    let u64_val = get_val("col_u64");
    assert!(u64_val.is_string(), "UInt64 should be string, got {:?}", u64_val);
    assert_eq!(u64_val, &json!("18446744073709551615"));

    let i64_val = get_val("col_i64");
    assert!(i64_val.is_string(), "Int64 should be string, got {:?}", i64_val);
    assert_eq!(i64_val, &json!("9223372036854775807"));
    
    // Decimal
    assert_eq!(get_val("col_decimal"), &json!(123.45)); // JSON format might return this as number key for Decimal? Or string?
                                                        // Actually with JSON format, Decimals are often numbers unless quoted?
                                                        // Let's check. If it fails we adjust.
    
    // String
    assert_eq!(get_val("col_string"), &json!("Variable"));
    
    // Complex
    let arr = get_val("col_array");
    assert!(arr.is_array());
    assert_eq!(arr[0], json!(1));
    
    let map_val = get_val("col_map");
    // ClickHouse JSON Maps are objects
    assert!(map_val.is_object());
    assert_eq!(map_val.get("k1"), Some(&json!(1)));
    
    let tuple_val = get_val("col_tuple");
    assert!(tuple_val.is_array()); // Tuples are arrays in JSON
    assert_eq!(tuple_val[0], json!(100));
    assert_eq!(tuple_val[1], json!("tuple"));

    let _ = manager.disconnect(conn_id.to_string()).await;
}
