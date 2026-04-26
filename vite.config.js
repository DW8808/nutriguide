import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isWeb = process.env.VITE_TARGET === 'web'

export default defineConfig({
  plugins: [react()],
  base: isWeb ? '/nutriguide/' : './',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
})
