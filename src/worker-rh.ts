import readXlsxFile from 'read-excel-file/web-worker'
import type { RhCall, CallDiff } from './types/Call'
import type { Log } from './types/Log'
import type { TakeProfit } from './types/TakeProfit'
import { initHash } from './lib'
import { REALISTIC_MAX_XS } from './constants'
import { computeCallGain } from '../shared/rh-compute'
import { computeDrawdowns } from '../shared/sol-compute'
import { ComputeVariant } from './types/ComputeVariant'
import { ComputationForTarget, ComputationResult } from './types/ComputationResult'
import { HashInfo } from './types/HashInfo'
import { extractDate, round } from '../shared/utils'

const computeControllers: Record<ComputeVariant, AbortController | null> = {
  [ComputeVariant.LEFT]: null,
  [ComputeVariant.RIGHT]: null,
  [ComputeVariant.COMMON]: null,
  [ComputeVariant.MAIN]: null,
}
let targetingController: AbortController | null = null

onmessage = async function ({ data }) {
  if (!data?.type) return

  if (data.type === 'PARSE_XLSX') {
    for (const xlsx of data.allXlsx) {
      const rows = await readXlsxFile(xlsx)
      postMessage({ type: 'PARSED_XLSX', rows, fileName: xlsx.name })
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
      type: 'COMPUTED',
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
      type: 'DIFFED',
      diff: getCallsDiff(data.previousCalls, data.newCalls),
    })
}

async function compute(
  {
    calls,
    position,
    takeProfits,
    averageSlippage,
    realisticEntry,
    applySnipeTax = true,
    buyTaxInXs = true,
    week,
    hours,
    timeOnCreation = false,
  }: {
    calls: RhCall[]
    position: number
    takeProfits: TakeProfit[]
    averageSlippage: number
    realisticEntry: boolean
    applySnipeTax?: boolean
    buyTaxInXs?: boolean
    timeOnCreation?: boolean
    week?: Array<boolean | null>
    hours?: boolean[][]
  },
  abortSignal: AbortSignal,
) {
  let finalWorth = 0
  const counters: ComputationResult['counters'] = {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    offPeriods: 0,
    x100Sum: 0,
    x100: 0,
    x50: 0,
    x20: 0,
    x10: 0,
    x5: 0,
    x2: 0,
  }
  const logs: Log[] = []
  const quotes: Record<string, HashInfo<RhCall>> = {}
  const deployers: Record<string, HashInfo<RhCall>> = {}
  let volume = 0

  const gainByDate: Record<string, number> = {}
  const addGain = (date: string, gain: number) => {
    const day = extractDate(date)
    gainByDate[day] = (gainByDate[day] || 0) + gain
  }

  for (const call of calls) {
    if (abortSignal.aborted) return {}

    const offPeriods = !isCallInActiveHour(timeOnCreation ? call.creation : call.date, week, hours)
    if (offPeriods) {
      counters.offPeriods = (counters.offPeriods || 0) + 1
    }

    const {
      gain,
      bestXs,
      totalImpact,
      realisticEntryMc,
      hitTp,
      saleGains,
      invested,
      buyTaxPct,
      info,
    } = computeCallGain(
      call,
      position,
      takeProfits,
      averageSlippage,
      realisticEntry,
      applySnipeTax,
      buyTaxInXs,
    )

    volume += invested

    const unrealistic = call.xs > REALISTIC_MAX_XS || bestXs >= REALISTIC_MAX_XS
    if (unrealistic) counters.unrealistic++
    if (call.postAth) counters.postAth++

    if (!call.ignored && !offPeriods) {
      addGain(call.date, -invested)
      for (const sg of saleGains) addGain(sg.date, sg.amount)
      finalWorth += gain
    }

    if (!call.ignored && !call.postAth && !offPeriods) {
      if (bestXs >= 100) {
        counters.x100++
        counters.x100Sum += bestXs
      }
      if (bestXs >= 50) counters.x50++
      if (bestXs >= 20) counters.x20++
      if (bestXs >= 10) counters.x10++
      if (bestXs >= 5) counters.x5++
      if (bestXs >= 2) counters.x2++

      const bump = (map: Record<string, HashInfo<RhCall>>, id: string) => {
        if (!id) return
        if (!map[id]) map[id] = initHash<RhCall>(id)
        map[id].allCalls.push(call)
        if (call.xs >= 5) map[id].perf.x5++
        if (call.xs >= 10) map[id].perf.x10++
        if (call.xs >= 50) map[id].perf.x50++
        if (call.xs >= 100) map[id].perf.x100++
        if (call.ath >= 1000000) map[id].mooners++
        if (call.ath >= 2000000) map[id].mooners2++
        map[id].xSum += call.xs
      }

      bump(quotes, call.quoteSymbol)
      bump(deployers, call.deployer)
    }

    logs.unshift({
      date: call.date,
      creation: call.creation,
      ca: call.ca,
      name: call.name,
      xs: round(bestXs, 1),
      xsDiff: round(bestXs - call.xs, 0),
      ath: call.ath,
      exportAth: call.exportAth,
      callMc: call.callMc,
      entryMc: realisticEntryMc,
      info,
      invested: round(invested, 4),
      gain: round(gain, Math.abs(gain) < 0.01 ? 4 : 3),
      hitTp,
      slippage: round(totalImpact, 3),
      ignored: call.ignored,
      flag: offPeriods ? 'off' : call.ignored ? 'ignored' : '',
      supply: call.supply,
      basePrice: call.ethPrice,
      buyTax: round(buyTaxPct, 2),
      callBlock: call.launchedBlock || undefined,
      theoricBlock: call.updatedBlock || call.launchedBlock || undefined,
    })
  }

  const { drawdown, worstDrawdown } = computeDrawdowns(gainByDate)

  return {
    finalWorth: finalWorth ? round(finalWorth, 3) : finalWorth,
    drawdown: round(drawdown, 3),
    worstDrawdown,
    volume: round(volume, 3),
    counters,
    logs,
    quotes,
    deployers,
  }
}

