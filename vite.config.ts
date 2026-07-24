import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo_utt.png', 'logo-neutradc.png'],
      manifest: {
        name: 'Report UTT',
        short_name: 'Report UTT',
        description: 'Multi-unit maintenance reporting system',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'logo_utt.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo_utt.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.web-fonts\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
        ]
      }
    })
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) {
            return 'firebase';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-components';
          }
          if (id.includes('jspdf')) {
            return 'jspdf';
          }
          if (id.includes('exceljs')) {
            return 'exceljs';
          }
          if (id.includes('html2canvas')) {
            return 'html2canvas';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
