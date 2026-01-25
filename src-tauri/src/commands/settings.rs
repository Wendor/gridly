use crate::commands::TauriState;
use crate::models::{AppSettings, AppStateData, ConnectionConfig, ConnectionSummary, HistoryItem};
use tauri::State;

#[tauri::command]
pub async fn get_connections(
    state: State<'_, TauriState>,
) -> Result<Vec<ConnectionSummary>, String> {
    Ok(state.storage.get_connections_meta())
}

#[tauri::command]
pub async fn save_connection(
    connection: ConnectionConfig,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state
        .storage
        .save_connection(connection)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_connection(id: String, state: State<'_, TauriState>) -> Result<(), String> {
    state
        .storage
        .delete_connection(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, TauriState>) -> Result<AppSettings, String> {
    Ok(state.storage.get_settings())
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state
        .storage
        .save_settings(settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_state(state: State<'_, TauriState>) -> Result<AppStateData, String> {
    Ok(state.storage.get_state())
}

#[tauri::command]
pub async fn save_state(
    app_state: AppStateData,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state
        .storage
        .save_state(app_state)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_state(
    updates: serde_json::Value,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state
        .storage
        .update_state(updates)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_history(state: State<'_, TauriState>) -> Result<Vec<HistoryItem>, String> {
    Ok(state.storage.get_history())
}

#[tauri::command]
pub async fn save_history(
    history: Vec<HistoryItem>,
    state: State<'_, TauriState>,
) -> Result<(), String> {
    state
        .storage
        .save_history(history)
        .map_err(|e| e.to_string())
}
