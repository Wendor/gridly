export interface DbConnection {
  type: 'mysql' | 'postgres'
  name: string
  host: string
  port: string
  user: string
  password?: string
  database: string
  excludeList?: string
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
  connect: (id: number, config: DbConnection) => Promise<string>
  query: (id: number, sql: string) => Promise<IDbResult>
  getTables: (id: number, dbName?: string) => Promise<string[]>
  // ОБНОВЛЕНО: теперь принимает два аргумента
  getDatabases: (id: number, excludeList?: string) => Promise<string[]>
  getTableData: (req: IDataRequest) => Promise<IDbResult>
  getSchema: (id: number) => Promise<DbSchema>
  testConnection: (config: DbConnection) => Promise<string>
}
export interface WrappedDbValue {
  __isWrapped: true
  display: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isWrappedValue(val: any): val is WrappedDbValue {
  return typeof val === 'object' && val !== null && val.__isWrapped === true
}
