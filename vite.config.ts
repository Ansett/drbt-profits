import { fileURLToPath, URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { defineConfig, type Plugin, type PluginOption, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'

const ATH_MC_FILE = fileURLToPath(new URL('./src/data/ath-mc.json', import.meta.url))

function caKey(ca: string): string {
  return ca.startsWith('0x') ? ca.toLowerCase() : ca
}

const USER_ID_RE = /^[a-zA-Z0-9:_-]{2,64}$/

function normalizeReports(value: unknown): Record<string, number> {
  if (Array.isArray(value)) {
    const reports: Record<string, number> = {}
    value.forEach((raw, index) => {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) reports[`anon:${index}`] = n
    })
    return reports
  }

  if (!value || typeof value !== 'object') return {}

  const reports: Record<string, number> = {}
  for (const [user, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw)
    if (!USER_ID_RE.test(user) || !Number.isFinite(n) || n <= 0) continue
    reports[user] = n
  }
  return reports
}

function sortAthMcFile(data: Record<string, Record<string, number>>) {
  return Object.fromEntries(
    Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ca, reports]) => [
        ca,
        Object.fromEntries(Object.entries(reports).sort(([a], [b]) => a.localeCompare(b))),
      ]),
  )
}

function athMcFilePlugin(): Plugin {
  const attach = (server: ViteDevServer) => {
    server.middlewares.use('/__ath-mc', (req, res, next) => {
      if (req.method === 'GET') {
        readFile(ATH_MC_FILE, 'utf8')
          .then(contents => {
            res.setHeader('Content-Type', 'application/json')
            res.end(contents)
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

          const current = JSON.parse(await readFile(ATH_MC_FILE, 'utf8')) as Record<string, unknown>
          const reports = normalizeReports(current[ca])
          if (value === null) delete reports[user]
          else reports[user] = value
          if (Object.keys(reports).length) current[ca] = reports
          else delete current[ca]
          const normalized = Object.fromEntries(
            Object.entries(current)
              .map(([token, entry]) => [caKey(token), normalizeReports(entry)] as const)
              .filter(([, reports]) => Object.keys(reports).length),
          )
          await writeFile(ATH_MC_FILE, JSON.stringify(sortAthMcFile(normalized), null, 2) + '\n')
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
      ignored: ['**/src/data/ath-mc.json'],
    },
  },
})
