import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_API_PORT = Number(process.env.VITE_API_PORT || 3001)
const RUNTIME_PORT_FILE = path.resolve(__dirname, '../backend/.runtime-port')

function readApiPort() {
  try {
    const raw = fs.readFileSync(RUNTIME_PORT_FILE, 'utf8').trim()
    const port = Number(raw)
    if (Number.isInteger(port) && port > 0) return port
  } catch {
    // Backend has not written a runtime port yet.
  }
  return DEFAULT_API_PORT
}

function followBackendPort(proxy, options) {
  proxy.on('proxyReq', () => {
    options.target = `http://localhost:${readApiPort()}`
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Allow external devices (like phones) on the same network to access the server
    proxy: {
      '/api': {
        target: `http://localhost:${readApiPort()}`,
        changeOrigin: true,
        configure: followBackendPort,
      },
      '/health': {
        target: `http://localhost:${readApiPort()}`,
        changeOrigin: true,
        configure: followBackendPort,
      }
    }
  }
})
