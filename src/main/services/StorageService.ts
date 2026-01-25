import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import {
  DbConnection,
  DbConnectionMeta,
  AppSettings,
  AppState,
  HistoryItem
} from '../../shared/types'

const CONFIG_DIR = path.join(app.getPath('home'), '.gridly')
const CONNECTIONS_FILE = path.join(CONFIG_DIR, 'connections.json')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')
const STATE_FILE = path.join(CONFIG_DIR, 'state.json')
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json')

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
    const { password: _password, sshPassword: _sshPassword, ...meta } = conn
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

  async getState(): Promise<AppState> {
    try {
      const data = await fs.readFile(STATE_FILE, 'utf-8')
      return JSON.parse(data)
    } catch {
      return this.getDefaultState()
    }
  }

  async saveState(state: AppState): Promise<void> {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2))
  }

  async updateState(updates: Partial<AppState>): Promise<void> {
    const current = await this.getState()

    const merged: AppState = {
      tabs: updates.tabs ?? current.tabs,
      ui: {
        ...current.ui,
        ...(updates.ui || {})
      }
    }

    await this.saveState(merged)
  }

  async getHistory(): Promise<HistoryItem[]> {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  async saveHistory(history: HistoryItem[]): Promise<void> {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2))
  }

  private getDefaultState(): AppState {
    return {
      tabs: {
        openTabs: [],
        activeTabId: null,
        nextTabId: 1
      },
      ui: {
        sidebarWidth: 250,
        editorHeight: 300,
        expandedConnections: []
      }
    }
  }
}
