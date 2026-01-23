import { ElectronAPI } from '@electron-toolkit/preload'
import { DbConnection, IDbResult, IDataRequest, DbSchema } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    dbApi: {
      // connect теперь принимает id
      connect: (id: number, config: DbConnection) => Promise<string>
      // query теперь принимает id
      query: (id: number, sql: string) => Promise<IDbResult>
      // getTables теперь принимает id
      getTables: (id: number, dbName?: string) => Promise<string[]>
      // getTableData теперь принимает connectionId
      getTableData: (connectionId: number, req: IDataRequest) => Promise<IDbResult>
      getDatabases: (id: number, excludeList?: string) => Promise<string[]>
      // getSchema теперь принимает id
      getSchema: (id: number) => Promise<DbSchema>
      testConnection: (config: DbConnection) => Promise<string>
    }
  }
}
