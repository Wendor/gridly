import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { DbConnection, IDataRequest, AppSettings, AppState, HistoryItem } from '../shared/types'

const dbApi = {
  // Connections
  connect: (id: string): Promise<string> => {
    return ipcRenderer.invoke('db:connect', id)
  },
  disconnect: (id: string): Promise<void> => {
    return ipcRenderer.invoke('db:disconnect', id)
  },
  testConnection: (config: DbConnection, connectionId?: string) => {
    return ipcRenderer.invoke('db:test-connection', config, connectionId)
  },

  // Storage
  getConnections: (): Promise<DbConnection[]> => ipcRenderer.invoke('db:get-connections'),
  saveConnection: (connection: DbConnection) =>
    ipcRenderer.invoke('db:save-connection', connection),
  deleteConnection: (id: string) => ipcRenderer.invoke('db:delete-connection', id),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('db:get-settings'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('db:save-settings', settings),

  getState: (): Promise<AppState> => ipcRenderer.invoke('db:get-state'),
  saveState: (state: AppState) => ipcRenderer.invoke('db:save-state', state),
  updateState: (updates: Partial<AppState>) => ipcRenderer.invoke('db:update-state', updates),

  getHistory: (): Promise<HistoryItem[]> => ipcRenderer.invoke('db:get-history'),
  saveHistory: (history: HistoryItem[]) => ipcRenderer.invoke('db:save-history', history),

  // Queries
  query: (id: string, sql: string) => {
    return ipcRenderer.invoke('db:query', { id, sql })
  },
  getTables: (id: string, dbName?: string) => ipcRenderer.invoke('db:get-tables', { id, dbName }),
  getDatabases: (id: string, excludeList?: string) =>
    ipcRenderer.invoke('db:get-databases', { id, excludeList }),
  getTableData: (connectionId: string, req: IDataRequest) => {
    return ipcRenderer.invoke('db:get-table-data', { connectionId, req })
  },
  getSchema: (id: string, dbName?: string) => {
    return ipcRenderer.invoke('db:get-schema', { id, dbName })
  },
  setActiveDatabase: (id: string, dbName: string) => {
    return ipcRenderer.invoke('db:set-active-database', { id, dbName })
  },
  getPrimaryKeys: (id: string, tableName: string) => {
    return ipcRenderer.invoke('db:get-primary-keys', { id, tableName })
  },
  updateRows: (id: string, updates: unknown[]) => {
    return ipcRenderer.invoke('db:update-rows', { id, updates })
  },
  getDashboardMetrics: (id: string) => {
    return ipcRenderer.invoke('db:get-dashboard-metrics', { id })
  }
}

// Экспортируем API в renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('dbApi', dbApi)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as unknown as { electron: typeof electronAPI; dbApi: typeof dbApi }).electron =
    electronAPI
  ;(window as unknown as { electron: typeof electronAPI; dbApi: typeof dbApi }).dbApi = dbApi
}
