import readXlsxFile from 'read-excel-file/web-worker'
import type { SolCall, CallDiff } from './types/Call'
import type { Log } from './types/Log'
import type { TakeProfit } from './types/TakeProfit'
import {
  getSaleDate,
  extractDate,
  round,
  getPriceImpact,
  initHash
} from './lib'
import {
  AVERAGE_LP_TO_MC_RATIO,
  INITIAL_TP_SIZE_CODE,
  REALISTIC_MAX_XS,
} from './constants'
import { ComputeVariant } from './types/ComputeVariant'
import { ComputationForTarget, ComputationResult } from './types/ComputationResult'
import { HashInfo } from './types/HashInfo'


const computeControllers: Record<ComputeVariant, AbortController | null> = {
  [ComputeVariant.LEFT]: null,
  [ComputeVariant.RIGHT]: null,
  [ComputeVariant.COMMON]: null,
  [ComputeVariant.MAIN]: null,
}
let targetingController: AbortController | null = null

onmessage = async function ({ data }) {
  if (!data?.type) return

  if (data.type === 'XLSX') {
    for (const xlsx of data.allXlsx) {
      const rows = await readXlsxFile(xlsx)
      postMessage({ type: 'XLSX', rows, fileName: xlsx.name })
    }
    return
  }
  if (data.type === 'COMPUTE') {
    const variant: ComputeVariant = data.variant || ComputeVariant.MAIN
    computeControllers[variant]?.abort()
    computeControllers[variant] = new AbortController()
    const computation = await compute(data, computeControllers[variant]!.signal)
    if (computation.finalWorth === undefined) return

    return postMessage({
      type: 'COMPUTE',
      ...computation,
      variant,
    })
  }
  if (data.type === 'TARGETING') {
    targetingController?.abort()
    targetingController = new AbortController()
    const result = await findTarget(data, targetingController.signal)
    if (!result) return

    return postMessage({ type: 'TARGETING', result })
  }
  if (data.type === 'DIFF')
    return postMessage({
      type: 'DIFF',
      diff: getCallsDiff(data.previousCalls, data.newCalls),
    })
}

