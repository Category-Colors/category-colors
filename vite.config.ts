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
      // culori's "require" export condition points at bundled/culori.cjs — the
      // whole library in one file, which nothing can tree-shake. categorycolors
      // is CommonJS, so every require('culori') inside it pulled that in.
      // Pinning the alias to the ESM entry (the same file the "import"
      // condition resolves to) lets both sides share one tree-shaken copy.
      culori: path.resolve(__dirname, 'node_modules/culori/src/index.js'),
    },
  },
  optimizeDeps: {
    // categorycolors is a linked (file:) CommonJS package; force prebundling
    // so its require() calls are converted for the browser. Each entry point
    // has to be listed: an unlisted subpath is served raw, and a named import
    // from raw CommonJS fails in dev even though the build resolves it fine.
    include: ['categorycolors/src', 'categorycolors/src/report/jnd'],
  },
})
