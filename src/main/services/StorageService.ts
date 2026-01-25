import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { DbConnection, DbConnectionMeta, AppSettings } from '../../shared/types'

const CONFIG_DIR = path.join(app.getPath('home'), '.gridly')
const CONNECTIONS_FILE = path.join(CONFIG_DIR, 'connections.json')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')

export class StorageService {
  constructor() {
    this.ensureConfigDir()
  }

  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create config directory:', error)
    }
  }

  async getConnections(): Promise<DbConnection[]> {
    try {
      const data = await fs.readFile(CONNECTIONS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  async getConnectionsMeta(): Promise<DbConnectionMeta[]> {
    const connections = await this.getConnections()
    return connections.map(this.stripSensitiveData)
  }

  private stripSensitiveData(conn: DbConnection): DbConnectionMeta {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, sshPassword, ...meta } = conn
    return meta
  }

  async saveConnection(connection: DbConnection): Promise<void> {
    const connections = await this.getConnections()
    const index = connections.findIndex((c) => c.id === connection.id)

    if (index !== -1) {
      const existing = connections[index]
      connections[index] = {
        ...connection,
        password: connection.password ?? existing.password,
        sshPassword: connection.sshPassword ?? existing.sshPassword
      }
    } else {
      connections.push(connection)
    }

    await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(connections, null, 2))
  }

  async deleteConnection(id: string): Promise<void> {
    const connections = await this.getConnections()
    const newConnections = connections.filter((c) => c.id !== id)
    await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(newConnections, null, 2))
  }

  // Helper to get connection by ID (internal use for DB connection)
  async getConnectionById(id: string): Promise<DbConnection | undefined> {
    const connections = await this.getConnections()
    return connections.find((c) => c.id === id)
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch {
      return {
        theme: 'atom-one-dark',
        locale: 'en',
        fontSize: 14
      }
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  }
}
