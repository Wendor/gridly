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
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-i18n')) {
              return 'vendor-vue'
            }
            if (id.includes('@codemirror') || id.includes('vue-codemirror') || id.includes('sql-formatter')) {
              return 'vendor-editor'
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri'
            }
            if (id.includes('markdown-it')) {
              return 'vendor-utils'
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})
