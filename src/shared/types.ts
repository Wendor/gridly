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

// ЭТОТ ИНТЕРФЕЙС БЫЛ ПОТЕРЯН, ДОБАВЬТЕ ЕГО:
export interface IDataRequest {
  tableName: string
  offset: number
  limit: number
  sort?: { colId: string; sort: 'asc' | 'desc' }[]
}

export interface IElectronAPI {
  connect: (config: DbConnection) => Promise<string>
  query: (sql: string) => Promise<IDbResult>
  getTables: () => Promise<string[]>
  getTableData: (req: IDataRequest) => Promise<IDbResult>
}
