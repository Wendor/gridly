import {
  DbConnection,
  IDbResult,
  DbSchema,
  IDataRequest,
  RowUpdate,
  UpdateResult
} from '../../shared/types'
import { IDbService } from './IDbService'
import { MysqlService } from './MysqlService'
import { PostgresService } from './PostgresService'
import { SshTunnelService } from './SshTunnelService'

export class DatabaseManager {
  // Карта активных сервисов: connectionId -> Service
  private services: Map<string, IDbService> = new Map()
  // Карта SSH туннелей: connectionId -> SshService
  private sshServices: Map<string, SshTunnelService> = new Map()

  private getService(id: string): IDbService {
    const service = this.services.get(id)
    if (!service) {
      throw new Error(`Connection with ID ${id} not found or not active`)
    }
    return service
  }

  async connect(id: string, config: DbConnection): Promise<string> {
    try {
      // Если для этого ID уже есть соединение — разрываем его перед новым
      await this.disconnect(id)

      const activeConfig = { ...config }

      // Обработка SSH
      if (config.useSsh && config.sshHost && config.sshPort && config.sshUser) {
        console.log(`[Conn ${id}] Starting SSH Tunnel...`)
        const sshService = new SshTunnelService()

        const localPort = await sshService.createTunnel(
          {
            host: config.sshHost,
            port: parseInt(config.sshPort),
            username: config.sshUser,
            password: config.sshPassword,
            privateKeyPath: config.sshKeyPath
          },
          { host: config.host, port: parseInt(config.port) }
        )

        // Сохраняем SSH сервис для этого ID
        this.sshServices.set(id, sshService)

        activeConfig.host = '127.0.0.1'
        activeConfig.port = localPort.toString()
      }

      let newService: IDbService
      if (config.type === 'mysql') {
        newService = new MysqlService()
      } else {
        newService = new PostgresService()
      }

      console.log(
        `[Conn ${id}] Connecting to DB (${config.type}) via ${activeConfig.host}:${activeConfig.port}...`
      )
      const result = await newService.connect(activeConfig)

      // Сохраняем активный сервис
      this.services.set(id, newService)

      return result
    } catch (e: unknown) {
      console.error(`[Conn ${id}] Connection error:`, e)
      // В случае ошибки чистим SSH если он был создан
      await this.disconnect(id)
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(msg)
    }
  }

  async disconnect(id: string): Promise<void> {
    // Отключаем БД
    const service = this.services.get(id)
    if (service) {
      await service.disconnect()
      this.services.delete(id)
    }

    // Закрываем SSH туннель
    const sshService = this.sshServices.get(id)
    if (sshService) {
      sshService.close()
      this.sshServices.delete(id)
    }
  }

  // Закрыть ВСЕ соединения (при выходе)
  async disconnectAll(): Promise<void> {
    for (const id of this.services.keys()) {
      await this.disconnect(id)
    }
  }

  async execute(id: string, sql: string): Promise<IDbResult> {
    const result = await this.getService(id).execute(sql)
    return this.processResult(result)
  }

  private processResult(result: IDbResult): IDbResult {
    const processValue = (val: unknown): unknown => {
      if (val === null || val === undefined) return val
      if (val instanceof Date) {
        return `${val.toISOString()}`
      }
      if (typeof val === 'string') {
        return val.length > 512
          ? { __isWrapped: true, display: val.substring(0, 512) + '...', raw: val }
          : val
      }
      if (Buffer.isBuffer(val)) {
        return { __isWrapped: true, display: '(binary)', raw: val }
      }
      return val
    }

    const newRows = result.rows.map((row) => {
      if (Array.isArray(row)) {
        return row.map(processValue)
      } else if (typeof row === 'object' && row !== null) {
        const newRow: Record<string, unknown> = {}
        for (const k in row) {
          newRow[k] = processValue((row as Record<string, unknown>)[k])
        }
        return newRow
      }
      return row
    })

    return { ...result, rows: newRows }
  }

  async getSchema(id: string, dbName?: string): Promise<DbSchema> {
    return await this.getService(id).getSchema(dbName)
  }

  // Тест соединения остается без изменений, так как он создает временные сервисы
  async testConnection(config: DbConnection): Promise<string> {
    let tempService: IDbService | null = null
    const sshService = new SshTunnelService()

    try {
      const activeConfig = { ...config }

      if (config.useSsh && config.sshHost && config.sshPort && config.sshUser) {
        const localPort = await sshService.createTunnel(
          {
            host: config.sshHost,
            port: parseInt(config.sshPort),
            username: config.sshUser,
            password: config.sshPassword,
            privateKeyPath: config.sshKeyPath
          },
          { host: config.host, port: parseInt(config.port) }
        )
        activeConfig.host = '127.0.0.1'
        activeConfig.port = localPort.toString()
      }

      if (config.type === 'mysql') {
        tempService = new MysqlService()
      } else {
        tempService = new PostgresService()
      }

      const result = await tempService.connect(activeConfig)
      await tempService.disconnect()
      sshService.close()
      return result
    } catch (e: unknown) {
      if (tempService) await tempService.disconnect()
      sshService.close()
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(msg)
    }
  }

  async getTables(id: string, dbName?: string): Promise<string[]> {
    const service = this.getService(id)
    return await service.getTables(dbName)
  }

  async getTableData(connectionId: string, req: IDataRequest): Promise<IDbResult> {
    try {
      const service = this.getService(connectionId)
      // Check tables (security check still useful here, or move entirely to service?)
      // Service now handles it.
      const result = await service.getTableData(req)
      return this.processResult(result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  }

  async getDatabases(id: string, excludeList?: string): Promise<string[]> {
    const service = this.getService(id)
    const allDbs = await service.getDatabases()

    // Если список пуст, возвращаем всё
    if (!excludeList || !excludeList.trim()) return allDbs

    // Превращаем строку "db1, db2" в массив ["db1", "db2"] в нижнем регистре
    const excluded = excludeList
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0)

    // Фильтруем
    return allDbs.filter((db) => !excluded.includes(db.toLowerCase()))
  }

  async setActiveDatabase(id: string, dbName: string): Promise<void> {
    const service = this.getService(id)
    await service.setActiveDatabase(dbName)
  }

  async getPrimaryKeys(id: string, tableName: string): Promise<string[]> {
    const service = this.getService(id)
    return await service.getPrimaryKeys(tableName)
  }

  async updateRows(id: string, updates: RowUpdate[]): Promise<UpdateResult> {
    const service = this.getService(id)
    return await service.updateRows(updates)
  }

  async getDashboardMetrics(id: string): Promise<import('../../shared/types').DashboardMetrics> {
    const service = this.getService(id)
    return await service.getDashboardMetrics()
  }
}
