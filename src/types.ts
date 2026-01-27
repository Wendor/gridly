export interface DbConnection {
  id: string
  type: 'mysql' | 'postgres' | 'clickhouse'
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

export interface DbConnectionMeta {
  id: string
  type: 'mysql' | 'postgres' | 'clickhouse'
  name: string
  host: string
  port: string
  user: string
  database: string
  excludeList?: string
  useSsh?: boolean
  sshHost?: string
  sshPort?: string
  sshUser?: string
  sshKeyPath?: string
}

export interface AppSettings {
  theme: string
  locale: string
  fontSize: number
}

export interface HistoryItem {
  id: string
  sql: string
  connectionId: string | null
  timestamp: number
  status: 'success' | 'error'
  duration: number
}

export interface SerializableQueryTab {
  id: number
  type: 'query'
  name: string
  connectionId: string | null
  database: string | null
  sql: string
  tableName: string | null
}

export interface SerializableSettingsTab {
  id: number
  type: 'settings'
  name: string
}

export interface SerializableDocumentTab {
  id: number
  type: 'document'
  name: string
  content: string
}

export interface SerializableDashboardTab {
  id: number
  type: 'dashboard'
  name: string
  connectionId: string
}

export type SerializableTab =
  | SerializableQueryTab
  | SerializableSettingsTab
  | SerializableDocumentTab
  | SerializableDashboardTab

export interface AppState {
  tabs: {
    openTabs: SerializableTab[]
    activeTabId: number | null
    nextTabId: number
  }
  ui: {
    sidebarWidth: number
    editorHeight: number
    expandedConnections: string[]
    expandedDatabases: string[]
    sidebarScrollPosition: number
  }
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

export interface ITauriAPI {
  // Connections
  connect: (id: string) => Promise<string>
  disconnect: (id: string) => Promise<void>
  testConnection: (config: DbConnection, connectionId?: string) => Promise<string>

  // Storage
  getConnections: () => Promise<DbConnectionMeta[]>
  saveConnection: (connection: DbConnection) => Promise<void>
  deleteConnection: (id: string) => Promise<void>

  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>

  getState: () => Promise<AppState>
  saveState: (state: AppState) => Promise<void>
  updateState: (updates: Partial<AppState>) => Promise<void>

  getHistory: () => Promise<HistoryItem[]>
  saveHistory: (history: HistoryItem[]) => Promise<void>

  // Queries
  execute: (id: string, sql: string, queryId?: string) => Promise<IDbResult>
  cancelQuery: (id: string, queryId: string) => Promise<void>
  getTables: (id: string, dbName?: string) => Promise<string[]>
  getDatabases: (id: string, excludeList?: string) => Promise<string[]>
  getTableData: (connectionId: string, req: IDataRequest) => Promise<IDbResult>
  getSchema: (id: string, dbName?: string) => Promise<DbSchema>
  getPrimaryKeys: (id: string, tableName: string) => Promise<string[]>
  updateRows: (id: string, updates: RowUpdate[]) => Promise<UpdateResult>
  setActiveDatabase: (id: string, dbName: string) => Promise<void>
  getDashboardMetrics: (id: string) => Promise<DashboardMetrics | null>

  // Schema Cache
  getSchemaCache: () => Promise<AppSchemaCache>
  saveSchemaCache: (cache: AppSchemaCache) => Promise<void>
}

export interface AppSchemaCache {
  databases: Record<string, string[]>
  tables: Record<string, string[]>
  schemas: Record<string, DbSchema>
}

export interface WrappedDbValue {
  __isWrapped: true
  display: string
  raw: unknown
}

export function isWrappedValue(val: unknown): val is WrappedDbValue {
  return typeof val === 'object' && val !== null && (val as WrappedDbValue).__isWrapped === true;
}

export interface DashboardMetrics {
  version: string
  uptime: number
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
