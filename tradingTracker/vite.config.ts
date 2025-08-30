import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }
})