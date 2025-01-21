import readXlsxFile from 'read-excel-file/web-worker'
import type { Call, CallDiff, CallExportType } from './types/Call'
import type { AccuracyLog, Log } from './types/Log'
import type { TakeProfit } from './types/TakeProfit'
import {
  mean_absolute_percentage_error,
  mean_percentage_error,
  getSaleDate,
  prettifyDate,
  round,
  sumObjectProperty,
  uuid,
  getRowForExport,
  sleep,
} from './lib'
import type { HashInfo } from './types/HashInfo'
import type { ComputationForTarget, ComputationResult } from './types/ComputationResult'
import {
  SELL_TAX,
  SELL_GAS_PRICE,
  AVERAGE_LP_TO_MC_RATIO,
  EXCLUDED_FROM_ACCURACY,
  XS_WORTH_OF_ONCHAIN_DATA,
  CURRENT_CACHED_BLOCK_VERSION,
  INITIAL_TP_SIZE_CODE,
  ESTIMATED_TIME_FOR_ALCHEMY,
} from './constants'
import type { BlockTx } from './types/Transaction'
import { createBlockStore, getBlockDataFromStore, storeBlockDataInStore } from './db'
import { fetchAllBuysFrom, fetchTxsFromBlock } from './chain'
import { ComputeVariant } from './types/ComputeVariant'

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
    if (computation.finalETH === undefined) return

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

const REALISTIC_MAX_XS = 100000

const computeMaxETH = (currentMC: number, supply: number, maxBuy: number, ethPrice: number) => {
  const supplyBought = maxBuy * supply
  return ((currentMC / supply) * supplyBought) / ethPrice
}

const getGasPrice = (call: Call, gweiDelta: number): number =>
  ((call.gwei + gweiDelta) / 1000000000) * call.buyGas

const getPriceImpact = (lpAmount: number, previousPrice: number, nbTokens: number): number => {
  const lpOtherAmount = lpAmount / previousPrice
  const newPrice =
    (lpAmount - 1 * ((lpOtherAmount * lpAmount) / (lpOtherAmount + nbTokens) - lpAmount)) /
    (lpOtherAmount - nbTokens)
  const slippage = (newPrice / previousPrice - 1) * 100

  return slippage
}

// NOTE: Comparing tx cost (used gas * gas price) would be better than comparing just priority, in theory, but it's rarely the case, builders' algo is too complicated, and even worse we don't have the real gas quantity to calculate from (call's value from is not accurate, because it includes approval maybe)
const getSlippage = (call: Call, invested: number, gweiDelta: number, txs: BlockTx[]): number => {
  const previousTxs = txs.filter(tx => tx.priority >= gweiDelta)
  const lastTx = previousTxs.at(-1)
  const lastPrice = lastTx?.priceETH ? lastTx.priceETH * call.ethPrice : call.price

  const myTokens = invested / call.price
  const myPriceImpact = getPriceImpact(call.lp * call.ethPrice, lastPrice, myTokens)

  const newPrice = lastPrice * (1 + myPriceImpact / 100)
  const totalImpact = (newPrice / call.price - 1) * 100

  return Math.max(0, totalImpact)
}

