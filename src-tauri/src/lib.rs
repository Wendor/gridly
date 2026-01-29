mod commands;
pub mod db;
pub mod error;
pub mod models;
mod storage;

use commands::*;
use db::DatabaseManager;
use storage::StorageService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let storage = StorageService::new();
    let db = DatabaseManager::new();
    let app_state = TauriState { storage, db };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            connect,
            disconnect,
            test_connection,
            get_connections,
            save_connection,
            delete_connection,
            get_settings,
            save_settings,
            get_state,
            save_state,
            update_state,
            get_history,
            save_history,
            query,
            export_query,
            cancel_query,
            get_tables,
            get_databases,
            get_table_data,
            get_schema,
            get_primary_keys,
            update_rows,
            set_active_database,
            get_dashboard_metrics,
            get_schema_cache,
            save_schema_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
