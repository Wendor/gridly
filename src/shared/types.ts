export interface DbConnection {
  type: 'mysql' | 'postgres'
  name: string
  host: string
  port: string
  user: string
  password?: string
  database: string
  useSsh?: boolean
  sshHost?: string
  sshPort?: string
  sshUser?: string
  sshPassword?: string
  sshKeyPath?: string
}

export interface IDbResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[]
  columns: string[]
  error?: string
  duration: number
}

export interface IDataRequest {
  tableName: string
  offset: number
  limit: number
  sort?: { colId: string; sort: 'asc' | 'desc' }[]
}

// НОВЫЙ ТИП: Схема базы данных для автокомплита
// Ключ = имя таблицы, Значение = массив имен колонок
export type DbSchema = Record<string, string[]>

export interface IElectronAPI {
  connect: (config: DbConnection) => Promise<string>
  query: (sql: string) => Promise<IDbResult>
  getTables: () => Promise<string[]>
  getTableData: (req: IDataRequest) => Promise<IDbResult>
  // НОВЫЙ МЕТОД
  getSchema: () => Promise<DbSchema>
}