async function compute(
  {
    calls,
    position,
    takeProfits,
  }: {
    calls: SolCall[]
    position: number
    takeProfits: TakeProfit[]
  },
  abortSignal: AbortSignal,
) {
  let finalWorth = 0
  let drawdown = 0
  const counters: ComputationResult['counters'] = {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    x100Sum: 0,
    x100: 0,
    x50: 0,
    x20: 0,
    x10: 0,
    x5: 0,
    x2: 0,
  }
  const logs: Log[] = []
  const programs: Record<string, HashInfo<SolCall>> = {}
  let volume = 0

  const gainByDate: Record<string, number> = {}
  const addGain = (date: string, gain: number) => {
    const day = extractDate(date)
    gainByDate[day] = (gainByDate[day] || 0) + gain
  }

  for (const call of calls) {
    if (abortSignal.aborted) return {}

    let invested = position
    volume += invested

    const unrealistic = call.xs > REALISTIC_MAX_XS
    if (unrealistic) counters.unrealistic++
    const postAth = call.postAth
    if (postAth) counters.postAth++

    let gain = -invested
    if (!call.ignored) {
      addGain(call.date, gain)
    }

    const tokens = invested / call.price
    const slippage = getPriceImpact(call.lp * call.solPrice, call.price, tokens)
    // const newPrice = call.price * (1 + priceImpact / 100)
    // const totalImpact = (newPrice / call.price - 1) * 100

    let bestXs = call.xs / (1 + slippage / 100)
    bestXs = unrealistic ? REALISTIC_MAX_XS : bestXs

    const hitTp: string[] = []
    if (!postAth) {
      let remainingPosition = 100
      let tpIndex = 0
      const totalTokens = (invested * call.solPrice) / call.price
      let sizeSoldForInitial = 0

      for (const tp of takeProfits) {
        const targetXsDirect = tp.withXs ? tp.xs : 0
        const targetXsFromEth = tp.withAmount ? tp.amount / invested : 0
        const targetXsFromMc = tp.withMc ? (bestXs / call.ath) * tp.mc : 0
        const allTargets = [targetXsDirect, targetXsFromEth, targetXsFromMc].filter(v => v > 0)

        const reachedXsTarget = bestXs >= targetXsDirect ? targetXsDirect : 0
        const reachedEthTarget = bestXs >= targetXsFromEth ? targetXsFromEth : 0
        const reachedMcTarget =
          bestXs >= targetXsFromMc ? targetXsFromMc : 0
        const allReachedTargets = [reachedXsTarget, reachedEthTarget, reachedMcTarget].filter(
          v => v > 0,
        )
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
            // size to get back initial
            tp.size === INITIAL_TP_SIZE_CODE
              ? ((invested / xsMultiplicator) * 100) /
              invested
              : // remove from other targets a portion of the size sold for initial
              tp.size * (100 - sizeSoldForInitial) / 100

          if (sizeSold <= 0) {
            tpIndex++
            continue
          }

          const salePrice = call.price * reachedTarget
          const saleMc = salePrice * call.supply
          const dollarLp = saleMc * (call.lpRatio || AVERAGE_LP_TO_MC_RATIO)
          const tokensSold = (totalTokens * sizeSold) / 100
          const priceImpact = Math.min(100, Math.abs(getPriceImpact(dollarLp, salePrice, tokensSold)))

          const profit =
            ((invested * sizeSold) / 100) *
            xsMultiplicator *
            (1 - priceImpact / 100)

          gain += profit
          if (!call.ignored) {
            addGain(getSaleDate(call, saleMc), profit)
          }
          if (tp.size === INITIAL_TP_SIZE_CODE) sizeSoldForInitial = sizeSold
          else remainingPosition -= sizeSold

          hitTp.push('TP' + (tpIndex + 1))
        }

        if (remainingPosition <= 0) break
        tpIndex++
      }
    }

    if (finalWorth < drawdown) {
      drawdown = round(finalWorth)
    }

    if (!call.ignored && !postAth) {
      finalWorth += gain

      if (bestXs >= 100) {
        counters.x100++
        counters.x100Sum += bestXs
      }
      if (bestXs >= 50) counters.x50++
      if (bestXs >= 20) counters.x20++
      if (bestXs >= 10) counters.x10++
      if (bestXs >= 5) counters.x5++
      if (bestXs >= 2) counters.x2++


      // Regrouping program IDs
      for (const programId of call.programIds) {
        if (!programs[programId]) programs[programId] = initHash(programId)
        programs[programId].allCalls.push(call)
        if (call.xs >= 5) programs[programId].perf.x5++
        if (call.xs >= 10) programs[programId].perf.x10++
        if (call.xs >= 50) programs[programId].perf.x50++
        if (call.xs >= 100) programs[programId].perf.x100++
        if (call.ath >= 1000000) programs[programId].mooners++
        if (call.ath >= 2000000) programs[programId].mooners2++
        programs[programId].xSum += call.xs
      }
    }

    logs.unshift({
      date: call.date,
      ca: call.ca,
      name: call.name,
      xs: round(bestXs, 1),
      xsDiff: round(bestXs - call.xs, 0),
      ath: call.ath,
      callMc: call.callMc,
      info: unrealistic
        ? `Unrealistic perf: Entry might be anormally low or ATH anormally high. Perf capped to ${REALISTIC_MAX_XS}x`
        : postAth
          ? 'Post-ath: Entry occured after the current ATH'
          : '',
      invested: round(invested, 3),
      gain: round(gain, gain < 1 ? 2 : 1),
      hitTp,
      slippage: round(slippage, 3),
      ignored: call.ignored,
      flag: call.ignored ? 'ignored' : '',
      supply: call.supply,
      basePrice: call.solPrice,
    })
  }

  /* Compute drawdowns: */
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
    finalWorth: finalWorth ? round(finalWorth) : finalWorth, // keep undefined value for abort controller
    drawdown: round(drawdown),
    // find the minimum value in all drawdowns
    worstDrawdown: drawdownByDate.reduce((prev, cur) => (cur[1] < prev[1] ? cur : prev), ['', 0]),
    volume: round(volume, 1),
    counters,
    logs,
    programs
  }
}

function getCallsDiff(previousCalls: SolCall[], newCalls: SolCall[]): CallDiff<SolCall>[] {
  if (!previousCalls.length || !newCalls.length) return []
  const diff = [] as CallDiff<SolCall>[]

  for (const call of newCalls) {
    diff.push({
      call,
      status: previousCalls.some(c => c.ca === call.ca) ? 'IN-BOTH' : 'ADDED',
    })
  }
  for (const call of previousCalls) {
    if (newCalls.every(c => c.ca !== call.ca)) diff.push({ call, status: 'REMOVED' })
  }

  return diff
}

async function findTarget(
  {
    calls,
    position,
    targetStart,
    end,
    increment,
  }: {
    calls: SolCall[]
    position: number
    targetStart: TakeProfit
    end: number
    increment: number
    withPriceImpact: boolean
  },
  abortSignal: AbortSignal,
): Promise<ComputationForTarget[] | null> {
  const withMc = targetStart.withMc
  const withXs = targetStart.withXs
  let currentTP = { ...targetStart }
  const inc = (): boolean => {
    const prop = withMc ? 'mc' : withXs ? 'xs' : 'amount'
    currentTP[prop] += increment
    return currentTP[prop] > end
  }

  let ended = false
  const results = [] as ComputationForTarget[]
  do {
    if (abortSignal.aborted) return null

    const { finalWorth, drawdown, worstDrawdown, volume } = await compute(
      {
        calls,
        position,
        takeProfits: [currentTP],
      },
      abortSignal,
    )

    if (finalWorth === undefined) {
      return null // aborted
    }

    results.push({
      finalWorth,
      drawdown,
      worstDrawdown,
      volume,
      target: withMc ? `$${currentTP.mc}` : withXs ? `${currentTP.xs}x` : `${currentTP.amount} Ξ`,
    })

    ended = inc()
  } while (!ended)

  return results
}