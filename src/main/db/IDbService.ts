import { IDbResult } from '../../shared/types'

export interface IDbService {
  connect(connString: string): Promise<string>
  execute(sql: string): Promise<IDbResult>
  disconnect(): Promise<void>
  // НОВЫЙ МЕТОД
  getTables(): Promise<string[]>
}
