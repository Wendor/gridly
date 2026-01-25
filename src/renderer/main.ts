import { createApp } from 'vue'
import { createPinia } from 'pinia' // <-- Импорт
import i18n from './i18n' // <-- i18n
import App from './App.vue'
import './assets/main.css' // <-- Наши стили

import { tauriApi } from './api/tauri'

const app = createApp(App)

// Use Tauri API adapter
window.dbApi = tauriApi

app.use(createPinia())
 // <-- Подключение
app.use(i18n)
app.mount('#app')
