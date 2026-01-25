import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { DbConnection, IDataRequest } from '../shared/types'

const dbApi = {
  connect: (id: number, config: DbConnection): Promise<string> => {
    return ipcRenderer.invoke('db:connect', { id, config })
  },
  query: (id: number, sql: string) => {
    return ipcRenderer.invoke('db:query', { id, sql })
  },
  getTables: (id: number, dbName?: string) => ipcRenderer.invoke('db:get-tables', { id, dbName }),
  getDatabases: (id: number, excludeList?: string) =>
    ipcRenderer.invoke('db:get-databases', { id, excludeList }),
  getTableData: (connectionId: number, req: IDataRequest) => {
    return ipcRenderer.invoke('db:get-table-data', { connectionId, req })
  },
  getSchema: (id: number) => {
    return ipcRenderer.invoke('db:get-schema', id)
  },
  testConnection: (config: DbConnection) => {
    return ipcRenderer.invoke('db:test-connection', config)
  },
  setActiveDatabase: (id: number, dbName: string) => {
    return ipcRenderer.invoke('db:set-active-database', { id, dbName })
  },
  getPrimaryKeys: (id: number, tableName: string) => {
    return ipcRenderer.invoke('db:get-primary-keys', { id, tableName })
  },
  updateRows: (id: number, updates: unknown[]) => {
    return ipcRenderer.invoke('db:update-rows', { id, updates })
  },
  getDashboardMetrics: (id: number) => {
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
  // @ts-ignore (define in d.ts)
  window.electron = electronAPI
  // @ts-ignore (define in d.ts)
  window.dbApi = dbApi
}
