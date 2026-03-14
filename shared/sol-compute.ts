import type { RawSolRow, SolCall, TakeProfit } from './types.js'
import { AVERAGE_LP_TO_MC_RATIO, INITIAL_TP_SIZE_CODE, REALISTIC_MAX_XS } from '../src/constants.js'
import { extractDate, round, getSaleDate, getPriceImpact, getDate } from './utils.js'

export interface CallGainResult {
  gain: number
  bestXs: number
  totalImpact: number
  realisticEntryMc: number
  hitTp: string[]
  saleGains: Array<{ date: string; amount: number }>
}

/**
 * Computes gain/loss for a single call given take-profit targets.
 * This is the shared kernel used by both worker-sol.ts and the MCP compute tool.
 */
export function computeCallGain(
  call: SolCall,
  position: number,
  takeProfits: TakeProfit[],
  averageSlippage: number,
  realisticEntry: boolean,
): CallGainResult {
  const unrealistic = call.xs > REALISTIC_MAX_XS
  const realisticEntryMc = realisticEntry ? call.entryMc : call.callMc
  const buyPrice = (realisticEntryMc + averageSlippage) / call.supply
  const tokens = position / buyPrice
  const impact = getPriceImpact(call.lp * call.solPrice, buyPrice, tokens)
  const newPrice = buyPrice * (1 + impact / 100)
  const totalImpact = Math.max(0, (newPrice / buyPrice - 1) * 100)

  let bestXs = call.xs / (1 + totalImpact / 100)
  bestXs = unrealistic ? REALISTIC_MAX_XS : bestXs

  let gain = -position
  const hitTp: string[] = []
  const saleGains: Array<{ date: string; amount: number }> = []

  if (!call.postAth) {
    let remainingPosition = 100
    let tpIndex = 0
    const totalTokens = (position * call.solPrice) / buyPrice
    let sizeSoldForInitial = 0

    for (const tp of takeProfits) {
      const targetXsDirect = tp.withXs ? tp.xs : 0
      const targetXsFromEth = tp.withAmount ? tp.amount / position : 0
      const targetXsFromMc = tp.withMc ? (bestXs / call.ath) * tp.mc : 0
      const allTargets = [targetXsDirect, targetXsFromEth, targetXsFromMc].filter(v => v > 0)

      const reachedXsTarget = bestXs >= targetXsDirect ? targetXsDirect : 0
      const reachedEthTarget = bestXs >= targetXsFromEth ? targetXsFromEth : 0
      const reachedMcTarget = bestXs >= targetXsFromMc ? targetXsFromMc : 0
      const allReachedTargets = [reachedXsTarget, reachedEthTarget, reachedMcTarget].filter(v => v > 0)

      const reachedTarget = allReachedTargets.length
        ? tp.andLogic
          ? allReachedTargets.length === allTargets.length
            ? Math.max(...allReachedTargets)
            : 0
          : Math.min(...allReachedTargets)
        : 0

      const xsMultiplicator = reachedTarget

      if (tp.size && reachedTarget) {
        const sizeSold =
          tp.size === INITIAL_TP_SIZE_CODE
            ? ((position / xsMultiplicator) * 100) / position
            : (tp.size * (100 - sizeSoldForInitial)) / 100

        if (sizeSold <= 0) {
          tpIndex++
          continue
        }

        const salePrice = buyPrice * reachedTarget
        const saleMc = salePrice * call.supply
        const dollarLp = saleMc * (call.lpRatio || AVERAGE_LP_TO_MC_RATIO)
        const tokensSold = (totalTokens * sizeSold) / 100
        const priceImpact = Math.min(100, Math.abs(getPriceImpact(dollarLp, salePrice, tokensSold)))

        const profit = ((position * sizeSold) / 100) * xsMultiplicator * (1 - priceImpact / 100)

        gain += profit
        saleGains.push({ date: getSaleDate(call, saleMc), amount: profit })

        if (tp.size === INITIAL_TP_SIZE_CODE) sizeSoldForInitial = sizeSold
        else remainingPosition -= sizeSold

        hitTp.push('TP' + (tpIndex + 1))
      }

      if (remainingPosition <= 0) break
      tpIndex++
    }
  }

  return { gain, bestXs, totalImpact, realisticEntryMc, hitTp, saleGains }
}

export function computeDrawdowns(gainByDate: Record<string, number>): { drawdown: number, worstDrawdown: [string, number] } {
  const dates = Object.keys(gainByDate).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  let cumulatedProfitByDate: [string, number][] = []
  let drawdownByDate: [string, number][] = []
  for (const date of dates) {
    cumulatedProfitByDate = [...cumulatedProfitByDate, [date, 0]]
    for (const p of cumulatedProfitByDate) {
      p[1] += gainByDate[date]
    }
    drawdownByDate = [...drawdownByDate, [date, 0]]
    for (const index in drawdownByDate) {
      if (cumulatedProfitByDate[index][1] < drawdownByDate[index][1])
        drawdownByDate[index][1] = round(cumulatedProfitByDate[index][1])
    }
  }

  return {
    drawdown: drawdownByDate[0][1],
    worstDrawdown: drawdownByDate.reduce<[string, number]>(
      (prev, cur) => (cur[1] < prev[1] ? cur : prev),
      ['', 0],
    )
  }
}

