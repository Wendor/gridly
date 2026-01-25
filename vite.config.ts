import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: 'src/renderer',
  base: './', // Tauri expects relative paths or absolute depending on config, but ./ is safe usually
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@': resolve(__dirname, 'src/renderer')
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'esnext'
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})
