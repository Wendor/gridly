use crate::commands::TauriState;
use crate::models::{DataRequest, QueryResult, RowUpdate, UpdateResult};
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
