import { getRhBacktestCalls } from './store.js'
import { findRhTarget } from '../../shared/rh-compute.js'
import type { RhCall } from '../../shared/types.js'
import { parseRange, STEPS } from './targetTool.js'

export default async ({
  backtest_link,
  position,
  range,
}: {
  backtest_link: string
  position: number
  range: string
}) => {
  let calls: RhCall[] = []
  try {
    calls = await getRhBacktestCalls(backtest_link)
  } catch (e) {
    return {
      content: [{ type: 'text' as const, text: String(e) }],
      isError: true,
    }
  }

  const parsed = parseRange(range)
  if ('error' in parsed) {
    return {
      content: [{ type: 'text' as const, text: parsed.error }],
      isError: true,
    }
  }

  const results = findRhTarget(
    calls,
    position,
    parsed.start,
    parsed.end,
    STEPS,
    parsed.isXs,
    0,
    true,
  )

  const structuredContent = {
    results: results.map(r => ({
      target: r.target,
      pnl_eth: r.totalPnl,
      drawdown_eth: r.drawdown,
      worst_drawdown_eth: r.worstDrawdown[1],
    })),
  }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  }
}
