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

// Mode `npm run dev:emulator`: Firebase Emulator diakses lewat origin yang sama (lihat
// frontend/api/firebase.ts), supaya juga bisa dites dari HP melalui tunnel HTTPS Cloudflare.
const emulatorProxy = {
  // Auth Emulator
  '/identitytoolkit.googleapis.com': { target: 'http://127.0.0.1:9099', changeOrigin: true },
  '/securetoken.googleapis.com': { target: 'http://127.0.0.1:9099', changeOrigin: true },
  '/emulator': { target: 'http://127.0.0.1:9099', changeOrigin: true },
  // Firestore Emulator (WebChannel + REST)
  '/google.firestore.v1.Firestore': { target: 'http://127.0.0.1:8085', changeOrigin: true },
  '/v1/projects': { target: 'http://127.0.0.1:8085', changeOrigin: true },
  // Functions Emulator
  '/__functions': { target: 'http://127.0.0.1:5001', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/__functions/, '') },
  // Realtime Database Emulator
  '/.ws': { target: 'ws://127.0.0.1:9000', ws: true, changeOrigin: true },
  '/.lp': { target: 'http://127.0.0.1:9000', changeOrigin: true },
}

// Backend Go untuk mode emulator berjalan di port terpisah (8090) dengan env emulator,
// supaya tidak tertukar dengan backend Go di 8080 yang memakai Firebase production.
// Lihat bagian "Tes lokal" di scanning.md.
const EMULATOR_API_TARGET = 'http://localhost:8090'

export default defineConfig(({ mode }) => ({
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
            // Model scan wajah (±7 MB): simpan di perangkat setelah unduhan pertama, agar
            // login di lokasi bersinyal lemah tidak mengunduh ulang. Ganti nama cache bila
            // file model di public/models/face diganti.
            urlPattern: ({ url }) => url.pathname.startsWith('/models/face/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-models-v1',
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [200] }
            }
          },
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
    // Tunnel HTTPS untuk tes dari HP (cloudflared quick tunnel).
    allowedHosts: mode === 'emulator' ? ['.trycloudflare.com'] : undefined,
    // HMR websocket tidak bisa lewat quick tunnel; muat ulang manual saat tes emulator.
    hmr: mode === 'emulator' ? false : undefined,
    proxy: {
      ...(mode === 'emulator' ? emulatorProxy : {}),
      // Direct semua request HTTP/WebSocket `/api` ke Backend Go (8080; mode emulator: 8090)
      '/api': {
        target: mode === 'emulator' ? EMULATOR_API_TARGET : 'http://localhost:8080',
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
}))
