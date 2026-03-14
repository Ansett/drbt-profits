import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { z } from 'zod'
import computeTool from './computeTool.js'
import targetTool, { STEPS } from './targetTool.js'

// "Authorization": "Bearer <key>" }
const API_KEY = process.env.MCP_API_KEY

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
        total_pnl: z.number().describe('Net profit/loss in SOL.'),
        drawdown: z.number().describe('Drawdown from the first call date in SOL.'),
        worst_drawdown: z.number().describe('Worst drawdown across all dates in SOL.'),
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
        'Runs PnL simulations on a range of take profit targets for calls from DRBT backtesting, in order to see where the hot spots are to place take profits, if drawdowns are reasonable.',
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
          total_pnl: z.number().describe('Net profit/loss in SOL at this target.'),
          drawdown: z.number().describe('Drawdown from the first call date in SOL.'),
          worst_drawdown: z.number().describe('Worst drawdown across all dates in SOL.'),
        })),
      },
    },
    targetTool
  )

  return server
}

// HTTP server with Streamable HTTP MCP transport
const app = express()
app.use(cors())
app.use(express.json())

// Simple bearer-token auth guard for public hosting
app.use((req: Request, res: Response, next) => {
  if (!API_KEY) return next() // no key configured → open (dev mode)
  const auth = req.headers['authorization'] ?? ''
  if (auth === `Bearer ${API_KEY}`) return next()
  res.status(401).json({ error: 'Unauthorized' })
})

app.post('/mcp', async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const mcpServer = buildServer()
  await mcpServer.connect(transport)
  await transport.handleRequest(req, res, req.body)
  await mcpServer.close()
})

// SSE upgrade endpoint for clients that prefer it (e.g. older Claude Desktop versions)
app.get('/mcp', async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const mcpServer = buildServer()
  await mcpServer.connect(transport)
  await transport.handleRequest(req, res)
})

const PORT = Number(process.env.PORT ?? 3100)
app.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`)
  if (!API_KEY) console.warn('Warning: MCP_API_KEY not set — server is open to anyone')
})
