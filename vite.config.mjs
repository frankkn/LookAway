import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.join(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:     path.join(__dirname, 'src/renderer/main.html'),
        reminder: path.join(__dirname, 'src/renderer/reminder.html'),
        settings: path.join(__dirname, 'src/renderer/settings.html'),
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
