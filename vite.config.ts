// ============================================================================
// FILE: vite.config.ts
// Deskripsi: Konfigurasi Terpusat Bundler Frontend Vite.
//            Menangani plugin React, TailwindCSS v4, PWA (Progressive Web App),
//            Proxy API Server (`/api` -> `http://localhost:8080`), Path Alias `@/` -> `./frontend`,
//            dan Pembagian Chunking Produksi (Manual Chunks untuk PDF/Excel/Firebase).
// ============================================================================

import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Paksa buka browser Chrome saat dev server dijalankan
process.env.BROWSER = 'chrome'

export default defineConfig({
  plugins: [
    // 1. Plugin React Fast Refresh
    react(),
    
    // 2. Plugin TailwindCSS Bundler Engine
    tailwindcss(),

    // 3. Plugin PWA (Offline Service Worker & Manifest Web App)
    VitePWA({
      registerType: 'autoUpdate',
      // Never serve/register a PWA worker from Vite. A stale worker can keep
      // controlling localhost and return cached production HTML during dev.
      devOptions: { enabled: false },
      includeAssets: ['logo-dwimitra.png', 'logo-neutradc.png', 'apple-touch-icon.png'],
      // Installed-app name and icon. Icons are square versions of logo-dwimitra.png on white;
      // the maskable one keeps the logo inside Android's safe zone.
      manifest: {
        id: '/',
        name: 'Dwimitra System',
        short_name: 'Dwimitra System',
        description: 'Sistem Pemeliharaan Data Center PT Dwimitra Ekatama Mandiri',
        start_url: '/',
        scope: '/',
        lang: 'id',
        theme_color: '#1b6db3',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
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

  // Konfigurasi Development Server (`npm run dev`)
  server: {
    open: true,
    host: true,
    proxy: {
      // Direct semua request HTTP/WebSocket `/api` ke Backend Go di port 8080
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },

  // Konfigurasi Resolver Path Alias (`@/` -> `./frontend/`)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
    },
  },

  // Konfigurasi Optimization Rollup Build Produksi
  build: {
    rollupOptions: {
      output: {
        // Pemisahan bundle library besar menjadi terpisah untuk pemuatan halaman cepat
        manualChunks(id) {
          if (id.includes('boqAssetData')) {
            return 'boq-data';
          }
          if (id.includes('xlsx')) {
            return 'xlsx';
          }
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
    chunkSizeWarningLimit: 1500,
  },
})