function getCallsDiff(previousCalls: RhCall[], newCalls: RhCall[]): CallDiff<RhCall>[] {
  if (!previousCalls.length || !newCalls.length) return []

  const diff = [] as CallDiff<RhCall>[]
  const previousCAs = new Set(previousCalls.map(c => c.ca))
  const newCAs = new Set(newCalls.map(c => c.ca))

  for (const call of newCalls) {
    diff.push({
      call,
      status: previousCAs.has(call.ca) ? 'IN-BOTH' : 'ADDED',
    })
  }

  for (const call of previousCalls) {
    if (!newCAs.has(call.ca)) {
      diff.push({ call, status: 'REMOVED' })
    }
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
    averageSlippage,
    realisticEntry,
    applySnipeTax = true,
    buyTaxInXs = true,
  }: {
    calls: RhCall[]
    position: number
    targetStart: TakeProfit
    end: number
    increment: number
    averageSlippage: number
    realisticEntry: boolean
    applySnipeTax?: boolean
    buyTaxInXs?: boolean
  },
  abortSignal: AbortSignal,
): Promise<ComputationForTarget[] | null> {
  const withMc = targetStart.withMc
  const withXs = targetStart.withXs
  let currentTP = { ...targetStart }
  const inc = (): boolean => {
    const prop = withMc ? 'mc' : withXs ? 'xs' : 'amount'
    currentTP[prop] = round(currentTP[prop] + increment, 2)
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
        averageSlippage,
        realisticEntry,
        applySnipeTax,
        buyTaxInXs,
      },
      abortSignal,
    )

    if (finalWorth === undefined) {
      return null
    }

    results.push({
      finalWorth,
      drawdown,
      worstDrawdown,
      volume,
      target: withMc ? `$${currentTP.mc}` : withXs ? `${currentTP.xs}x` : `${currentTP.amount}Ξ`,
    })

    ended = inc()
  } while (!ended)

  return results
}

function isCallInActiveHour(startDate: string, week?: Array<boolean | null>, hours?: boolean[][]): boolean {
  if (!week || !hours) return true

  if (week.some(active => !active)) {
    const date = new Date(startDate)
    const callDay = date.getUTCDay()
    if (week[callDay]) return true
    else if (week[callDay] === false) return false
    const callHour = date.getUTCHours()
    return hours[callDay][callHour]
  }

  return true
}
