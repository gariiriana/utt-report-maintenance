import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
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
