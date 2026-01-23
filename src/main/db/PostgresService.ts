/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from 'pg'
import { DbSchema, IDbResult, DbConnection, IDataRequest } from '../../shared/types'
import { IDbService } from './IDbService'

export class PostgresService implements IDbService {
  private client: Client | null = null

  async connect(config: DbConnection): Promise<string> {
    try {
      await this.disconnect()
      const connectionUri = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`
      this.client = new Client({ connectionString: connectionUri })
      await this.client.connect()
      return 'PostgreSQL Connected!'
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  async execute(sql: string): Promise<IDbResult> {
    const start = performance.now()
    try {
      if (!this.client) throw new Error('Not connected')
      const res = await this.client.query(sql)
      let rows: any[] = []
      let columns: string[] = []
      if (Array.isArray(res)) {
        for (let i = res.length - 1; i >= 0; i--) {
          const r = res[i]
          if (r.command === 'SELECT') {
            rows = r.rows
            columns = r.fields.map((f: any) => f.name)
            break
          }
        }
      } else {
        rows = res.rows
        columns = res.fields.map((f) => f.name)
      }
      return { rows, columns, duration: Math.round(performance.now() - start) }
    } catch (err: any) {
      return { rows: [], columns: [], duration: 0, error: err.message }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }

  // Для Postgres dbName — это Schema (public и т.д.)
  async getTables(dbName: string = 'public'): Promise<string[]> {
    if (!this.client) return []
    try {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name;
      `
      const res = await this.client.query(sql, [dbName])
      return res.rows.map((row) => row.table_name)
    } catch (e) {
      console.error('Error fetching tables:', e)
      return []
    }
  }

  // Возвращаем список схем. Это позволит дереву Сервер -> БД -> Таблицы работать корректно
  async getDatabases(): Promise<string[]> {
    if (!this.client) return []
    try {
      const sql = `SELECT schema_name FROM information_schema.schemata
                   WHERE schema_name NOT IN ('information_schema', 'pg_catalog')`
      const res = await this.client.query(sql)
      return res.rows.map((row) => row.schema_name)
    } catch (e) {
      console.error('Error fetching schemas:', e)
      return []
    }
  }

  async getSchema(): Promise<DbSchema> {
    if (!this.client) return {}
    const sql = `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `
    const res = await this.client.query(sql)
    const schema: DbSchema = {}
    for (const row of res.rows) {
      const tableName = row.table_name
      const colName = row.column_name
      if (!schema[tableName]) schema[tableName] = []
      schema[tableName].push(colName)
    }
    return schema
  }

  async getTableData(req: IDataRequest): Promise<IDbResult> {
    if (!this.client) return { rows: [], columns: [], duration: 0, error: 'Not connected' }
    try {
      // For Postgres, we check against the current search path, typically public
      // But getTables() is returning tables. We should verify.
      const tables = await this.getTables()
      if (!tables.includes(req.tableName)) {
        throw new Error(`Invalid table name: ${req.tableName}`)
      }

      const quoteChar = '"'
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
    if (!this.client) throw new Error('Not connected')
    await this.client.query(`SET search_path TO "${dbName}"`)
  }
}
