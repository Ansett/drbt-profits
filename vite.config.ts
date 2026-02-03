import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
      },
    }),
    // yarn build:analyze to generate a bundle visualization (keep at the end)
    process.env.ANALYZEBUNDLE
      ? (visualizer({ open: true, gzipSize: true }) as PluginOption)
      : undefined,
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
