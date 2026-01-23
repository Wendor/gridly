import { DbConnection, IDbResult, DbSchema, IDataRequest } from '../../shared/types'
import { IDbService } from './IDbService'
import { MysqlService } from './MysqlService'
import { PostgresService } from './PostgresService'
import { SshTunnelService } from './SshTunnelService'

export class DatabaseManager {
  // Карта активных сервисов: connectionId -> Service
  private services: Map<number, IDbService> = new Map()
  // Карта SSH туннелей: connectionId -> SshService
  private sshServices: Map<number, SshTunnelService> = new Map()

  private getService(id: number): IDbService {
    const service = this.services.get(id)
    if (!service) {
      throw new Error(`Connection with ID ${id} not found or not active`)
    }
    return service
  }

  async connect(id: number, config: DbConnection): Promise<string> {
    try {
      // Если для этого ID уже есть соединение — разрываем его перед новым
      await this.disconnect(id)

      let dbHost = config.host
      let dbPort = parseInt(config.port)
      const user = config.user
      const password = config.password
      const database = config.database
      const type = config.type

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
          { host: dbHost, port: dbPort }
        )

        // Сохраняем SSH сервис для этого ID
        this.sshServices.set(id, sshService)

        dbHost = '127.0.0.1'
        dbPort = localPort
      }

      const protocol = type === 'postgres' ? 'postgresql' : 'mysql'
      const connStr = `${protocol}://${user}:${password}@${dbHost}:${dbPort}/${database}`

      let newService: IDbService
      if (type === 'mysql') {
        newService = new MysqlService()
      } else {
        newService = new PostgresService()
      }

      console.log(`[Conn ${id}] Connecting to DB (${type}) via ${dbHost}:${dbPort}...`)
      const result = await newService.connect(connStr)

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

  async disconnect(id: number): Promise<void> {
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

  async execute(id: number, sql: string): Promise<IDbResult> {
    return await this.getService(id).execute(sql)
  }

  async getSchema(id: number): Promise<DbSchema> {
    return await this.getService(id).getSchema()
  }

  isPostgres(id: number): boolean {
    const service = this.services.get(id)
    return service instanceof PostgresService
  }

  // Тест соединения остается без изменений, так как он создает временные сервисы
  async testConnection(config: DbConnection): Promise<string> {
    let tempService: IDbService | null = null
    const sshService = new SshTunnelService()

    try {
      let dbHost = config.host
      let dbPort = parseInt(config.port)
      const user = config.user
      const password = config.password
      const database = config.database
      const type = config.type

      if (config.useSsh && config.sshHost && config.sshPort && config.sshUser) {
        const localPort = await sshService.createTunnel(
          {
            host: config.sshHost,
            port: parseInt(config.sshPort),
            username: config.sshUser,
            password: config.sshPassword,
            privateKeyPath: config.sshKeyPath
          },
          { host: dbHost, port: dbPort }
        )
        dbHost = '127.0.0.1'
        dbPort = localPort
      }

      const protocol = type === 'postgres' ? 'postgresql' : 'mysql'
      const connStr = `${protocol}://${user}:${password}@${dbHost}:${dbPort}/${database}`

      if (type === 'mysql') {
        tempService = new MysqlService()
      } else {
        tempService = new PostgresService()
      }

      const result = await tempService.connect(connStr)
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

  async getTables(id: number, dbName?: string): Promise<string[]> {
    const service = this.getService(id)
    return await service.getTables(dbName)
  }

  async getTableData(connectionId: number, req: IDataRequest): Promise<IDbResult> {
    try {
      // SECURITY: Validate tableName
      const tables = await this.getTables(connectionId)
      if (!tables.includes(req.tableName)) {
        throw new Error(`Invalid table name: ${req.tableName}`)
      }

      // SECURITY: Construct SQL safely
      // We use string concatenation because we need dynamic identifiers (table/col)
      // which parameterization (usually) doesn't support for table/col names.
      // But we validated tableName against the system catalog.

      const isPostgres = this.isPostgres(connectionId)
      const quoteChar = isPostgres ? '"' : '`'

      // Re-quote table name with correct char
      let sql = `SELECT * FROM ${quoteChar}${req.tableName}${quoteChar}`

      if (req.sort && req.sort.length > 0) {
        const orderClauses = req.sort.map((s) => {
          // SECURITY: Basic sanitization for column names
          // Ensure no quote chars that could break out
          if (s.colId.includes(quoteChar)) {
            throw new Error(`Invalid column name: ${s.colId}`)
          }
          return `${quoteChar}${s.colId}${quoteChar} ${s.sort.toUpperCase()}`
        })
        sql += ` ORDER BY ${orderClauses.join(', ')}`
      }

      // SECURITY: limit/offset are numbers in TypeScript interface
      // ensure they are numbers at runtime to be sure
      const limit = Number(req.limit)
      const offset = Number(req.offset)

      if (isNaN(limit) || isNaN(offset)) {
        throw new Error('Invalid limit/offset')
      }

      sql += ` LIMIT ${limit} OFFSET ${offset}`

      return await this.execute(connectionId, sql)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  }

  async getDatabases(id: number, excludeList?: string): Promise<string[]> {
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
}
