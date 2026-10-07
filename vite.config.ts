import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Local HTTPS: self-signed certificate in .certs/ (git-ignored). Falls back to HTTP if it is missing.
const key = '.certs/localhost-key.pem'
const cert = '.certs/localhost.pem'
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string }

const https = fs.existsSync(key) && fs.existsSync(cert) ? { key: fs.readFileSync(key), cert: fs.readFileSync(cert) } : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // App version (shown on the sign-in screen and in Help & support); bump with `npm run bump`.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILT__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  server: {
    https,
    // IPv4 loopback so the hosts-file entry (127.0.0.1) reaches it; still local-only.
    host: '127.0.0.1',
    // Local name from the Windows hosts file (127.0.0.1 HexaView.io).
    allowedHosts: ['hexaview.io', 'localhost'],
    // Polling: native file events were missed on Windows when many files change at once.
    watch: { usePolling: true, interval: 300 },
  },
})
