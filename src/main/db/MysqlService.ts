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
      this.connection = await mysql.createConnection({
        uri: connectionUri,
        multipleStatements: true
      })
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

      // @ts-ignore: execute signatures are complex and return type inference needs help
      const [results, fields] = await this.connection.query(sql)

      console.log('Results type:', typeof results, 'IsArray:', Array.isArray(results))
      console.log('Fields type:', typeof fields, 'IsArray:', Array.isArray(fields))

      // Если это массив результатов (multistatement)
      // Мы берем ПОСЛЕДНИЙ результат, который является массивом (т.е. SELECT, а не OkPacket)
      let rows: any[] = []
      let columns: string[] = []

      if (Array.isArray(results) && results.length > 0 && Array.isArray(results[0])) {
        console.log('Handling multiple statements')
        // Найдем последний SELECT результат
        for (let i = results.length - 1; i >= 0; i--) {
          console.log(
            `Checking result ${i}: type=${typeof results[i]}, isArray=${Array.isArray(results[i])}`
          )
          if (Array.isArray(results[i])) {
            rows = results[i] as any[]

            // Safe fields access
            if (Array.isArray(fields)) {
              const currentFields = (fields as any[])[i]
              console.log(
                `Checking fields ${i}: type=${typeof currentFields}, isArray=${Array.isArray(currentFields)}`
              )

              if (Array.isArray(currentFields)) {
                columns = currentFields.map((f: any) => f.name)
              }
            }
            break
          }
        }
      } else if (Array.isArray(results)) {
        console.log('Handling single statement')
        // Одиночный SELECT
        rows = results
        if (Array.isArray(fields)) {
          columns = fields.map((f: any) => f.name)
        }
      }
      // Если это OkPacket (INSERT/UPDATE), rows останется [], columns []

      console.log('Rows found:', rows.length)

      return {
        rows,
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
