use crate::commands::TauriState;
use crate::models::{DashboardMetrics, DbSchema};
use tauri::State;

#[tauri::command]
pub async fn get_tables(
    id: String,
    db_name: Option<String>,
    state: State<'_, TauriState>,
) -> Result<Vec<String>, String> {
    state
        .db
        .get_tables(id, db_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_databases(
    id: String,
    _exclude_list: Option<String>,
    state: State<'_, TauriState>,
) -> Result<Vec<String>, String> {
    state.db.get_databases(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_schema(
    id: String,
    db_name: Option<String>,
    state: State<'_, TauriState>,
) -> Result<DbSchema, String> {
    state
        .db
        .get_schema(id, db_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_primary_keys(
    id: String,
    table_name: String,
    state: State<'_, TauriState>,
) -> Result<Vec<String>, String> {
    state
        .db
        .get_primary_keys(id, table_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_active_database(
    id: String,
    db_name: String,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state
        .db
        .set_active_database(id, db_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_dashboard_metrics(
    id: String,
    state: State<'_, TauriState>,
) -> Result<DashboardMetrics, String> {
    state
        .db
        .get_dashboard_metrics(id)
        .await
        .map_err(|e| e.to_string())
}
