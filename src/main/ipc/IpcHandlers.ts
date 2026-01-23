import { ipcMain } from 'electron'
import { DatabaseManager } from '../db/DatabaseManager'
import { DbConnection, IDataRequest } from '../../shared/types'

export function setupIpcHandlers(dbManager: DatabaseManager): void {
  // Принимаем { id, config }
  ipcMain.handle(
    'db:connect',
    async (_event, { id, config }: { id: number; config: DbConnection }) => {
      return await dbManager.connect(id, config)
    }
  )

  // Принимаем { id, sql }
  ipcMain.handle('db:query', async (_event, { id, sql }: { id: number; sql: string }) => {
    try {
      return await dbManager.execute(id, sql)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  })

  // Принимаем просто id
  ipcMain.handle(
    'db:get-tables',
    async (_event, { id, dbName }: { id: number; dbName?: string }) => {
      try {
        return await dbManager.getTables(id, dbName)
      } catch (e: unknown) {
        console.error(e)
        return []
      }
    }
  )

  // Сложный запрос данных
  ipcMain.handle(
    'db:get-table-data',
    async (_event, { connectionId, req }: { connectionId: number; req: IDataRequest }) => {
      // Logic moved to DatabaseManager
      return await dbManager.getTableData(connectionId, req)
    }
  )

  ipcMain.handle('db:get-schema', async (_event, id: number) => {
    return await dbManager.getSchema(id)
  })

  // Тест соединения не требует ID, так как оно временное
  ipcMain.handle('db:test-connection', async (_event, config: DbConnection) => {
    return await dbManager.testConnection(config)
  })

  ipcMain.handle(
    'db:get-databases',
    async (_event, { id, excludeList }: { id: number; excludeList?: string }) => {
      return await dbManager.getDatabases(id, excludeList)
    }
  )

  ipcMain.handle(
    'db:set-active-database',
    async (_event, { id, dbName }: { id: number; dbName: string }) => {
      await dbManager.setActiveDatabase(id, dbName)
    }
  )
}
