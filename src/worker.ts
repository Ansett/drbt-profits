import readXlsxFile from 'read-excel-file/web-worker'
import writeXlsxFile from 'write-excel-file'
import type { Call, CallDiff, CallExportType } from './types/Call'
import type { Log } from './types/Log'
import type { TakeProfit } from './types/TakeProfit'
import { guessValues, prettifyDate, prettifyMc, round } from './lib'
import type { HashInfo } from './types/HashInfo'
import type {
  ComputationForTarget,
  ComputationResult,
  ComputationShortResult,
} from './types/ComputationResult'
import { ETH_PRICE, SELL_TAX, SELL_GAS_PRICE, DEFAULT_SLIPPAGE } from './constants'
// import realBuys from "../buys.json";

onmessage = async function ({ data }) {
  if (!data?.type) return

  if (data.type === 'XLSX') {
    for (const xlsx of data.allXlsx) {
      const rows = await readXlsxFile(xlsx)
      postMessage({ type: 'XLSX', rows, fileName: xlsx.name })
    }
    return
  }
  if (data.type === 'COMPUTE')
    return postMessage({
      type: 'COMPUTE',
      ...compute(data),
      variant: data.variant,
    })
  if (data.type === 'TARGETING') return postMessage({ type: 'TARGETING', result: findTarget(data) })
  if (data.type === 'DIFF')
    return postMessage({
      type: 'DIFF',
      diff: getCallsDiff(data.previousCalls, data.newCalls),
    })
  if (data.type === 'MERGE')
    return postMessage({
      type: 'MERGE',
      title: data.title,
      rows: mergeRows(data.leftRows, data.rightRows, data.caColumn)[data.title as CallExportType],
    })
}

const REALISTIC_MAX_XS = 10000

const computeMaxETH = (currentMC: number, supply: number, maxBuy: number) => {
  const supplyBought = maxBuy * supply
  return ((currentMC / supply) * supplyBought) / ETH_PRICE
}

const getGasPrice = (call: Call, gweiDelta: number): number =>
  ((call.gwei + gweiDelta) / 1000000000) * call.buyGas
const ethToGwei = (eth: number, buyGas: number, baseGwei: number) =>
  Math.max(0, (eth / buyGas) * 1000000000 - baseGwei)

const getPriceImpact = (lpBase: number, price: number, amount: number): number => {
  const lpToken = (lpBase ^ 2) / price
  const constant = lpBase * lpToken
  const newLpBase = lpBase + amount
  const newLpToken = constant / newLpBase
  const tokenReceived = lpToken - newLpToken
  const paid = amount / tokenReceived
  const impact = (paid / price - 1) * 100
  return impact
}

const getSlippage = (call: Call, gweiDelta: number): number => {
  const approxSnipers = call.nbSnipes < 40 ? (call.nbSnipes + 1) * 2 : call.nbSnipes // boosting the low snipers counts
  const otherGweis = [...(approxSnipers > 2 ? guessValues(5, 100, 50, approxSnipers) : [])]

  const previousBuysCount = otherGweis.filter(g => g >= gweiDelta).length
  const impact = previousBuysCount
    ? getPriceImpact(
        call.lp * ETH_PRICE,
        call.price,
        previousBuysCount *
          Math.min(Math.min(call.maxBuy, 0.02) * call.supply * call.price, 0.05 * ETH_PRICE),
      )
    : 0

  return impact
}

