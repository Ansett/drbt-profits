import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    devSourcemap: true,
  },
  worker: {
    format: 'es',
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000, // Replace with the port you want
    strictPort: true, // Ensures Vite fails if the port is already in use
  },
})
