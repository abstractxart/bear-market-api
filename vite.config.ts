import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Base path for trade.bearpark.xyz (root)
  base: '/',
  plugins: [react()],
  define: {
    // Required for xrpl.js to work in browser
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfills for Node.js modules used by xrpl.js
      stream: 'stream-browserify',
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: ['buffer', 'xrpl'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          xrpl: ['xrpl'],
          vendor: ['react', 'react-dom', 'framer-motion'],
        },
      },
    },
  },
})
