import { ipcMain } from 'electron'
import {
  RowUpdate,
  DbConnection,
  AppSettings,
  AppState,
  HistoryItem,
  IDataRequest
} from '../../shared/types'
import { DatabaseManager } from '../db/DatabaseManager'
import { StorageService } from '../services/StorageService'

export function setupIpcHandlers(dbManager: DatabaseManager, storageService: StorageService): void {
  // --- STORAGE HANDLERS ---

  ipcMain.handle('db:get-connections', async () => {
    return await storageService.getConnectionsMeta()
  })

  ipcMain.handle('db:save-connection', async (_event, connection: DbConnection) => {
    await storageService.saveConnection(connection)
  })

  ipcMain.handle('db:delete-connection', async (_event, id: string) => {
    await storageService.deleteConnection(id)
    await dbManager.disconnect(id)
  })

  ipcMain.handle('db:get-settings', async () => {
    return await storageService.getSettings()
  })

  ipcMain.handle('db:save-settings', async (_event, settings: AppSettings) => {
    await storageService.saveSettings(settings)
  })

  ipcMain.handle('db:get-state', async () => {
    return await storageService.getState()
  })

  ipcMain.handle('db:save-state', async (_event, state: AppState) => {
    await storageService.saveState(state)
  })

  ipcMain.handle('db:update-state', async (_event, updates: Partial<AppState>) => {
    await storageService.updateState(updates)
  })

  ipcMain.handle('db:get-history', async () => {
    return await storageService.getHistory()
  })

  ipcMain.handle('db:save-history', async (_event, history: HistoryItem[]) => {
    await storageService.saveHistory(history)
  })

  // --- DB CONNECTION HANDLERS ---

  // Connect now only takes ID, config is loaded from storage
  ipcMain.handle('db:connect', async (_event, id: string) => {
    const config = await storageService.getConnectionById(id)
    if (!config) {
      throw new Error(`Connection config for ID ${id} not found`)
    }
    return await dbManager.connect(id, config)
  })

  ipcMain.handle('db:disconnect', async (_event, id: string) => {
    await dbManager.disconnect(id)
  })

  ipcMain.handle(
    'db:test-connection',
    async (_event, config: DbConnection, connectionId?: string) => {
      let testConfig = config

      if (connectionId) {
        const existing = await storageService.getConnectionById(connectionId)
        if (existing) {
          testConfig = {
            ...config,
            password: config.password || existing.password,
            sshPassword: config.sshPassword || existing.sshPassword
          }
        }
      }

      return await dbManager.testConnection(testConfig)
    }
  )

  // --- QUERY HANDLERS ---

  ipcMain.handle('db:query', async (_event, { id, sql }: { id: string; sql: string }) => {
    try {
      return await dbManager.execute(id, sql)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  })

  ipcMain.handle(
    'db:get-tables',
    async (_event, { id, dbName }: { id: string; dbName?: string }) => {
      try {
        return await dbManager.getTables(id, dbName)
      } catch (e: unknown) {
        console.error(e)
        return []
      }
    }
  )

  ipcMain.handle(
    'db:get-table-data',
    async (_event, { connectionId, req }: { connectionId: string; req: IDataRequest }) => {
      return await dbManager.getTableData(connectionId, req)
    }
  )

  ipcMain.handle(
    'db:get-schema',
    async (_event, { id, dbName }: { id: string; dbName?: string }) => {
      return await dbManager.getSchema(id, dbName)
    }
  )

  ipcMain.handle(
    'db:get-databases',
    async (_event, { id, excludeList }: { id: string; excludeList?: string }) => {
      return await dbManager.getDatabases(id, excludeList)
    }
  )

  ipcMain.handle(
    'db:set-active-database',
    async (_event, { id, dbName }: { id: string; dbName: string }) => {
      await dbManager.setActiveDatabase(id, dbName)
    }
  )

  ipcMain.handle(
    'db:get-primary-keys',
    async (_event, { id, tableName }: { id: string; tableName: string }) => {
      try {
        return await dbManager.getPrimaryKeys(id, tableName)
      } catch (e: unknown) {
        console.error(e)
        return []
      }
    }
  )

  ipcMain.handle(
    'db:update-rows',
    async (_event, { id, updates }: { id: string; updates: unknown[] }) => {
      try {
        return await dbManager.updateRows(id, updates as RowUpdate[])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { success: false, affectedRows: 0, error: msg }
      }
    }
  )

  ipcMain.handle('db:get-dashboard-metrics', async (_event, { id }: { id: string }) => {
    try {
      return await dbManager.getDashboardMetrics(id)
    } catch (e: unknown) {
      console.error(e)
      return null
    }
  })
}
