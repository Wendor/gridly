/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql from 'mysql2/promise'
import { DbSchema, IDbResult, DbConnection, IDataRequest } from '../../shared/types'
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

  // Исправлено: поддержка получения таблиц из конкретной БД
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

  // Новый метод: получение всех БД сервера
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

  async getSchema(): Promise<DbSchema> {
    if (!this.connection) return {}
    const sql = `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
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
}
