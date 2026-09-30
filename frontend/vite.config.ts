import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Keep the default 500 kB warning threshold to catch future bundle growth.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (!moduleId.includes('/node_modules/')) return;

          if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(moduleId)) {
            return 'vendor-react';
          }
          if (moduleId.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (moduleId.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (/\/node_modules\/(xlsx|file-saver|cfb|ssf|wmf|codepage|crc-32|adler-32)\//.test(moduleId)) {
            return 'vendor-excel';
          }
          if (/\/node_modules\/(html5-qrcode|qrcode.react)\//.test(moduleId)) {
            return 'vendor-qr';
          }
          if (moduleId.includes('/node_modules/@capacitor/')) {
            return 'vendor-capacitor';
          }
          if (/\/node_modules\/(date-fns|zustand)\//.test(moduleId)
            || moduleId.includes('/node_modules/@tanstack/')) {
            return 'vendor-libs';
          }
          // Let other dependencies follow their import graph so lazy-only
          // libraries are not pulled into a shared startup vendor chunk.
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
