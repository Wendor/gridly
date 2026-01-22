import { Client, ConnectConfig } from 'ssh2'
import * as net from 'net'
import { readFileSync } from 'fs'

// Интерфейс для нашего внутреннего конфига
export interface SshConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKeyPath?: string
}

export class SshTunnelService {
  private server: net.Server | null = null
  private sshClient: Client | null = null

  async createTunnel(
    sshConfig: SshConfig,
    dbConfig: { host: string; port: number }
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.sshClient = new Client()

      // Используем строгий тип ConnectConfig из ssh2
      const config: ConnectConfig = {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username
      }

      if (sshConfig.privateKeyPath) {
        try {
          config.privateKey = readFileSync(sshConfig.privateKeyPath)
        } catch (error) {
          // Заменили 'e' на 'error' и используем его
          reject(
            new Error(`Не удалось прочитать файл ключа: ${sshConfig.privateKeyPath}. ${error}`)
          )
          return
        }
      } else if (sshConfig.password) {
        config.password = sshConfig.password
      }

      this.sshClient
        .on('ready', () => {
          console.log('SSH Connection Ready')

          this.server = net.createServer((socket) => {
            this.sshClient!.forwardOut(
              '127.0.0.1',
              0,
              dbConfig.host,
              dbConfig.port,
              (err, stream) => {
                if (err) {
                  socket.end()
                  return
                }
                socket.pipe(stream)
                stream.pipe(socket)
              }
            )
          })

          this.server.listen(0, '127.0.0.1', () => {
            const address = this.server?.address()
            // Проверка типа, так как address() может вернуть string или null
            if (address && typeof address !== 'string') {
              console.log(
                `Tunnel created: 127.0.0.1:${address.port} -> ${dbConfig.host}:${dbConfig.port}`
              )
              resolve(address.port)
            } else {
              reject(new Error('Не удалось получить порт туннеля'))
            }
          })
        })
        .on('error', (err) => {
          reject(new Error(`SSH Error: ${err.message}`))
        })
        .connect(config)
    })
  }

  close(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    if (this.sshClient) {
      this.sshClient.end()
      this.sshClient = null
    }
    console.log('SSH Tunnel closed')
  }
}
