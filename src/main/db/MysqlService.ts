/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql from 'mysql2/promise'
import {
  DbSchema,
  IDbResult,
  DbConnection,
  IDataRequest,
  RowUpdate,
  UpdateResult
} from '../../shared/types'
import { IDbService } from './IDbService'

export class MysqlService implements IDbService {
  private connection: mysql.Connection | null = null

  async connect(config: DbConnection): Promise<string> {
    try {
      await this.disconnect()
      const connectionUri = `mysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`
      this.connection = await mysql.createConnection({
        uri: connectionUri,
        multipleStatements: true,
        dateStrings: true
      })
      return 'MySQL Connected!'
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  async execute(sql: string): Promise<IDbResult> {
    const start = performance.now()
    try {
      if (!this.connection) throw new Error('Нет соединения с базой данных')
      const [results, fields] = await this.connection.query(sql)
      let rows: any[] = []
      let columns: string[] = []

      if (Array.isArray(results) && results.length > 0 && Array.isArray(results[0])) {
        for (let i = results.length - 1; i >= 0; i--) {
          if (Array.isArray(results[i])) {
            rows = results[i] as any[]
            if (Array.isArray(fields)) {
              const currentFields = (fields as any[])[i]
              if (Array.isArray(currentFields)) {
                columns = currentFields.map((f: any) => f.name)
              }
            }
            break
          }
        }
      } else if (Array.isArray(results)) {
        rows = results
        if (Array.isArray(fields)) {
          columns = fields.map((f: any) => f.name)
        }
      }

      return {
        rows,
        columns,
        duration: Math.round(performance.now() - start)
      }
    } catch (err: any) {
      return { rows: [], columns: [], duration: 0, error: err.message }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }

  async getTables(dbName?: string): Promise<string[]> {
    if (!this.connection) return []
    try {
      const sql = dbName ? `SHOW TABLES FROM \`${dbName}\`` : 'SHOW TABLES'
      const [rows] = await this.connection.query(sql)
      return (rows as any[]).map((row) => Object.values(row)[0] as string)
    } catch (e) {
      console.error('Error fetching tables:', e)
      return []
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.connection) return []
    try {
      const [rows] = await this.connection.query('SHOW DATABASES')
      return (rows as any[]).map((row) => Object.values(row)[0] as string)
    } catch (e) {
      console.error('Error fetching databases:', e)
      return []
    }
  }

  async getSchema(dbName?: string): Promise<DbSchema> {
    if (!this.connection) return {}
    const queryDb = dbName ? `'${dbName}'` : 'DATABASE()'
    const sql = `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ${queryDb}
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `
    const [rows] = (await this.connection.execute(sql)) as any[]
    const schema: DbSchema = {}
    rows.forEach((row: any) => {
      const tableName = row.TABLE_NAME || row.table_name
      const colName = row.COLUMN_NAME || row.column_name
      if (tableName && colName) {
        if (!schema[tableName]) schema[tableName] = []
        schema[tableName].push(colName)
      }
    })
    return schema
  }

  async getTableData(req: IDataRequest): Promise<IDbResult> {
    if (!this.connection) return { rows: [], columns: [], duration: 0, error: 'Not connected' }
    try {
      const tables = await this.getTables()
      if (!tables.includes(req.tableName)) {
        throw new Error(`Invalid table name: ${req.tableName}`)
      }

      const quoteChar = '`'
      let sql = `SELECT * FROM ${quoteChar}${req.tableName}${quoteChar}`

      if (req.sort && req.sort.length > 0) {
        const orderClauses = req.sort.map((s) => {
          if (s.colId.includes(quoteChar)) {
            throw new Error(`Invalid column name: ${s.colId}`)
          }
          return `${quoteChar}${s.colId}${quoteChar} ${s.sort.toUpperCase()}`
        })
        sql += ` ORDER BY ${orderClauses.join(', ')}`
      }

      const limit = Number(req.limit)
      const offset = Number(req.offset)

      if (isNaN(limit) || isNaN(offset)) {
        throw new Error('Invalid limit/offset')
      }

      sql += ` LIMIT ${limit} OFFSET ${offset}`

      return await this.execute(sql)
    } catch (e: any) {
      return { rows: [], columns: [], error: e.message, duration: 0 }
    }
  }

  async setActiveDatabase(dbName: string): Promise<void> {
    if (!this.connection) throw new Error('Нет соединения с базой данных')
    await this.connection.query(`USE \`${dbName}\``)
  }

  async getPrimaryKeys(tableName: string): Promise<string[]> {
    if (!this.connection) return []
    try {
      const sql = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION;
      `
      const [rows] = await this.connection.query(sql, [tableName])
      return (rows as any[]).map((row) => row.COLUMN_NAME)
    } catch (e) {
      console.error('Error fetching primary keys:', e)
      return []
    }
  }

  async updateRows(updates: RowUpdate[]): Promise<UpdateResult> {
    if (!this.connection) {
      return { success: false, affectedRows: 0, error: 'Not connected' }
    }

    try {
      let totalAffected = 0

      for (const update of updates) {
        const { tableName, primaryKeys, changes } = update

        if (Object.keys(changes).length === 0) continue

        const setClauses: string[] = []
        const whereClauses: string[] = []
        const values: any[] = []

        for (const [col, val] of Object.entries(changes)) {
          setClauses.push(`\`${col}\` = ?`)
          values.push(val)
        }

        for (const [col, val] of Object.entries(primaryKeys)) {
          whereClauses.push(`\`${col}\` = ?`)
          values.push(val)
        }

        const sql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`

        const [result] = await this.connection.query(sql, values)
        totalAffected += (result as any).affectedRows || 0
      }

      return { success: true, affectedRows: totalAffected }
    } catch (e: any) {
      return { success: false, affectedRows: 0, error: e.message }
    }
  }

  async getDashboardMetrics(): Promise<import('../../shared/types').DashboardMetrics> {
    if (!this.connection) throw new Error('Not connected')

    // 1. Version
    const [verRows] = await this.connection.query("SHOW VARIABLES LIKE 'version'")
    const version = (verRows as any[])[0].Value

    // 2. Uptime
    const [upRows] = await this.connection.query("SHOW GLOBAL STATUS LIKE 'Uptime'")
    const uptimeSec = parseInt((upRows as any[])[0].Value)
    const uptime = this.formatDuration(uptimeSec * 1000)

    // 3. Active/Max Connections
    const [connRows] = await this.connection.query("SHOW STATUS LIKE 'Threads_connected'")
    const activeConnections = parseInt((connRows as any[])[0].Value) || 0

    const [maxConnRows] = await this.connection.query("SHOW VARIABLES LIKE 'max_connections'")
    const maxConnections = parseInt((maxConnRows as any[])[0].Value) || 151 // MySQL default

    // 4. DB Size
    // Note: This is an approximation for all databases. For specific DB, filter by table_schema
    const [sizeRows] = await this.connection.query(`
      SELECT SUM(data_length + index_length) / 1024 / 1024 as size_mb
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `)
    const sizeMb = parseFloat((sizeRows as any[])[0].size_mb || 0).toFixed(1)
    const dbSize = `${sizeMb} MB`

    // 5. Indexes Size
    const [idxRows] = await this.connection.query(`
      SELECT SUM(index_length) / 1024 / 1024 as size_mb
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `)
    const idxMb = parseFloat((idxRows as any[])[0].size_mb || 0).toFixed(1)
    const indexesSize = `${idxMb} MB`

    // 6. Table Count
    const [tblRows] = await this.connection.query(
      'SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()'
    )
    const tableCount = parseInt((tblRows as any[])[0].cnt) || 0

    // 7. Cache Hit Ratio (InnoDB Buffer Pool)
    const [readRows] = await this.connection.query(
      "SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%'"
    )
    // Map status rows to object
    const status: Record<string, number> = {}
    ;(readRows as any[]).forEach((r) => {
      status[r.Variable_name] = parseInt(r.Value)
    })

    const reads = status['Innodb_buffer_pool_reads'] || 0
    const requests = status['Innodb_buffer_pool_read_requests'] || 0
    // If requests is 0, we can say 100% or 0%. 1 is safer to assume "no misses".
    const cacheHitRatio = requests > 0 ? 1 - reads / requests : 1

    // 8. Top Queries
    const [procRows] = await this.connection.query('SHOW PROCESSLIST')
    const topQueries = (procRows as any[])
      .filter((r) => r.Command === 'Query' && r.Info && r.Id !== (this.connection as any).threadId)
      .sort((a, b) => b.Time - a.Time)
      .slice(0, 5)
      .map((r) => ({
        pid: r.Id,
        user: r.User,
        state: r.Command,
        duration: `${r.Time}s`,
        query: r.Info
      }))

    return {
      version,
      uptime,
      activeConnections,
      maxConnections,
      dbSize,
      indexesSize,
      tableCount,
      cacheHitRatio,
      topQueries
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}
