/**
 * BEAR SWAP - Vite Configuration
 *
 * Build configuration for the BEAR SWAP trading platform.
 * Includes security hardening for production builds.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [react()],
  server: {
    // Development proxy for APIs (avoids CORS issues)
    proxy: {
      '/api/xrplto': {
        target: 'https://api.xrpl.to',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xrplto/, '/api'),
        secure: true,
      },
      '/api/xmagnetic': {
        target: 'https://api.xmagnetic.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xmagnetic/, '/api/v1'),
        secure: true,
      },
    },
  },
  define: {
    // Required for xrpl.js and Web3Auth to work in browser
    'global': 'globalThis',
    'process': JSON.stringify({ env: {}, browser: true }),
    'process.env': JSON.stringify({}),
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
  esbuild: {
    // Strip console.log and debugger in production for security
    drop: mode === 'production' ? ['console', 'debugger'] : [],
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
}))
