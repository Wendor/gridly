import { ElectronAPI } from '@electron-toolkit/preload'
import { IElectronAPI } from '../shared/types' // Импорт нашего контракта

declare global {
  interface Window {
    electron: ElectronAPI
    dbApi: IElectronAPI // <-- Вот это мы добавили!
  }
}
