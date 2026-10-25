import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // 後端沒有 CORS,開發時透過 proxy 轉發 /api 到 Express (port 3000)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
