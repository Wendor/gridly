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
  rows: unknown[]
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

export interface RowUpdate {
  tableName: string
  primaryKeys: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface UpdateResult {
  success: boolean
  affectedRows: number
  error?: string
}

export interface IElectronAPI {
  connect: (id: number, config: DbConnection) => Promise<string>
  query: (id: number, sql: string) => Promise<IDbResult>
  getTables: (id: number, dbName?: string) => Promise<string[]>
  getDatabases: (id: number, excludeList?: string) => Promise<string[]>
  getTableData: (req: IDataRequest) => Promise<IDbResult>
  getSchema: (id: number) => Promise<DbSchema>
  testConnection: (config: DbConnection) => Promise<string>
  getPrimaryKeys: (id: number, tableName: string) => Promise<string[]>
  updateRows: (id: number, updates: RowUpdate[]) => Promise<UpdateResult>
  setActiveDatabase: (id: number, dbName: string) => Promise<void>
  getDashboardMetrics: (id: number) => Promise<DashboardMetrics | null>
}
export interface WrappedDbValue {
  __isWrapped: true
  display: string
  raw: unknown
}

export function isWrappedValue(val: unknown): val is WrappedDbValue {
  return typeof val === 'object' && val !== null && (val as WrappedDbValue).__isWrapped === true
}

export interface DashboardMetrics {
  version: string
  uptime: string
  activeConnections: number
  maxConnections: number
  dbSize: string
  indexesSize: string
  tableCount: number
  cacheHitRatio: number
  topQueries: Array<{
    pid: number
    user: string
    state: string
    duration: string
    query: string
  }>
}