export interface ComputeParams {
  position: number
  takeProfits: TakeProfit[]
  averageSlippage: number
  realisticEntry: boolean
}

export interface ComputeResult {
  totalPnl: number
  drawdown: number
  worstDrawdown: [string, number]
  volume: number
}

export function compute(calls: SolCall[], params: ComputeParams): ComputeResult {
  const { position, takeProfits, averageSlippage, realisticEntry } = params

  let finalWorth = 0
  let volume = 0

  const gainByDate: Record<string, number> = {}
  const addGain = (date: string, gain: number) => {
    const day = extractDate(date)
    gainByDate[day] = (gainByDate[day] || 0) + gain
  }

  for (const call of calls) {
    if (call.ignored) continue

    volume += position

    const result = computeCallGain(call, position, takeProfits, averageSlippage, realisticEntry)

    addGain(call.date, -position)
    for (const sg of result.saleGains) addGain(sg.date, sg.amount)

    finalWorth += result.gain
  }

  const { drawdown, worstDrawdown} = computeDrawdowns(gainByDate)

  return {
    totalPnl: finalWorth ? round(finalWorth) : finalWorth,
    drawdown,
    worstDrawdown,
    volume: round(volume, 1),
  }
}

/**
 * MCP take-profit string parser
 *  "10% 3x"      → sell 10% at 3x multiplier
 *  "15.5% 500000" → sell 5.5% when MC reaches $500k
 */
export function parseTakeProfit(raw: string): TakeProfit | null {
  const m = raw.trim().match(/^([\d.]+)%\s+([\d.]+)(x?)$/)
  if (!m) return null
  const size = parseFloat(m[1])
  const value = parseFloat(m[2])
  const isXs = m[3] === 'x'
  if (isNaN(size) || isNaN(value)) return null
  return {
    size,
    xs: isXs ? value : 0,
    withXs: isXs,
    amount: 0,
    withAmount: false,
    mc: isXs ? 0 : value,
    withMc: !isXs,
    andLogic: false,
  }
}


export function rawRowsToSolCalls(rawRows: RawSolRow[], blackList = [] as string[]): SolCall[] {
  let hourShift = 0
  const calls: SolCall[] = []

  for (const raw of rawRows) {
    const creation = getDate(raw.created_at)
    const date = getDate(raw.snapshot_at)
    const ca = raw.mint
    const athDelaySec =
      raw.current_ath_slot && raw.launched_slot
        ? (raw.current_ath_slot - raw.launched_slot) * 0.4
        : 2 * 60 * 60 // 0.4s per slot
    const athDelayHours = athDelaySec / 60 / 60

    // there is a bug where creation date is utc+1, so we detect that and adjust all dates
    if (creation > date) {
      const diff = creation.getHours() - date.getHours()
      if (diff > hourShift) hourShift = diff
    }

    let programIds: string[] = []
    try {
      const stringPrograms = raw.program_ids.replaceAll("'", '"')
      programIds = JSON.parse(stringPrograms) as string[]
    } catch (e) {}

    let uriImage = ''
    try {
      const uriString = (raw.uri_content || '').replaceAll("'", '"')
      const uriContent = JSON.parse(uriString) as { image?: string }
      uriImage = uriContent?.image || ''
    } catch (e) {}

    calls.push({
      name: raw.name || ca,
      ca,
      nameAndCa: (raw.name || '') + ca,
      creation: creation.toISOString(),
      date: date.toISOString(),
      postAth: raw.post_ath === 'TRUE',
      xs: Number(raw.xs),
      callMc: raw.mc,
      entryMc: raw.entry_mc || raw.mc,
      athDelayHours,
      ath: raw.current_ath_mc,
      supply: raw.total_supply || 1000000000,
      lp: raw.lp_sol_launch || 0,
      ignored: blackList.includes(ca),
      solPrice: raw.sol_price,
      programIds,
      lpRatio: raw.lp_ratio,
      uriImage,
    } satisfies SolCall)
  }

  if (hourShift) {
    for (const call of calls) {
      const date = new Date(call.creation)
      date.setHours(date.getHours() - hourShift)
      call.creation = date.toISOString()
    }
  }

  return calls
}

export interface FindTargetResult {
  target: string
  totalPnl: number
  drawdown: number
  worstDrawdown: [string, number]
  volume: number
}

export function findSolTarget(
  calls: SolCall[],
  position: number,
  start: number,
  end: number,
  steps: number,
  isXs: boolean,
  averageSlippage = 0,
  realisticEntry = true,
): FindTargetResult[] {
  const increment = (end - start) / (steps - 1)
  const values = [...new Set(
    Array.from({ length: steps }, (_, i) => round(start + increment * i, 1))
  )]
  const results: FindTargetResult[] = []

  for (const value of values) {
    const tp: TakeProfit = {
      size: 100,
      xs: isXs ? value : 0,
      withXs: isXs,
      amount: 0,
      withAmount: false,
      mc: isXs ? 0 : value,
      withMc: !isXs,
      andLogic: false,
    }

    const { totalPnl, drawdown, worstDrawdown, volume } = compute(calls, {
      position,
      takeProfits: [tp],
      averageSlippage,
      realisticEntry,
    })

    results.push({
      target: isXs ? `${value}x` : `$${value}`,
      totalPnl,
      drawdown,
      worstDrawdown,
      volume,
    })
  }

  return results
}
