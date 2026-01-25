use crate::commands::TauriState;
use crate::models::ConnectionConfig;
use tauri::State;

#[tauri::command]
pub async fn connect(id: String, state: State<'_, TauriState>) -> Result<String, String> {
    let connections = state.storage.get_connections();
    let config = connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Connection not found".to_string())?;

    state.db.connect(id, config).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn disconnect(id: String, state: State<'_, TauriState>) -> Result<(), String> {
    state.db.disconnect(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_connection(
    config: ConnectionConfig,
    connection_id: Option<String>,
    state: State<'_, TauriState>,
) -> Result<String, String> {
    let mut final_config = config.clone();
    if let Some(cid) = connection_id {
        if let Some(saved) = state
            .storage
            .get_connections()
            .into_iter()
            .find(|c| c.id == cid)
        {
            if final_config
                .password
                .as_ref()
                .map(|s| s.is_empty())
                .unwrap_or(true)
            {
                final_config.password = saved.password;
            }
            if final_config
                .ssh_password
                .as_ref()
                .map(|s| s.is_empty())
                .unwrap_or(true)
            {
                final_config.ssh_password = saved.ssh_password;
            }
        }
    }

    state
        .db
        .connect("test".to_string(), final_config)
        .await
        .map_err(|e| e.to_string())?;
    state
        .db
        .disconnect("test".to_string())
        .await
        .map_err(|e| e.to_string())?;
    Ok("Connection successful".to_string())
}
