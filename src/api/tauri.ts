import { invoke } from '@tauri-apps/api/core';
import type {
  ITauriAPI,
  DbConnection,
  AppSettings,
  AppState,
  HistoryItem,
  IDataRequest,
  RowUpdate,
} from '../types';

export const tauriApi: ITauriAPI = {
  // Connections
  connect: (id: string) => invoke('connect', { id }),
  disconnect: (id: string) => invoke('disconnect', { id }),
  testConnection: (config: DbConnection, connectionId?: string) =>
    invoke('test_connection', { config, connectionId }),

  // Storage
  getConnections: () => invoke('get_connections'),
  saveConnection: (connection: DbConnection) => invoke('save_connection', { connection }),
  deleteConnection: (id: string) => invoke('delete_connection', { id }),

  getSettings: () => invoke('get_settings'),
  saveSettings: (settings: AppSettings) => invoke('save_settings', { settings }),

  getState: () => invoke('get_state'),
  saveState: (state: AppState) => invoke('save_state', { state }),
  updateState: (updates: Partial<AppState>) => invoke('update_state', { updates }),

  getHistory: () => invoke('get_history'),
  saveHistory: (history: HistoryItem[]) => invoke('save_history', { history }),

  // Queries
  query: (id: string, sql: string) => invoke('query', { id, sql }),
  getTables: (id: string, dbName?: string) => invoke('get_tables', { id, dbName }),
  getDatabases: (id: string, excludeList?: string) => invoke('get_databases', { id, excludeList }),
  getTableData: (connectionId: string, req: IDataRequest) =>
    invoke('get_table_data', { connectionId, req }),
  getSchema: (id: string, dbName?: string) => invoke('get_schema', { id, dbName }),
  getPrimaryKeys: (id: string, tableName: string) => invoke('get_primary_keys', { id, tableName }),
  updateRows: (id: string, updates: RowUpdate[]) => invoke('update_rows', { id, updates }),
  setActiveDatabase: (id: string, dbName: string) => invoke('set_active_database', { id, dbName }),
  getDashboardMetrics: (id: string) => invoke('get_dashboard_metrics', { id }),
};
