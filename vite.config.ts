import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Polling: native file events were missed on Windows when many files change at once.
  server: { watch: { usePolling: true, interval: 300 } },
})
