// defineConfig comes from vitest/config so the `test` block below type-checks;
// it is the same Vite config object with the test options added.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest (a custom src/sw.ts), not generateSW — the service
      // worker has a second job beyond asset precaching: receiving
      // background push (FCM) and showing a notification while the tab is
      // closed. generateSW's auto-generated worker has no hook for that.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Never cache API or socket traffic — this is a live-tracking app;
        // a stale cached bus position is worse than no offline support.
        globIgnores: ['**/node_modules/**/*'],
      },
      manifest: {
        name: 'CMIS — Campus Mobility Intelligence System',
        short_name: 'CMIS',
        description: 'Campus bus tracking, RFID attendance, and transport administration.',
        theme_color: '#f9fafb',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/login',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  // Unit tests live beside the code in src/. The e2e/ directory belongs to
  // Playwright (npm run test:e2e) and must stay out of the vitest run.
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4100',
        ws: true,
      },
    },
  },
})
