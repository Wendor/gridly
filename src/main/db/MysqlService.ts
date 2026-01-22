/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql from 'mysql2/promise'
import { DbSchema, IDbResult } from '../../shared/types'
import { IDbService } from './IDbService' // Импорт интерфейса

export class MysqlService implements IDbService {
  // <-- Добавили implements
  private connection: mysql.Connection | null = null

  async connect(connectionUri: string): Promise<string> {
    try {
      await this.disconnect() // Сначала отключаемся, если были подключены
      this.connection = await mysql.createConnection(connectionUri)
      console.log('MySQL Connected')
      return 'MySQL Connected!'
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  async execute(sql: string): Promise<IDbResult> {
    const start = performance.now()

    try {
      if (!this.connection) {
        throw new Error('Нет соединения с базой данных')
      }

      console.log('Executing SQL:', sql)

      // @ts-ignore: mysql2 types definitions are sometimes incorrect for array results
      const [rows, fields] = await this.connection.execute(sql)

      console.log('Rows found:', Array.isArray(rows) ? rows.length : 0)

      const columns = Array.isArray(fields) ? fields.map((f) => f.name) : []

      return {
        rows: Array.isArray(rows) ? rows : [],
        columns,
        duration: Math.round(performance.now() - start)
      }
    } catch (err: any) {
      console.error('Query error:', err)
      return {
        rows: [],
        columns: [],
        duration: 0,
        error: err.message || 'Неизвестная ошибка SQL'
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.connection) return []
    try {
      // show tables возвращает массив объектов, где ключ зависит от имени базы
      // RowDataPacket { Tables_in_mydb: 'users' }
      const [rows] = await this.connection.query('SHOW TABLES')

      // Превращаем хитрый объект в простой массив строк
      return (rows as any[]).map((row) => Object.values(row)[0] as string)
    } catch (e) {
      console.error('Error fetching tables:', e)
      return []
    }
  }

  async getSchema(): Promise<DbSchema> {
    if (!this.connection) return {}

    // В MySQL DATABASE() возвращает имя текущей БД
    const sql = `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `
    const [rows] = (await this.connection.execute(sql)) as any[]

    const schema: DbSchema = {}
    rows.forEach((row: any) => {
      // Ключи могут быть в разном регистре в зависимости от драйвера/настроек
      const tableName = row.TABLE_NAME || row.table_name
      const colName = row.COLUMN_NAME || row.column_name

      if (tableName && colName) {
        if (!schema[tableName]) {
          schema[tableName] = []
        }
        schema[tableName].push(colName)
      }
    })

    return schema
  }
}
