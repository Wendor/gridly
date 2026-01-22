import { createApp } from 'vue'
import { createPinia } from 'pinia' // <-- Импорт
import App from './App.vue'
import './assets/main.css' // <-- Наши стили

const app = createApp(App)
app.use(createPinia()) // <-- Подключение
app.mount('#app')
