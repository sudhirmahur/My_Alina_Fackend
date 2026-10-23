import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the browser talks to the Vite server and Vite forwards /api to the backend.
// That avoids CORS problems and lets a phone on the same Wi-Fi use the app (open http://<pc-ip>:5173).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'
  const proxy = { '/api': { target, changeOrigin: true }, '/health': { target, changeOrigin: true } }
  return {
    plugins: [react(), tailwindcss()],
    server: { host: true, port: 5173, proxy },
    preview: { host: true, port: 4173, proxy },
    build: { sourcemap: false, chunkSizeWarningLimit: 700 },
  }
})
