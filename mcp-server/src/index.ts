import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { z } from 'zod'
import computeTool from './computeTool.js'
import targetTool, { STEPS } from './targetTool.js'
import rhComputeTool from './rhComputeTool.js'
import rhTargetTool from './rhTargetTool.js'
import { validateBearer, recordUsage, getKeys, createKey, deleteKey } from './apiKeys.js'
import { getAthMcMap, saveAthMc } from './athMc.js'
import { USER_ID_RE, caKey } from '../../shared/ath-mc-file.js'
import { fetchAthMc, parseAthLookupChain } from '../../shared/ath-lookup.js'

const ADMIN_KEY = process.env.MCP_ADMIN_KEY

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'drbt-profits-mcp',
    version: '0.1.0',
  })

  // @ts-ignore TS2589: MCP SDK registerTool deep type inference limitation
  server.registerTool(
    'simulate_pnl_sol',
    {
      description: 'Run profits and losses simulation on a calls list from DRBT backtesting and return performance data.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        backtest_link: z.string().describe(`The download_url returned by the DRBT run_backtest tool, pointing to the JSON calls list.`),
        position: z.number().positive().default(0.1).describe('SOL amount invested per call.'),
        take_profits: z
          .array(z.string())
          .min(1)
          .default(['25% 3x', '25% 5x', '25% 10x', '25% 1000000'])
          .describe(
            'Array of take profit rules. Each rule is "<size>% <target>" where target is either a multiplier or a market cap (e.g. ["10% 3x", "15.5% 500000"] to sell 10% at 3x and 15.5% at $500k MC). The sum of sizes must be <=100',
          ),
      },
      outputSchema: {
        pnl_sol: z.number().describe('Net profit/loss in SOL.'),
        drawdown_sol: z.number().describe('Drawdown from the first call date in SOL.'),
        worst_drawdown_sol: z.number().describe('Worst drawdown across all dates in SOL.'),
        calls_count: z.number().int().describe('Total number of calls in the backtest.'),
      },
    },
    computeTool
  )

  // @ts-ignore TS2589: MCP SDK registerTool deep type inference limitation
  server.registerTool(
    'find_targets_sol',
    {
      description: [
        'Runs PnL simulation on a range of take profit targets for calls from DRBT backtesting, in order to see where the hot spots are to place take profits, if drawdowns are reasonable.',
        `Range is split into ${STEPS} steps (or less if too close).`,
        'Returns an array of performance data.'
      ].join('\n'),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        backtest_link: z.string().describe('The download_url returned by the DRBT run_backtest tool, pointing to the JSON calls list.'),
        position: z.number().positive().default(0.1).describe('SOL amount invested per call.'),
        range: z.string().default("2x 101x").describe(`Target range as "<start> <end>". Use "x" suffix for multipliers (e.g. "2.5x 10x") or plain numbers for market cap (e.g. "50000 1000000").`),
      },
      outputSchema: {
        results: z.array(z.object({
          target: z.string().describe('The take-profit target value (e.g. "5x" or "$100000").'),
          pnl_sol: z.number().describe('Net profit/loss in SOL at this target.'),
          drawdown_sol: z.number().describe('Drawdown from the first call date in SOL.'),
          worst_drawdown_sol: z.number().describe('Worst drawdown across all dates in SOL.'),
        })),
      },
    },
    targetTool
  )

  // @ts-ignore TS2589: MCP SDK registerTool deep type inference limitation
  server.registerTool(
    'simulate_pnl_rh',
    {
      description:
        'Run profits and losses simulation on a Robinhood calls list from DRBT backtesting and return performance data in ETH.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        backtest_link: z
          .string()
          .describe(
            'The download.url returned by the DRBT backtest tool, pointing to the JSON backtest export.',
          ),
        position: z.number().positive().default(0.01).describe('ETH amount invested per call.'),
        take_profits: z
          .array(z.string())
          .min(1)
          .default(['33.3% 50x', '33.3% 500000', '33.4% 100x'])
          .describe(
            'Array of take profit rules. Each rule is "<size>% <target>" where target is either a multiplier or a market cap (e.g. ["10% 3x", "15.5% 500000"] to sell 10% at 3x and 15.5% at $500k MC). Here, size percentages are relative to *initial* quantity, while DRBT filter auto-sell percentages are relative to remaining quantity at the time of trigger. The sum of % sizes must be <=100',
          ),
      },
      outputSchema: {
        pnl_eth: z.number().describe('Net profit/loss in ETH.'),
        drawdown_eth: z.number().describe('Drawdown from the first call date in ETH.'),
        worst_drawdown_eth: z.number().describe('Worst drawdown across all dates in ETH.'),
        calls_count: z.number().int().describe('Total number of calls in the backtest.'),
      },
    },
    rhComputeTool,
  )

  // @ts-ignore TS2589: MCP SDK registerTool deep type inference limitation
  server.registerTool(
    'find_targets_rh',
    {
      description: [
        'Runs PnL simulation on a range of take profit targets for Robinhood calls from DRBT backtesting, in order to see where the hot spots are to place take profits, if drawdowns are reasonable.',
        `Range is split into ${STEPS} steps (or less if too close).`,
        'Returns an array of performance data in ETH.',
      ].join('\n'),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        backtest_link: z
          .string()
          .describe(
            'The download.url returned by the DRBT backtest tool, pointing to the JSON export.',
          ),
        position: z.number().positive().default(0.01).describe('ETH amount invested per call.'),
        range: z
          .string()
          .default('2x 101x')
          .describe(
            `Target range as "<start> <end>". Use "x" suffix for multipliers (e.g. "2.5x 10x") or plain numbers for market cap (e.g. "50000 1000000").`,
          ),
      },
      outputSchema: {
        results: z.array(
          z.object({
            target: z.string().describe('The take-profit target value (e.g. "5x" or "$100000").'),
            pnl_eth: z.number().describe('Net profit/loss in ETH at this target.'),
            drawdown_eth: z.number().describe('Drawdown from the first call date in ETH.'),
            worst_drawdown_eth: z.number().describe('Worst drawdown across all dates in ETH.'),
          }),
        ),
      },
    },
    rhTargetTool,
  )

  return server
}

