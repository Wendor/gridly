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
  ipcMain.handle('db:get-tables', async (_event, id: number) => {
    try {
      const tables = await dbManager.getTables(id)
      return tables.sort()
    } catch (e: unknown) {
      console.error(e)
      return []
    }
  })

  // Сложный запрос данных
  ipcMain.handle(
    'db:get-table-data',
    async (_event, { connectionId, req }: { connectionId: number; req: IDataRequest }) => {
      try {
        // SECURITY: Validate tableName
        const tables = await dbManager.getTables(connectionId)
        if (!tables.includes(req.tableName)) {
          throw new Error(`Invalid table name: ${req.tableName}`)
        }

        // SECURITY: Construct SQL safely
        // We use string concatenation because we need dynamic identifiers (table/col)
        // which parameterization (usually) doesn't support for table/col names.
        // But we validated tableName against the system catalog.

        let sql = `SELECT * FROM "${req.tableName}"`

        const isPostgres = dbManager.isPostgres(connectionId)
        const quoteChar = isPostgres ? '"' : '`'

        // Re-quote table name with correct char
        sql = `SELECT * FROM ${quoteChar}${req.tableName}${quoteChar}`

        if (req.sort && req.sort.length > 0) {
          const orderClauses = req.sort.map((s) => {
            // SECURITY: Basic sanitization for column names
            // Ensure no quote chars that could break out
            if (s.colId.includes(quoteChar)) {
              throw new Error(`Invalid column name: ${s.colId}`)
            }
            return `${quoteChar}${s.colId}${quoteChar} ${s.sort.toUpperCase()}`
          })
          sql += ` ORDER BY ${orderClauses.join(', ')}`
        }

        // SECURITY: limit/offset are numbers in TypeScript interface
        // ensure they are numbers at runtime to be sure
        const limit = Number(req.limit)
        const offset = Number(req.offset)

        if (isNaN(limit) || isNaN(offset)) {
          throw new Error('Invalid limit/offset')
        }

        sql += ` LIMIT ${limit} OFFSET ${offset}`

        return await dbManager.execute(connectionId, sql)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { rows: [], columns: [], error: msg, duration: 0 }
      }
    }
  )

  ipcMain.handle('db:get-schema', async (_event, id: number) => {
    return await dbManager.getSchema(id)
  })

  // Тест соединения не требует ID, так как оно временное
  ipcMain.handle('db:test-connection', async (_event, config: DbConnection) => {
    return await dbManager.testConnection(config)
  })
}
