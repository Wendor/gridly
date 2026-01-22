import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { DbConnection, IDataRequest, IDbResult } from '../shared/types'
import { SshTunnelService } from './db/SshTunnelService'
import { MysqlService } from './db/MysqlService'
import { PostgresService } from './db/PostgresService'

interface IDbService {
  connect(connectionString: string): Promise<string>
  disconnect(): Promise<void>
  execute(sql: string): Promise<IDbResult>
}

let currentDbService: IDbService | null = null
const sshService = new SshTunnelService()
const mysqlService = new MysqlService()
const pgService = new PostgresService()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('db:connect', async (_event, config: DbConnection) => {
    try {
      if (currentDbService) {
        await currentDbService.disconnect()
      }
      sshService.close()

      let dbHost = config.host
      let dbPort = parseInt(config.port)
      const user = config.user
      const password = config.password
      const database = config.database
      const type = config.type

      if (config.useSsh && config.sshHost && config.sshPort && config.sshUser) {
        console.log('Starting SSH Tunnel...')
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
        currentDbService = mysqlService
      } else {
        currentDbService = pgService
      }

      console.log(`Connecting to DB (${type}) via ${dbHost}:${dbPort}...`)
      return await currentDbService.connect(connStr)
    } catch (e: unknown) {
      console.error('Connection error:', e)
      sshService.close()
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(msg)
    }
  })

  ipcMain.handle('db:query', async (_event, sql: string) => {
    try {
      if (!currentDbService) throw new Error('No active connection')
      // 2. ВЫЗЫВАЕМ EXECUTE ВМЕСТО QUERY
      return await currentDbService.execute(sql)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  })

  ipcMain.handle('db:get-tables', async () => {
    try {
      if (!currentDbService) throw new Error('No active connection')

      const showTablesSql =
        currentDbService instanceof PostgresService
          ? "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
          : 'SHOW TABLES'

      const res = await currentDbService.execute(showTablesSql)
      if (res.rows) {
        // Получаем массив строк
        const tables = res.rows.map((r) => Object.values(r)[0] as string)
        // ДОБАВЛЯЕМ СОРТИРОВКУ:
        return tables.sort()
      }
      return []
    } catch (e: unknown) {
      console.error(e)
      return []
    }
  })

  ipcMain.handle('db:get-table-data', async (_event, req: IDataRequest) => {
    try {
      if (!currentDbService) throw new Error('No connection')

      let sql = `SELECT * FROM ${req.tableName}`

      if (req.sort && req.sort.length > 0) {
        const orderClauses = req.sort.map((s) => `${s.colId} ${s.sort.toUpperCase()}`)
        sql += ` ORDER BY ${orderClauses.join(', ')}`
      }

      sql += ` LIMIT ${req.limit} OFFSET ${req.offset}`

      console.log('Grid Query:', sql)
      // Вызываем execute
      return await currentDbService.execute(sql)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