// HTTP server with Streamable HTTP MCP transport
const app = express()
app.use(cors())
app.use(express.json())

// Admin endpoints for API key management (protected by MCP_ADMIN_KEY)
function adminAuth(req: Request, res: Response, next: () => void) {
  if (!ADMIN_KEY) { res.status(503).json({ error: 'Admin not configured' }); return }
  const auth = req.headers['authorization'] ?? ''
  if (auth !== `Bearer ${ADMIN_KEY}`) { res.status(401).json({ error: 'Unauthorized' }); return }
  next()
}

app.get('/api/keys', adminAuth, (_req: Request, res: Response) => {
  res.json(getKeys())
})

app.post('/api/keys', adminAuth, (req: Request, res: Response) => {
  const { name } = req.body ?? {}
  if (!name || typeof name !== 'string') { res.status(400).json({ error: 'name is required' }); return }
  const key = createKey(name.trim())
  res.status(201).json(key)
})

app.delete('/api/keys/:id', adminAuth, (req: Request, res: Response) => {
  const deleted = deleteKey(req.params.id)
  if (!deleted) { res.status(404).json({ error: 'Key not found' }); return }
  res.json({ ok: true })
})

app.get('/api/ath-mc/lookup', async (req: Request, res: Response) => {
  const chain = parseAthLookupChain(req.query.chain)
  const ca = typeof req.query.ca === 'string' ? req.query.ca.trim() : ''
  if (!chain || !ca) {
    res.status(400).json({ error: 'chain and ca are required' })
    return
  }
  try {
    res.json(await fetchAthMc(chain, ca))
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'lookup failed' })
  }
})

app.get('/api/ath-mc', (_req: Request, res: Response) => {
  res.json(getAthMcMap())
})

app.post('/api/ath-mc', (req: Request, res: Response) => {
  const body = req.body ?? {}
  const ca = typeof body.ca === 'string' ? caKey(body.ca.trim()) : ''
  const user = typeof body.user === 'string' ? body.user.trim() : ''
  let value: number | null = null
  if (body.value != null) {
    const parsed = Number(body.value)
    if (!Number.isFinite(parsed)) {
      res.status(400).json({ error: 'invalid ath mc' })
      return
    }
    value = parsed > 0 ? parsed : null
  }
  if (!ca || !USER_ID_RE.test(user)) {
    res.status(400).json({ error: 'invalid ath mc' })
    return
  }
  res.json(saveAthMc(ca, user, value))
})

const SSE_KEEPALIVE_MS = 15_000

function attachSseKeepAlive(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')

  const timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(timer)
      return
    }
    if (!res.headersSent) return
    const contentType = String(res.getHeader('Content-Type') ?? '')
    if (!contentType.includes('text/event-stream')) return
    try {
      res.write(': keepalive\n\n')
    } catch {
      clearInterval(timer)
    }
  }, SSE_KEEPALIVE_MS)
  timer.unref()

  const stop = () => clearInterval(timer)
  req.once('close', stop)
  res.once('close', stop)
  res.once('finish', stop)
  return stop
}

function createMcpTransport() {
  return new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
}

// Bearer-token auth guard for MCP endpoints (header or ?key= query param)
app.use('/mcp', (req: Request, res: Response, next) => {
  const auth = req.headers['authorization'] ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.key as string ?? '')
  if (!bearer) { res.status(401).json({ error: 'Unauthorized' }); return }
  const apiKey = validateBearer(bearer)
  if (!apiKey) { res.status(401).json({ error: 'Invalid API key' }); return }
  recordUsage(bearer)
  next()
})

app.post('/mcp', async (req: Request, res: Response) => {
  const transport = createMcpTransport()
  const mcpServer = buildServer()
  const stopKeepAlive = attachSseKeepAlive(req, res)
  await mcpServer.connect(transport)
  try {
    await transport.handleRequest(req, res, req.body)
  } finally {
    stopKeepAlive()
    await mcpServer.close()
  }
})

// SSE upgrade endpoint for clients that prefer it (e.g. Cursor's long-lived session stream)
app.get('/mcp', async (req: Request, res: Response) => {
  const transport = createMcpTransport()
  const mcpServer = buildServer()
  attachSseKeepAlive(req, res)
  await mcpServer.connect(transport)
  const cleanup = () => { void mcpServer.close() }
  req.once('close', cleanup)
  res.once('close', cleanup)
  await transport.handleRequest(req, res)
})

const PORT = Number(process.env.MCP_PORT ?? 3100)
const httpServer = app.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`)
  if (!ADMIN_KEY) console.warn('Warning: MCP_ADMIN_KEY not set — admin endpoints are disabled')
})
httpServer.requestTimeout = 0
httpServer.headersTimeout = 0
httpServer.timeout = 0
