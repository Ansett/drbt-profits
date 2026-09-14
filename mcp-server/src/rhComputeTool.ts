import { getRhBacktestCalls } from './store.js'
import { parseTakeProfit } from '../../shared/sol-compute.js'
import { compute } from '../../shared/rh-compute.js'
import { getAthMcMap } from './athMc.js'
import type { RhCall, TakeProfit } from '../../shared/types.js'
import { sumObjectProperty } from '../../shared/utils.js'

export default async ({
  backtest_link,
  position,
  take_profits,
}: {
  backtest_link: string
  position: number
  take_profits: string[]
}) => {
  let calls: RhCall[] = []
  try {
    calls = await getRhBacktestCalls(backtest_link)
  } catch (e) {
    return {
      content: [
        {
          type: 'text' as const,
          text: String(e),
        },
      ],
      isError: true,
    }
  }

  const parsedTps = take_profits.map(parseTakeProfit)

  const invalid = take_profits.filter((_, i) => !parsedTps[i])
  if (invalid.length)
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: invalid take profit format: ${invalid.join(', ')}. Expected format as "10% 3x" or "15.5% 500000".`,
        },
      ],
      isError: true,
    }
  if (sumObjectProperty(parsedTps as TakeProfit[], tp => tp.size) > 100)
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Error: the sum of take profits sizes exceeds 100%',
        },
      ],
      isError: true,
    }

  const result = compute(calls, {
    position,
    takeProfits: parsedTps as TakeProfit[],
    averageSlippage: 0,
    realisticEntry: true,
    applySnipeTax: true,
    buyTaxInXs: true,
    athMc: getAthMcMap(),
  })

  const structuredContent = {
    pnl_eth: result.totalPnl,
    drawdown_eth: result.drawdown,
    worst_drawdown_eth: result.worstDrawdown[1],
    calls_count: calls.length,
  }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  }
}
