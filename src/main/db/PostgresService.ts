/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from 'pg'
import { DbSchema, IDbResult } from '../../shared/types'
import { IDbService } from './IDbService'

export class PostgresService implements IDbService {
  private client: Client | null = null

  async connect(connectionUri: string): Promise<string> {
    try {
      await this.disconnect()

      // pg требует строку вида postgresql://...
      // Если пришло postgres://, заменим для совместимости
      const validUri = connectionUri.startsWith('postgres://')
        ? connectionUri.replace('postgres://', 'postgresql://')
        : connectionUri

      this.client = new Client({ connectionString: validUri })
      await this.client.connect()
      console.log('PG Connected')
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

      // Формат ответа у PG отличается от MySQL
      return {
        rows: res.rows,
        columns: res.fields.map((f) => f.name),
        duration: Math.round(performance.now() - start)
      }
    } catch (err: any) {
      return {
        rows: [],
        columns: [],
        duration: 0,
        error: err.message
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.client) return []
    try {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `
      const res = await this.client.query(sql)
      return res.rows.map((row) => row.table_name)
    } catch (e) {
      console.error('Error fetching tables:', e)
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

    // Преобразуем плоский список в объект { users: ['id', 'name'], ... }
    const schema: DbSchema = {}
    for (const row of res.rows) {
      const tableName = row.table_name
      const colName = row.column_name

      if (!schema[tableName]) {
        schema[tableName] = []
      }
      schema[tableName].push(colName)
    }

    return schema
  }
}
