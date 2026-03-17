import { getBacktestCalls } from './store.js'
import { findSolTarget } from '../../shared/sol-compute.js'
import type { SolCall } from '../../shared/types.js'

export const STEPS = 100

export default async ({ backtest_link, position, range }: { backtest_link: string; position: number; range: string }) => {
  let calls: SolCall[] = []
  try {
    calls = await getBacktestCalls(backtest_link)
  } catch (e) {
    return {
      content: [{ type: 'text' as const, text: String(e) }],
      isError: true,
    }
  }

  const match = range.trim().match(/^([\d.]+)(x?)\s+([\d.]+)(x?)$/)
  if (!match) {
    return {
      content: [{ type: 'text' as const, text: 'Error: invalid range format. Expected "3x 10x" (multiplier) or "50000 600000" (market cap).' }],
      isError: true,
    }
  }

  const start = parseFloat(match[1])
  const end = parseFloat(match[3])
  const isXs = match[2] === 'x' || match[4] === 'x'

  if (isNaN(start) || isNaN(end) || start >= end) {
    return {
      content: [{ type: 'text' as const, text: 'Error: range start must be less than end, and both must be numbers.' }],
      isError: true,
    }
  }

  const results = findSolTarget(calls, position, start, end, STEPS, isXs, 0, true)

  const structuredContent = {
    results: results.map(r => ({
      target: r.target,
      pnl_sol: r.totalPnl,
      drawdown_sol: r.drawdown,
      worst_drawdown_sol: r.worstDrawdown[1],
    }))
  }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  }
}
