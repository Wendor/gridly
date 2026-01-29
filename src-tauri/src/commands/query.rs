use crate::commands::TauriState;
use crate::models::{DataRequest, QueryResult, RowUpdate, UpdateResult};
use std::fs::File;
use std::io::Write;
use tauri::State;

#[tauri::command]
pub async fn query(
    id: String,
    sql: String,
    query_id: Option<String>,
    state: State<'_, TauriState>,
) -> Result<QueryResult, String> {
    state.db.execute(id, sql, query_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_query(
    id: String,
    sql: String,
    format: String,
    path: String,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    println!("Exporting query to path: {}", path);
    
    // Check if query exists in map first to avoid unnecessary db call if missing
    // Actually we need to re-run the query or use cached results?
    // The current implementation re-runs the query using `db.execute`.
    
    let result = state.db.execute(id, sql, None).await; // Added None for query_id

    println!("Query execution result: {:?}", result.as_ref().map(|_| "Ok").map_err(|e| e));

    if let Err(e) = result {
        return Err(e.to_string());
    }
    
    let result = result.unwrap();
    if let Some(error) = result.error {
        return Err(error);
    }

    let write_res = write_export_file(&result, &format, &path).map_err(|e| e.to_string());
    println!("Write export file result: {:?}", write_res);
    write_res
}

fn write_export_file(result: &QueryResult, format: &str, path: &str) -> Result<(), String> {
    let mut file = File::create(path).map_err(|e| e.to_string())?;

    match format {
        "csv" => {
            let mut wtr = csv::Writer::from_writer(file);
            // Write headers
            wtr.write_record(&result.columns).map_err(|e| e.to_string())?;
            // Write rows
            for row in &result.rows {
                let record: Vec<String> = result
                    .columns
                    .iter()
                    .map(|col| {
                        row.get(col)
                            .map(|v| match v {
                                serde_json::Value::String(s) => s.clone(),
                                serde_json::Value::Null => "".to_string(),
                                _ => v.to_string(),
                            })
                            .unwrap_or_default()
                    })
                    .collect();
                wtr.write_record(&record).map_err(|e| e.to_string())?;
            }
            wtr.flush().map_err(|e| e.to_string())?;
        }
        "json" => {
            let json = serde_json::to_string_pretty(&result.rows).map_err(|e| e.to_string())?;
            file.write_all(json.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        "sql" => {
            let table_name = "export_table"; // TODO: Maybe try to parse from SQL, but for now fixed
            for row in &result.rows {
                let columns: Vec<&String> = result.columns.iter().collect();
                let values: Vec<String> = columns
                    .iter()
                    .map(|col| {
                        row.get(*col)
                            .map(|v| match v {
                                serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
                                serde_json::Value::Null => "NULL".to_string(),
                                serde_json::Value::Number(n) => n.to_string(),
                                serde_json::Value::Bool(b) => b.to_string().to_uppercase(), // TRUE/FALSE
                                _ => format!("'{}'", v.to_string().replace("'", "''")),
                            })
                            .unwrap_or_else(|| "NULL".to_string())
                    })
                    .collect();

                let sql = format!(
                    "INSERT INTO {} ({}) VALUES ({});\n",
                    table_name,
                    columns
                        .iter()
                        .map(|c| format!("\"{}\"", c))
                        .collect::<Vec<String>>()
                        .join(", "),
                    values.join(", ")
                );
                file.write_all(sql.as_bytes()).map_err(|e| e.to_string())?;
            }
        }
        _ => return Err("Unsupported format".to_string()),
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use serde_json::json;
    use std::collections::HashMap;

    fn create_sample_result() -> QueryResult {
        let mut row1 = HashMap::new();
        row1.insert("id".to_string(), json!(1));
        row1.insert("name".to_string(), json!("Alice"));
        
        let mut row2 = HashMap::new();
        row2.insert("id".to_string(), json!(2));
        row2.insert("name".to_string(), json!("Bob, O'Neil")); // Test comma handling (force quotes)

        QueryResult {
            rows: vec![row1, row2],
            columns: vec!["id".to_string(), "name".to_string()],
            error: None,
            duration: 0.1,
        }
    }

    #[test]
    fn test_export_csv() {
        let result = create_sample_result();
        let path = "test_export.csv";
        let res = write_export_file(&result, "csv", path);
        assert!(res.is_ok());

        let content = fs::read_to_string(path).unwrap();
        fs::remove_file(path).unwrap();

        assert!(content.contains("id,name"));
        assert!(content.contains("1,Alice"));
        assert!(content.contains("2,\"Bob, O'Neil\""));
    }

    #[test]
    fn test_export_json() {
        let result = create_sample_result();
        let path = "test_export.json";
        let res = write_export_file(&result, "json", path);
        assert!(res.is_ok());

        let content = fs::read_to_string(path).unwrap();
        fs::remove_file(path).unwrap();

        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert!(json.is_array());
        assert_eq!(json.as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_export_sql() {
        let result = create_sample_result();
        let path = "test_export.sql";
        let res = write_export_file(&result, "sql", path);
        assert!(res.is_ok());

        let content = fs::read_to_string(path).unwrap();
        fs::remove_file(path).unwrap();

        assert!(content.contains("INSERT INTO export_table"));
        assert!(content.contains("'Alice'"));
        assert!(content.contains("'Bob, O''Neil'")); // Escaped quote
    }
}

#[tauri::command]
pub async fn cancel_query(
    id: String,
    query_id: String,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state.db.cancel_query(id, query_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_data(
    connection_id: String,
    req: DataRequest,
    state: State<'_, TauriState>,
) -> Result<QueryResult, String> {
    state
        .db
        .get_table_data(connection_id, req)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_rows(
    id: String,
    updates: Vec<RowUpdate>,
    state: State<'_, TauriState>,
) -> Result<UpdateResult, String> {
    state
        .db
        .update_rows(id, updates)
        .await
        .map_err(|e| e.to_string())
}
