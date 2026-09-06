import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // A linked ../category-colors checkout brings its own node_modules/culori;
    // dedupe keeps the app and the library on one copy.
    dedupe: ['culori'],
  },
})
