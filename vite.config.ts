import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward API calls to the deployed checkout server by default so the
      // dashboard talks to the same API as the scanner + customer webapp.
      // Override with API_TARGET to point a local dev run at a local server.
      '/api': {
        target: process.env.API_TARGET ?? 'https://checkout-production-bbfe.up.railway.app',
        changeOrigin: true,
      },
    },
  },
})