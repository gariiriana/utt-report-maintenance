import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase chunk
          if (id.includes('firebase')) {
            return 'firebase';
          }
          // UI components chunk
          if (id.includes('@radix-ui')) {
            return 'ui-components';
          }
          // Keep jsPDF in separate chunk
          if (id.includes('jspdf')) {
            return 'jspdf';
          }
          // Keep ExcelJS in separate chunk
          if (id.includes('exceljs')) {
            return 'exceljs';
          }
          // html2canvas
          if (id.includes('html2canvas')) {
            return 'html2canvas';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500, // Lower limit untuk lebih aggressive splitting
  },
})