async function compute(
  {
    calls,
    position,
    gweiDelta,
    prioBySnipes,
    takeProfits,
    buyTaxInXs,
    feeInXs,
    chainApiKey,
    withPriceImpact,
    withAccuracyAddy,
  }: {
    calls: Call[]
    position: number
    gweiDelta: number
    prioBySnipes: [number, number][] | null
    takeProfits: TakeProfit[]
    buyTaxInXs: boolean
    feeInXs: boolean
    chainApiKey: string
    withPriceImpact: boolean
    withAccuracyAddy?: string
  },
  abortSignal: AbortSignal,
) {
  let finalETH = 0
  let drawdown = 0
  const counters = {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    x100: 0,
    x50: 0,
    x20: 0,
    x10: 0,
    x5: 0,
    x2: 0,
  }
  await createBlockStore()
  const logs: Log[] = []
  const hashes: Record<string, HashInfo> = {}
  const signatures: Record<string, HashInfo> = {}

  const gainByDate: Record<string, number> = {}
  const addGain = (date: string, gain: number) => {
    const day = prettifyDate(date, 'date')
    gainByDate[day] = (gainByDate[day] || 0) + gain
  }

  let firstBlockOfPeriod = 0
  let volume = 0

  if (chainApiKey) {
    await postLoadingMessage(calls)
  }

  for (const call of calls) {
    if (abortSignal.aborted) return {}

    const maxBuyETH = computeMaxETH(call.callMc, call.supply, call.maxBuy, call.ethPrice)
    let invested = Math.min(maxBuyETH || position, position)
    if (Number.isNaN(invested)) {
      invested = position
    }

    if (call.rug) counters.rug++
    const unrealistic = !call.rug && call.xs > REALISTIC_MAX_XS
    if (unrealistic) counters.unrealistic++
    const postAth = callIsPostAth(call)
    if (postAth) counters.postAth++

    const usedPriority = getUsedPriority(call, gweiDelta, prioBySnipes)
    const gasPrice = getGasPrice(call, usedPriority)
    volume += invested + gasPrice
    let gain = -invested - gasPrice
    if (!call.ignored) {
      addGain(call.date, gain)
    }

    const { blockStart, blockEnd } = getBlockStartAndEnd(call)
    firstBlockOfPeriod =
      !firstBlockOfPeriod || blockStart < firstBlockOfPeriod ? blockStart : firstBlockOfPeriod
    const blockNeeded = chainApiKey && callWorthOnChainData(call)
    let blockTransactions: BlockTx[] | undefined | null = null

    if (blockNeeded) {
      blockTransactions = await getBlockDataFromStore(call.ca, blockStart, blockEnd)
      if (!blockTransactions) {
        blockTransactions = await fetchTxsFromBlock(
          blockStart,
          blockEnd,
          call.ca,
          call.decimals,
          chainApiKey,
        )
        if (!blockTransactions) {
          // retry one more time
          await sleep(3000)
          blockTransactions = await fetchTxsFromBlock(
            blockStart,
            blockEnd,
            call.ca,
            call.decimals,
            chainApiKey,
          )
        }
      }
    }

    if (!blockTransactions && blockNeeded) {
      postMessage({
        type: 'WARNING',
        text: 'Some block data could not be retrieved, so calculated slippage will be less acurate. Try to re-import the XLSX.',
      })
    }

    const slippage = blockTransactions
      ? getSlippage(call, invested, usedPriority, blockTransactions)
      : 50
    let bestXs = call.xs / (1 + slippage / 100)
    bestXs = unrealistic ? REALISTIC_MAX_XS : bestXs

    const feeMultiplicator = invested / (invested + gasPrice)
    const taxMultiplicator = 1 - call.buyTax
    // we reduce Xs used for targeting with gas fee, but we later need to revert that when using the Xs to actually calculate the final profit; only do that for Xs target, not MC target transformed in Xs
    const reducedXs = (rawXs: number, includeFee: boolean, includeTax: boolean) => {
      let xs = includeFee ? rawXs * feeMultiplicator : rawXs
      xs = includeTax ? xs * taxMultiplicator : xs
      return xs
    }
    const unreducedXs = (xsWithFeeAndGas: number, includedFee: boolean, includeTax: boolean) => {
      let xs = includedFee ? xsWithFeeAndGas / feeMultiplicator : xsWithFeeAndGas
      xs = includeTax ? xs / taxMultiplicator : xs
      return xs
    }

    const hitTp: string[] = []
    const reducedBestXs = reducedXs(bestXs, feeInXs, buyTaxInXs)

    if (!call.rug && !postAth) {
      let remainingPosition = 100
      let tpIndex = 0
      const totalTokens = (invested * call.ethPrice) / call.price
      let sizeSoldForInitial = 0

      for (const tp of takeProfits) {
        const targetXsDirect = tp.withXs ? tp.xs : 0
        const targetXsFromEth = tp.withEth ? reducedXs(tp.eth / invested, feeInXs, buyTaxInXs) : 0
        const targetXsFromMc = tp.withMc ? (bestXs / call.ath) * tp.mc : 0
        const allTargets = [targetXsDirect, targetXsFromEth, targetXsFromMc].filter(v => v > 0)

        const reachedXsTarget = reducedBestXs >= targetXsDirect ? targetXsDirect : 0
        const reachedEthTarget = reducedBestXs >= targetXsFromEth ? targetXsFromEth : 0
        const reachedMcTarget =
          reducedXs(bestXs, false, false) >= targetXsFromMc ? targetXsFromMc : 0
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
        const reachedTargetIsFromMc = reachedTarget === reachedMcTarget

        const xsMultiplicator = unreducedXs(
          reachedTarget,
          feeInXs && !reachedTargetIsFromMc,
          buyTaxInXs && !reachedTargetIsFromMc,
        )

        if (tp.size && reachedTarget) {
          const sizeSold =
            // size to get back initial
            tp.size === INITIAL_TP_SIZE_CODE
              ? (((invested + SELL_GAS_PRICE) / xsMultiplicator / (1 - SELL_TAX / 100)) * 100) /
                invested
              : // remove from other targets a portion of the size sold for initial
                tp.size -
                (takeProfits.length > 1 ? sizeSoldForInitial / (takeProfits.length - 1) : 0)
          if (sizeSold <= 0) {
            tpIndex++
            continue
          }

          const salePrice = call.price * reachedTarget
          const saleMc = salePrice * call.supply
          const dollarLp = saleMc * AVERAGE_LP_TO_MC_RATIO
          const tokensSold = (totalTokens * sizeSold) / 100
          const priceImpact = withPriceImpact
            ? Math.min(100, Math.abs(getPriceImpact(dollarLp, salePrice, tokensSold)))
            : 0

          const profit =
            ((invested * sizeSold) / 100) *
              xsMultiplicator *
              (1 - SELL_TAX / 100) *
              (1 - priceImpact / 100) -
            SELL_GAS_PRICE

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

      if (reducedBestXs >= 100) counters.x100++
      if (reducedBestXs >= 50) counters.x50++
      if (reducedBestXs >= 20) counters.x20++
      if (reducedBestXs >= 10) counters.x10++
      if (reducedBestXs >= 5) counters.x5++
      if (reducedBestXs >= 2) counters.x2++
    }

    if (!call.ignored) {
      finalETH += gain
    }
    if (finalETH < drawdown) {
      drawdown = round(finalETH)
    }

    // Regrouping hashes
    if (call.hashF && !call.ignored) {
      if (!hashes[call.hashF]) hashes[call.hashF] = initHash(call.hashF)
      hashes[call.hashF].allCalls.push(call)
      if (call.rug) hashes[call.hashF].rugs++
      if (call.xs >= 5 && !call.rug) hashes[call.hashF].perf.x5++
      if (call.xs >= 10 && !call.rug) hashes[call.hashF].perf.x10++
      if (call.xs >= 50 && !call.rug) hashes[call.hashF].perf.x50++
      if (call.xs >= 100 && !call.rug) hashes[call.hashF].perf.x100++
      if (call.ath >= 2000000 && !call.rug) hashes[call.hashF].mooners++
      hashes[call.hashF].xSum += call.rug ? 0 : call.xs
    }

    // Regrouping function 4bytes signatures
    if (call.fList && !call.ignored) {
      for (const id of call.fList.split(',')) {
        if (!signatures[id]) signatures[id] = initHash(id)
        signatures[id].allCalls.push(call)
        if (call.rug) signatures[id].rugs++
        if (call.xs >= 5 && !call.rug) signatures[id].perf.x5++
        if (call.xs >= 10 && !call.rug) signatures[id].perf.x10++
        if (call.xs >= 50 && !call.rug) signatures[id].perf.x50++
        if (call.xs >= 100 && !call.rug) signatures[id].perf.x100++
        if (call.ath >= 2000000 && !call.rug) signatures[id].mooners++
        signatures[id].xSum += call.rug ? 0 : call.xs
      }
    }

    logs.unshift({
      date: prettifyDate(call.date),
      ca: call.ca,
      name: call.name,
      xs: call.rug ? -99 : round(reducedBestXs, 1),
      ath: call.ath,
      callMc: call.callMc,
      info: unrealistic
        ? `Unrealistic perf: Entry might be anormally low or ATH anormally high. Perf capped to ${REALISTIC_MAX_XS}x`
        : postAth
        ? 'Post-ath: Entry occured after the current ATH'
        : '',
      invested: round(invested, 3),
      gasPrice: round(gasPrice, 3),
      gain: round(gain, gain < 1 ? 2 : 1),
      hitTp,
      slippage: round(slippage, 3),
      ignored: call.ignored,
      flag: call.ignored ? 'ignored' : '',
      nbBribes: call.nbBribes,
      buyTax: call.buyTax,
      supply: call.supply,
      delay: call.delay,
      callBlock: call.block,
      theoricBlock: blockEnd,
      ethPrice: call.ethPrice,
    })
  }

  if (chainApiKey && withAccuracyAddy && firstBlockOfPeriod) {
    compareToRealBuys(withAccuracyAddy, firstBlockOfPeriod, logs, chainApiKey)
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
    finalETH: finalETH ? round(finalETH) : finalETH, // keep undefined value for abort controller
    drawdown: round(drawdown),
    // find the minimum value in all drawdowns
    worstDrawdown: drawdownByDate.reduce((prev, cur) => (cur[1] < prev[1] ? cur : prev), ['', 0]),
    volume: round(volume, 1),
    counters,
    logs,
    hashes,
    signatures,
  }
}

function getBlockStartAndEnd(call: Call) {
  const blockStart = call.block + 1
  // if delay is 5-12s, we consider we buy block+2 instead of block+1 (delay we actually get is at least +1s from the XLSX delay)
  const blockEnd = call.block + (call.delay >= 5 && call.delay <= 12 ? 2 : 1)

  return { blockStart, blockEnd }
}

async function postLoadingMessage(calls: Call[]) {
  let callsCounter = 0
  for (const call of calls) {
    if (!callWorthOnChainData(call)) continue

    const { blockStart, blockEnd } = getBlockStartAndEnd(call)
    const blockTransactions = await getBlockDataFromStore(call.ca, blockStart, blockEnd)
    if (!blockTransactions) callsCounter++
  }
  if (!callsCounter) return

  const estimation = round((callsCounter * ESTIMATED_TIME_FOR_ALCHEMY) / 60, 0)
  postMessage({
    type: 'LOADING',
    text:
      `Fetching on-chain data` +
      (estimation >= 1
        ? `, it could take up to ${estimation} min${estimation > 1 ? 's' : ''} the first time`
        : ''),
  })
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
    mooners: 0,
    rugs: 0,
    xSum: 0,
    allCalls: [],
  }
}

async function findTarget(
  {
    calls,
    position,
    gweiDelta,
    prioBySnipes,
    targetStart,
    buyTaxInXs,
    feeInXs,
    chainApiKey,
    end,
    increment,
    withPriceImpact,
  }: {
    calls: Call[]
    position: number
    gweiDelta: number
    prioBySnipes: [number, number][] | null
    targetStart: TakeProfit
    buyTaxInXs: boolean
    feeInXs: boolean
    chainApiKey: string
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
    const prop = withMc ? 'mc' : withXs ? 'xs' : 'eth'
    currentTP[prop] += increment
    return currentTP[prop] > end
  }

  let ended = false
  const results = [] as ComputationForTarget[]
  do {
    if (abortSignal.aborted) return null

    const { finalETH, drawdown, worstDrawdown } = await compute(
      {
        calls,
        position,
        gweiDelta,
        prioBySnipes,
        buyTaxInXs,
        feeInXs,
        chainApiKey,
        takeProfits: [currentTP],
        withPriceImpact,
      },
      abortSignal,
    )

    if (finalETH === undefined) {
      return null // aborted
    }

    results.push({
      finalETH,
      drawdown,
      worstDrawdown,
      target: withMc ? `$${currentTP.mc}` : withXs ? `${currentTP.xs}x` : `${currentTP.eth} Ξ`,
    })

    ended = inc()
  } while (!ended)

  return results
}

async function compareToRealBuys(myAddy: string, firstBlock: number, logs: Log[], apiKey: string) {
  const myBuys = await fetchAllBuysFrom(myAddy, firstBlock, apiKey)
  let accuracy: AccuracyLog[] = []

  for (const log of logs) {
    const realBuy = myBuys.find(b => b.ca === log.ca.toLowerCase())
    if (realBuy) {
      const price = (realBuy.eth * log.ethPrice) / (realBuy.amount! / (1 - log.buyTax))
      const realBuyMc = log.supply * price
      const theoricBuyMc = log.callMc * (1 + log.slippage / 100)

      if (log.xs > XS_WORTH_OF_ONCHAIN_DATA)
        accuracy.push({
          slippage: round(log.slippage, 0),
          bribes: log.nbBribes,
          relativeError: ((realBuyMc - theoricBuyMc) / theoricBuyMc) * 100,
          theoricBuyMc,
          realBuyMc,
          ca: log.ca,
          delay: log.delay,
          callBlock: log.callBlock,
          theoricBlock: log.theoricBlock,
          realBlock: realBuy.block,
        })
    }
  }

  accuracy = accuracy.filter(acc => !EXCLUDED_FROM_ACCURACY.includes(acc.ca))

  console.log({
    nbTx: accuracy.length,
    error: mean_absolute_percentage_error(accuracy) + '% ' + mean_percentage_error(accuracy) + '%',
    ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].reduce(
      (obj, delay) => ({
        ...obj,
        ['delay' + delay]:
          mean_absolute_percentage_error(accuracy.filter(acc => acc.delay === delay)) +
          '% ' +
          mean_percentage_error(accuracy.filter(acc => acc.delay === delay)) +
          '%',
      }),
      {},
    ),
    worstAccuracy: accuracy.filter(acc => Math.abs(acc.relativeError) >= 100),
    accuracy,
  })

  postMessage({ type: 'SCATTER', accuracy })
}

function callIsPostAth(call: Call): boolean {
  return !call.rug && call.date > call.athDate
}
function callWorthOnChainData(call: Call): boolean {
  return !call.rug && !callIsPostAth(call) && call.xs > XS_WORTH_OF_ONCHAIN_DATA
}

function getUsedPriority(
  call: Call,
  gweiDelta: number,
  prioBySnipes: [number, number][] | null,
): number {
  if (!prioBySnipes) return gweiDelta
  if (call.delay >= 30) return prioBySnipes.find(p => p[0] === -1)?.[1] || gweiDelta
  if (call.lpVersion === 3) return prioBySnipes.find(p => p[0] === -3)?.[1] || gweiDelta

  const thresholdIndex = prioBySnipes.findIndex(p => p[0] > call.nbBribes)
  const appliedThreshold =
    prioBySnipes[thresholdIndex === -1 ? prioBySnipes.length - 1 : Math.max(0, thresholdIndex - 1)]

  return appliedThreshold?.[1] ?? gweiDelta
}
