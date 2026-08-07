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