function compute({
  calls,
  position,
  gweiDelta,
  takeProfits,
  buyTaxInXs,
  feeInXs,
  slippageGuessing,
}: {
  calls: Call[]
  position: number
  gweiDelta: number
  takeProfits: TakeProfit[]
  buyTaxInXs: boolean
  feeInXs: boolean
  slippageGuessing: boolean
}): ComputationResult {
  let finalETH = 0
  let drawdown = 0
  let profitByDate: [string, number][] = []
  let drawdownByDate: [string, number][] = []
  const counters = {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    x100: 0,
    x50: 0,
    x10: 0,
  }
  const logs: Log[] = []
  // const accuracy: any[] = [];
  const hashes: Record<string, HashInfo> = {}
  const signatures: Record<string, HashInfo> = {}

  calls.forEach(call => {
    const maxBuyETH = computeMaxETH(call.callMc, call.supply, call.maxBuy)
    let invested = Math.min(maxBuyETH || position, position)
    if (Number.isNaN(invested)) {
      invested = position
    }

    if (call.rug) counters.rug++
    const unrealistic = !call.rug && call.xs > REALISTIC_MAX_XS
    if (unrealistic) counters.unrealistic++
    const postAth = !call.rug && call.date > call.athDate
    if (postAth) counters.postAth++

    const gasPrice = getGasPrice(call, gweiDelta)
    let gain = -invested - gasPrice
    // remove buy tax either directly on Xs, or later when calculating profit
    const buyTaxForGain = buyTaxInXs ? 1 : 1 - call.buyTax
    const slippage =
      slippageGuessing && call.delay < 15
        ? getSlippage(call, gweiDelta) + DEFAULT_SLIPPAGE
        : DEFAULT_SLIPPAGE
    let effectiveXs = call.xs / (1 + slippage / 100)
    if (buyTaxInXs) effectiveXs = effectiveXs * (1 - call.buyTax)

    const bestXs = unrealistic ? REALISTIC_MAX_XS : effectiveXs
    // we reduce Xs used for targeting with gas fee, but we later need to revert that when using the Xs to actually calculate the final profit
    const getXsWithFee = (rawXs: number) =>
      feeInXs ? rawXs * (invested / (invested + gasPrice)) : rawXs
    const getXsWouthFee = (XsWithFee: number) =>
      feeInXs ? XsWithFee / (invested / (invested + gasPrice)) : XsWithFee

    const hitTp: string[] = []

    if (!call.rug && !postAth) {
      let remainingPosition = 100
      let tpIndex = 0
      for (const tp of takeProfits) {
        const targetXsDirect = tp.withXs ? tp.xs : 0
        const targetXsFromMc = tp.withMc ? (bestXs / call.ath) * tp.mc : 0
        const firstTargetMet = !targetXsDirect
          ? targetXsFromMc
          : !targetXsFromMc
          ? targetXsDirect
          : Math.min(targetXsDirect, targetXsFromMc)

        if (getXsWithFee(bestXs) >= firstTargetMet && tp.size) {
          gain +=
            ((invested * tp.size) / 100) *
              getXsWouthFee(firstTargetMet) *
              buyTaxForGain *
              (1 - SELL_TAX / 100) -
            SELL_GAS_PRICE
          remainingPosition -= tp.size
          hitTp.push('TP' + (tpIndex + 1))
        }
        if (remainingPosition <= 0) break
        tpIndex++
      }

      if (bestXs >= 100) counters.x100++
      if (bestXs >= 50) counters.x50++
      if (bestXs >= 10) counters.x10++
    }

    finalETH += gain
    if (finalETH < drawdown) drawdown = round(finalETH)
    profitByDate = [...profitByDate, [call.date, 0]]
    for (const p of profitByDate) {
      p[1] += gain
    }
    drawdownByDate = [...drawdownByDate, [prettifyDate(call.date), 0]]
    for (const index in drawdownByDate) {
      if (profitByDate[index][1] < drawdownByDate[index][1])
        drawdownByDate[index][1] = round(profitByDate[index][1])
    }

    // Regrouping hashes
    if (call.hashF) {
      if (!hashes[call.hashF]) hashes[call.hashF] = initHash(call.hashF)
      hashes[call.hashF].allCalls.push(call)
      if (call.rug) hashes[call.hashF].rugs++
      if (call.xs >= 5 && !call.rug) hashes[call.hashF].perf.x5++
      if (call.xs >= 10 && !call.rug) hashes[call.hashF].perf.x10++
      if (call.xs >= 50 && !call.rug) hashes[call.hashF].perf.x50++
      if (call.xs >= 100 && !call.rug) hashes[call.hashF].perf.x100++
      hashes[call.hashF].xSum += call.rug ? 0 : call.xs
    }

    // Regrouping function 4bytes signatures
    if (call.fList) {
      for (const id of call.fList.split(',')) {
        if (!signatures[id]) signatures[id] = initHash(id)
        signatures[id].allCalls.push(call)
        if (call.rug) signatures[id].rugs++
        if (call.xs >= 5 && !call.rug) signatures[id].perf.x5++
        if (call.xs >= 10 && !call.rug) signatures[id].perf.x10++
        if (call.xs >= 50 && !call.rug) signatures[id].perf.x50++
        if (call.xs >= 100 && !call.rug) signatures[id].perf.x100++
        signatures[id].xSum += call.rug ? 0 : call.xs
      }
    }

    // if (realBuys) {
    //   const realBuy = realBuys.find((b) => b.ca === call.ca.toLowerCase());
    //   if (realBuy) {
    //     const price =
    //       (realBuy.eth * ETH_PRICE) / (realBuy.amount! / (1 - call.buyTax));
    //   const realBuyMc = call.supply * price;
    //   const theoricBuyMc = call.callMc * (1 + slippage / 100);
    //   if (call.xs >= 40 && !call.rug)
    //     accuracy.push({
    //       slippage: round(slippage, 0),
    //       snipes: call.nbSnipes,
    //       theoricDiff: (theoricBuyMc / realBuyMc - 1) * 100,
    //       theoricBuyMc,
    //       realBuyMc,
    //       ca: call.ca,
    //     });
    //   }
    // }

    logs.unshift({
      date: prettifyDate(call.date),
      ca: call.ca,
      name: call.name,
      xs: call.rug ? -99 : round(bestXs, 1),
      ath: call.ath,
      callMc: call.callMc,
      info: unrealistic
        ? `Unrealistic perf: Entry might be anormally low or ATH anormally high. Perf capped to ${REALISTIC_MAX_XS}x`
        : postAth
        ? 'Post-ath: Entry occured after the current ATH'
        : '',
      invested: round(invested, 3),
      gasPrice: round(gasPrice, 3),
      gain: round(gain, 3),
      hitTp,
      slippage: round(slippage, 2),
    })
  })

  // console.log(accuracy);
  // console.log(
  //   accuracy.reduce((sum, acc) => sum + acc.theoricDiff, 0) / accuracy.length
  // );
  // console.log(accuracy.map((v) => v.slippage));
  // console.log(accuracy.map((v) => v.snipes));
  // console.log(accuracy.map((v) => v.theoricDiff));

  return {
    finalETH: round(finalETH),
    drawdown: round(drawdown),
    worstDrawdown: drawdownByDate.reduce((prev, cur) => (cur[1] < prev[1] ? cur : prev), ['', 0]),
    counters,
    logs,
    hashes,
    signatures,
  }
}

