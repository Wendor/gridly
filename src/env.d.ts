/// <reference types="vite/client" />

interface Window {
  dbApi: import('./api/tauri').ITauriAPI
}
