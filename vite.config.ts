import { fileURLToPath, URL } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { defineConfig, type Plugin, type PluginOption, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import { USER_ID_RE, caKey, upsertAthMc } from './shared/ath-mc-file'

const ATH_MC_FILE = fileURLToPath(new URL('./data/ath-mc.json', import.meta.url))

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

async function readAthMcFile(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(ATH_MC_FILE, 'utf8')) as Record<string, unknown>
  } catch (error) {
    if (isNotFound(error)) return {}
    throw error
  }
}

async function writeAthMcFile(data: unknown) {
  await mkdir(dirname(ATH_MC_FILE), { recursive: true })
  await writeFile(ATH_MC_FILE, JSON.stringify(data, null, 2) + '\n')
}

function athMcFilePlugin(): Plugin {
  const attach = (server: ViteDevServer) => {
    server.middlewares.use('/__ath-mc', (req, res, next) => {
      if (req.method === 'GET') {
        readAthMcFile()
          .then(data => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
          })
          .catch(error => {
            res.statusCode = 500
            res.end(error instanceof Error ? error.message : 'failed to read ath mc')
          })
        return
      }

      if (req.method !== 'POST') {
        next()
        return
      }

      const chunks: Buffer[] = []
      req.on('data', chunk => chunks.push(chunk as Buffer))
      req.on('end', async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            ca?: string
            value?: number | null
            user?: string
          }
          const ca = typeof body.ca === 'string' ? caKey(body.ca.trim()) : ''
          const user = typeof body.user === 'string' ? body.user.trim() : ''
          let value: number | null = null
          if (body.value != null) {
            const parsed = Number(body.value)
            if (!Number.isFinite(parsed)) {
              res.statusCode = 400
              res.end('invalid ath mc')
              return
            }
            value = parsed > 0 ? parsed : null
          }
          if (!ca || !USER_ID_RE.test(user)) {
            res.statusCode = 400
            res.end('invalid ath mc')
            return
          }

          const current = await readAthMcFile()
          const { map, reports } = upsertAthMc(current, ca, user, value)
          await writeAthMcFile(map)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(reports))
        } catch (error) {
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : 'failed to save ath mc')
        }
      })
    })
  }

  return {
    name: 'ath-mc-file',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    athMcFilePlugin(),
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
    watch: {
      // Writing this file must not reload the app (archives live only in memory).
      ignored: ['**/data/ath-mc.json'],
    },
  },
})
