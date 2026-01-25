import { ElectronAPI } from '@electron-toolkit/preload'
import { IElectronAPI } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    dbApi: IElectronAPI
  }
}
