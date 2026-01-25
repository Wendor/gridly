use crate::db::DatabaseManager;
use crate::models::{
    AppSettings, AppStateData, DashboardMetrics, DataRequest, DbConnection, DbResult, DbSchema,
    HistoryItem, RowUpdate, UpdateResult,
};
use crate::storage::StorageService;
use tauri::State;

pub struct AppState {
    pub db: DatabaseManager,
    pub storage: StorageService,
}

#[tauri::command]
pub async fn connect(id: String, state: State<'_, AppState>) -> Result<String, String> {
    let connections = state.storage.get_connections();
    let config = connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Connection not found".to_string())?;

    state.db.connect(id, config).await
}

#[tauri::command]
pub async fn disconnect(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.disconnect(id).await
}

#[tauri::command]
pub async fn test_connection(
    config: DbConnection,
    connection_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // If connection_id provided, merge password from saved
    let mut final_config = config.clone();
    if let Some(cid) = connection_id {
        if let Some(saved) = state.storage.get_connections().into_iter().find(|c| c.id == cid) {
            // Treat None or empty string as "not provided"
            if final_config.password.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
                final_config.password = saved.password;
            }
            if final_config.ssh_password.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
                final_config.ssh_password = saved.ssh_password;
            }
        }
    }
    
    // For test, we use a temporary ID or just connect/disconnect
    // DatabaseManager.connect expects ID.
    // We can use "test" ID but we should ensure we disconnect.
    // Or add test_connection to Manager.
    // For now reusing connect with "test" ID.
    state.db.connect("test".to_string(), final_config).await?;
    state.db.disconnect("test".to_string()).await?;
    Ok("Connection successful".to_string())
}

#[tauri::command]
pub async fn get_connections(state: State<'_, AppState>) -> Result<Vec<crate::models::DbConnectionMeta>, String> {
    Ok(state.storage.get_connections_meta())
}

#[tauri::command]
pub async fn save_connection(connection: DbConnection, state: State<'_, AppState>) -> Result<(), String> {
    state.storage.save_connection(connection)
}

#[tauri::command]
pub async fn delete_connection(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.storage.delete_connection(&id)
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.storage.get_settings())
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<(), String> {
    state.storage.save_settings(settings)
}

#[tauri::command]
pub async fn get_state(state: State<'_, AppState>) -> Result<AppStateData, String> {
    Ok(state.storage.get_state())
}

#[tauri::command]
pub async fn save_state(state: AppStateData, app_state: State<'_, AppState>) -> Result<(), String> {
    app_state.storage.save_state(state)
}

#[tauri::command]
pub async fn update_state(updates: serde_json::Value, state: State<'_, AppState>) -> Result<(), String> {
    state.storage.update_state(updates)
}

#[tauri::command]
pub async fn get_history(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    Ok(state.storage.get_history())
}

#[tauri::command]
pub async fn save_history(history: Vec<HistoryItem>, state: State<'_, AppState>) -> Result<(), String> {
    state.storage.save_history(history)
}

#[tauri::command]
pub async fn query(id: String, sql: String, state: State<'_, AppState>) -> Result<DbResult, String> {
    state.db.execute(id, sql).await
}

#[tauri::command]
pub async fn get_tables(id: String, db_name: Option<String>, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.get_tables(id, db_name).await
}

#[tauri::command]
pub async fn get_databases(id: String, _exclude_list: Option<String>, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    // TODO: Filter by exclude_list
    state.db.get_databases(id).await
}

#[tauri::command]
pub async fn get_table_data(connection_id: String, req: DataRequest, state: State<'_, AppState>) -> Result<DbResult, String> {
    state.db.get_table_data(connection_id, req).await
}

#[tauri::command]
pub async fn get_schema(id: String, db_name: Option<String>, state: State<'_, AppState>) -> Result<DbSchema, String> {
    state.db.get_schema(id, db_name).await
}

#[tauri::command]
pub async fn get_primary_keys(id: String, table_name: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.get_primary_keys(id, table_name).await
}

#[tauri::command]
pub async fn update_rows(id: String, updates: Vec<RowUpdate>, state: State<'_, AppState>) -> Result<UpdateResult, String> {
    state.db.update_rows(id, updates).await
}
#[tauri::command]
pub async fn set_active_database(id: String, db_name: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.set_active_database(id, db_name).await
}

#[tauri::command]
pub async fn get_dashboard_metrics(id: String, state: State<'_, AppState>) -> Result<DashboardMetrics, String> {
    state.db.get_dashboard_metrics(id).await
}