function getCallsDiff(previousCalls: Call[], newCalls: Call[]): CallDiff[] {
  if (!previousCalls.length || !newCalls.length) return []
  const diff = [] as CallDiff[]

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

function initHash(id: string) {
  return {
    id,
    tags: [],
    perf: {
      x5: 0,
      x10: 0,
      x50: 0,
      x100: 0,
    },
    rugs: 0,
    xSum: 0,
    allCalls: [],
  }
}

function findTarget({
  calls,
  position,
  gweiDelta,
  targetStart,
  buyTaxInXs,
  feeInXs,
  slippageGuessing,
  end,
  increment,
}: {
  calls: Call[]
  position: number
  gweiDelta: number
  targetStart: TakeProfit
  buyTaxInXs: boolean
  feeInXs: boolean
  slippageGuessing: boolean
  end: number
  increment: number
}): ComputationForTarget[] {
  const withMc = targetStart.withMc
  let currentTP = { ...targetStart }
  const inc = (): boolean => {
    const prop = withMc ? 'mc' : 'xs'
    currentTP[prop] += increment
    return currentTP[prop] > end
  }

  let ended = false
  const results = [] as ComputationForTarget[]
  do {
    const { finalETH, drawdown, worstDrawdown } = compute({
      calls,
      position,
      gweiDelta,
      buyTaxInXs,
      feeInXs,
      slippageGuessing,
      takeProfits: [currentTP],
    })
    results.push({
      finalETH,
      drawdown,
      worstDrawdown,
      target: withMc ? `$${currentTP.mc}` : `${currentTP.xs}x`,
    })

    ended = inc()
  } while (!ended)

  return results
}

function mergeRows(
  leftRows: (string | number)[][],
  rightRows: (string | number)[][],
  caColumn: number,
) {
  const headers = leftRows[0]
  leftRows.splice(0, 1)
  rightRows.splice(0, 1)

  const onlyLeft = [transformRow(headers)]
  const onlyRight = [transformRow(headers)]
  const inBoth = [transformRow(headers)]
  const all = [transformRow(headers)]

  for (const leftRow of leftRows) {
    const transformedRow = transformRow(leftRow)
    all.push(transformedRow)

    if (rightRows.every(rightRow => rightRow[caColumn] !== leftRow[caColumn])) {
      onlyLeft.push(transformedRow)
    }
  }

  for (const rightRow of rightRows) {
    const transformedRow = transformRow(rightRow)
    if (leftRows.every(leftRow => leftRow[caColumn] !== rightRow[caColumn])) {
      onlyRight.push(transformedRow)
      all.push(transformedRow)
    } else {
      inBoth.push(transformedRow)
    }
  }

  return {
    Left: onlyLeft,
    Right: onlyRight,
    Intersection: inBoth,
    Merge: all,
  }
}

function transformRow(row: (string | number)[]): {
  value: string | number
  format?: string
}[] {
  return row.map(cell => ({
    value: cell,
    format:
      // stringification before worker post has transformed Date to string, so passing along a format for the XLSX export
      typeof cell === 'string' && cell.includes('.000Z') ? 'yyyy/mm/dd hh:mm:ss' : '',
  }))
}
