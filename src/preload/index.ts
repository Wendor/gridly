import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IElectronAPI } from '../shared/types'

// Реализуем типизированный API
const api: IElectronAPI = {
  connect: (config) => ipcRenderer.invoke('db:connect', config),
  query: (sql) => ipcRenderer.invoke('db:query', sql),
  getTables: () => ipcRenderer.invoke('db:get-tables'),
  // Прокидываем новый запрос
  getTableData: (req) => ipcRenderer.invoke('db:get-table-data', req)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('dbApi', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.dbApi = api
}
