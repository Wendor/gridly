import { ElectronAPI } from '@electron-toolkit/preload'
import { DbConnection, IDbResult, IDataRequest, DbSchema, DashboardMetrics } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    dbApi: {
      // connect теперь принимает id
      connect: (id: number, config: DbConnection) => Promise<string>
      disconnect: (id: number) => Promise<void>
      // query теперь принимает id
      query: (id: number, sql: string) => Promise<IDbResult>
      // getTables теперь принимает id
      getTables: (id: number, dbName?: string) => Promise<string[]>
      // getTableData теперь принимает connectionId
      getTableData: (connectionId: number, req: IDataRequest) => Promise<IDbResult>
      getDatabases: (id: number, excludeList?: string) => Promise<string[]>
      // getSchema теперь принимает id и dbName
      getSchema: (id: number, dbName?: string) => Promise<DbSchema>
      testConnection: (config: DbConnection) => Promise<string>
      setActiveDatabase: (id: number, dbName: string) => Promise<void>
      getPrimaryKeys: (id: number, tableName: string) => Promise<string[]>
      updateRows: (id: number, updates: unknown[]) => Promise<unknown>
      getDashboardMetrics: (id: number) => Promise<DashboardMetrics | null>
    }
  }
}
