import { DbConnection, IDbResult, DbSchema } from '../../shared/types'
import { IDbService } from './IDbService'
import { MysqlService } from './MysqlService'
import { PostgresService } from './PostgresService'
import { SshTunnelService } from './SshTunnelService'

export class DatabaseManager {
  private currentService: IDbService | null = null
  private sshService: SshTunnelService
  private mysqlService: MysqlService
  private pgService: PostgresService

  constructor() {
    this.sshService = new SshTunnelService()
    this.mysqlService = new MysqlService()
    this.pgService = new PostgresService()
  }

  async connect(config: DbConnection): Promise<string> {
    try {
      if (this.currentService) {
        await this.currentService.disconnect()
      }
      this.sshService.close()

      let dbHost = config.host
      let dbPort = parseInt(config.port)
      const user = config.user
      const password = config.password
      const database = config.database
      const type = config.type

      if (config.useSsh && config.sshHost && config.sshPort && config.sshUser) {
        console.log('Starting SSH Tunnel...')
        const localPort = await this.sshService.createTunnel(
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
        this.currentService = this.mysqlService
      } else {
        this.currentService = this.pgService
      }

      console.log(`Connecting to DB (${type}) via ${dbHost}:${dbPort}...`)
      return await this.currentService.connect(connStr)
    } catch (e: unknown) {
      console.error('Connection error:', e)
      this.sshService.close()
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(msg)
    }
  }

  async disconnect(): Promise<void> {
    if (this.currentService) {
      await this.currentService.disconnect()
      this.currentService = null
    }
    this.sshService.close()
  }

  async execute(sql: string): Promise<IDbResult> {
    if (!this.currentService) throw new Error('No active connection')
    return await this.currentService.execute(sql)
  }

  async getTables(): Promise<string[]> {
    if (!this.currentService) throw new Error('No active connection')
    return await this.currentService.getTables()
  }

  async getSchema(): Promise<DbSchema> {
    if (!this.currentService) throw new Error('No active connection')
    return await this.currentService.getSchema()
  }

  isPostgres(): boolean {
    return this.currentService instanceof PostgresService
  }

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
}
