import { IDbResult, DbSchema } from '../../shared/types'

export interface IDbService {
  connect(connString: string): Promise<string>
  execute(sql: string): Promise<IDbResult>
  disconnect(): Promise<void>
  getTables(dbName?: string): Promise<string[]>
  getDatabases(): Promise<string[]>
  getSchema(): Promise<DbSchema>
}
