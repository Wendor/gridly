import { IDbResult, DbSchema, DbConnection, IDataRequest } from '../../shared/types'

export interface IDbService {
  connect(config: DbConnection): Promise<string>
  execute(sql: string): Promise<IDbResult>
  disconnect(): Promise<void>
  getTables(dbName?: string): Promise<string[]>
  getDatabases(): Promise<string[]>
  getSchema(): Promise<DbSchema>
  getTableData(req: IDataRequest): Promise<IDbResult>
  setActiveDatabase(dbName: string): Promise<void>
}
