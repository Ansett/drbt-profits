import type { RawRhRow, RhCall, TakeProfit } from './types.js'
import {
  AVERAGE_LP_TO_MC_RATIO,
  DEFAULT_RH_ETH_PRICE,
  INITIAL_TP_SIZE_CODE,
  PONS_DEFAULT_SNIPE_SECONDS,
  PONS_FEE_BPS,
  PONS_SNIPE_START_BPS,
  PONS_SUPPLY,
  REALISTIC_MAX_XS,
  RH_BLOCK_MS,
  RH_REF_BLOCK,
  RH_REF_TIME_MS,
} from '../src/constants.js'
import { extractDate, round, getSaleDate, getPriceImpact, getDate } from './utils.js'
import { computeDrawdowns, type FindTargetResult } from './sol-compute.js'

export interface CallGainResult {
  gain: number
  bestXs: number
  totalImpact: number
  realisticEntryMc: number
  hitTp: string[]
  saleGains: Array<{ date: string; amount: number }>
  invested: number
  buyTaxPct: number
  info: string
}

export function snipeTaxBps(ageS: number, snipeTaxSeconds: number): number {
  if (!snipeTaxSeconds || ageS < 0 || ageS >= snipeTaxSeconds) return 0
  return PONS_SNIPE_START_BPS >> Math.floor((ageS * 14) / snipeTaxSeconds)
}

export function isPonsLaunch(raw: { launchpad?: string }): boolean {
  const pad = asString(raw.launchpad).trim().toLowerCase()
  if (!pad) return true
  return pad.includes('pons')
}

export function remainingCurveUsd(call: RhCall): number | null {
  if (!call.isPons) return null
  if (call.graduated) return null
  if (call.graduationState === 'migrating') return 0
  if (call.bondingProgress != null && call.bondingProgress >= 100) return 0
  if (call.graduationThresholdUsd > 0) {
    if (call.curveRaisedUsd > 0) {
      return Math.max(0, call.graduationThresholdUsd - call.curveRaisedUsd)
    }
    if (call.bondingProgress != null) {
      return call.graduationThresholdUsd * Math.max(0, 1 - call.bondingProgress / 100)
    }
  }
  return null
}

function bpsToMult(bps: number): number {
  return Math.max(0, 1 - Math.min(bps, 10000) / 10000)
}

export function ethPriceOf(call: { ethPrice?: number }): number {
  return call.ethPrice && call.ethPrice > 0 ? call.ethPrice : DEFAULT_RH_ETH_PRICE
}

/**
 * Quote-leg PNL for one call.
 * Pons V2: protocol fee + creator tax on buy and sell, optional decaying snipe tax, curve remaining cap.
 * Direct Uniswap V4 deploys: creator tax only (no Pons fee, no snipe tax, no curve cap).
 */
export function computeCallGain(
  call: RhCall,
  position: number,
  takeProfits: TakeProfit[],
  averageSlippage: number,
  realisticEntry: boolean,
  applySnipeTax: boolean,
  buyTaxInXs: boolean,
): CallGainResult {
  const pons = call.isPons !== false
  const snipeBps = pons && applySnipeTax ? snipeTaxBps(call.ageS, call.snipeTaxSeconds) : 0
  const protocolBps = pons ? PONS_FEE_BPS : 0
  const buyBps = protocolBps + call.creatorTaxBps + snipeBps
  const sellBps = protocolBps + call.creatorTaxBps
  const buyFeeMult = bpsToMult(buyBps)
  const sellFeeMult = bpsToMult(sellBps)
  const buyTaxPct = buyBps / 100

  const ethPrice = ethPriceOf(call)
  const positionUsd = position * ethPrice
  const remaining = remainingCurveUsd(call)
  let investedUsd = positionUsd
  let info = ''
  if (remaining === 0) {
    return {
      gain: 0,
      bestXs: 0,
      totalImpact: 0,
      realisticEntryMc: call.callMc,
      hitTp: [],
      saleGains: [],
      invested: 0,
      buyTaxPct,
      info: 'Curve full or migrating: buy would revert',
    }
  }
  if (remaining != null && buyFeeMult > 0) {
    const desiredNet = positionUsd * buyFeeMult
    if (desiredNet > remaining) {
      investedUsd = remaining / buyFeeMult
      info = 'Buy capped to remaining curve capacity'
    }
  }

  const realisticEntryMc = realisticEntry ? call.entryMc : call.callMc
  const rawXs = realisticEntryMc > 0 ? call.ath / realisticEntryMc : 0
  const unrealistic = rawXs > REALISTIC_MAX_XS

  const buyPrice = (realisticEntryMc + averageSlippage) / call.supply
  const netIn = investedUsd * buyFeeMult
  const tokens = buyPrice ? netIn / buyPrice : 0
  const impact = getPriceImpact(call.lp, buyPrice, tokens)
  const newPrice = buyPrice * (1 + impact / 100)
  const totalImpact = Math.max(0, buyPrice ? (newPrice / buyPrice - 1) * 100 : 0)

  let bestXs = rawXs / (1 + totalImpact / 100)
  bestXs = unrealistic ? REALISTIC_MAX_XS : bestXs

  let gainUsd = -investedUsd
  const hitTp: string[] = []
  const saleGains: Array<{ date: string; amount: number }> = []

  if (!call.postAth && investedUsd > 0 && buyPrice) {
    let remainingPosition = 100
    let tpIndex = 0
    const totalTokens = tokens
    let sizeSoldForInitial = 0
    const reducedBestXs = buyTaxInXs ? bestXs * buyFeeMult : bestXs
    const reduceXs = (xs: number) => (buyTaxInXs ? xs * buyFeeMult : xs)
    const unreduceXs = (xs: number, apply: boolean) =>
      apply && buyTaxInXs && buyFeeMult ? xs / buyFeeMult : xs

    for (const tp of takeProfits) {
      const targetXsDirect = tp.withXs ? tp.xs : 0
      const targetXsFromEth = tp.withAmount ? reduceXs((tp.amount * ethPrice) / investedUsd) : 0
      const targetXsFromMc = tp.withMc ? (bestXs / call.ath) * tp.mc : 0
      const allTargets = [targetXsDirect, targetXsFromEth, targetXsFromMc].filter(v => v > 0)

      const reachedXsTarget = reducedBestXs >= targetXsDirect ? targetXsDirect : 0
      const reachedEthTarget = reducedBestXs >= targetXsFromEth ? targetXsFromEth : 0
      const reachedMcTarget = bestXs >= targetXsFromMc ? targetXsFromMc : 0
      const allReachedTargets = [reachedXsTarget, reachedEthTarget, reachedMcTarget].filter(v => v > 0)

      const reachedTarget = allReachedTargets.length
        ? tp.andLogic
          ? allReachedTargets.length === allTargets.length
            ? Math.max(...allReachedTargets)
            : 0
          : Math.min(...allReachedTargets)
        : 0
      const reachedTargetIsFromMc = reachedTarget === reachedMcTarget && !!reachedMcTarget

      const xsMultiplicator = unreduceXs(reachedTarget, !reachedTargetIsFromMc)

      if (tp.size && reachedTarget) {
        const denom = xsMultiplicator * buyFeeMult * sellFeeMult
        const sizeSold =
          tp.size === INITIAL_TP_SIZE_CODE
            ? denom
              ? 100 / denom
              : 0
            : (tp.size * (100 - sizeSoldForInitial)) / 100

        if (sizeSold <= 0) {
          tpIndex++
          continue
        }

        const salePrice = buyPrice * xsMultiplicator
        const saleMc = salePrice * call.supply
        const dollarLp = saleMc * (call.lpRatio || AVERAGE_LP_TO_MC_RATIO)
        const tokensSold = (totalTokens * sizeSold) / 100
        const priceImpact = Math.min(100, Math.abs(getPriceImpact(dollarLp, salePrice, tokensSold)))

        const profitUsd =
          ((investedUsd * sizeSold) / 100) *
          xsMultiplicator *
          buyFeeMult *
          sellFeeMult *
          (1 - priceImpact / 100)

        gainUsd += profitUsd
        saleGains.push({ date: getSaleDate(call, saleMc), amount: profitUsd / ethPrice })

        if (tp.size === INITIAL_TP_SIZE_CODE) sizeSoldForInitial = sizeSold
        else remainingPosition -= sizeSold

        hitTp.push('TP' + (tpIndex + 1))
      }

      if (remainingPosition <= 0) break
      tpIndex++
    }
  } else if (call.postAth) {
    info = info || 'Post-ath: Entry occured after the current ATH'
  }

  if (unrealistic) {
    info = `Unrealistic perf: Entry might be anormally low or ATH anormally high. Perf capped to ${REALISTIC_MAX_XS}x`
  }

  return {
    gain: gainUsd / ethPrice,
    bestXs,
    totalImpact,
    realisticEntryMc,
    hitTp,
    saleGains,
    invested: investedUsd / ethPrice,
    buyTaxPct,
    info,
  }
}

export interface ComputeParams {
  position: number
  takeProfits: TakeProfit[]
  averageSlippage: number
  realisticEntry: boolean
  applySnipeTax: boolean
  buyTaxInXs: boolean
}

export interface ComputeResult {
  totalPnl: number
  drawdown: number
  worstDrawdown: [string, number]
  volume: number
}

export function compute(calls: RhCall[], params: ComputeParams): ComputeResult {
  const { position, takeProfits, averageSlippage, realisticEntry, applySnipeTax, buyTaxInXs } = params

  let finalWorth = 0
  let volume = 0

  const gainByDate: Record<string, number> = {}
  const addGain = (date: string, gain: number) => {
    const day = extractDate(date)
    gainByDate[day] = (gainByDate[day] || 0) + gain
  }

  for (const call of calls) {
    if (call.ignored) continue

    const result = computeCallGain(
      call,
      position,
      takeProfits,
      averageSlippage,
      realisticEntry,
      applySnipeTax,
      buyTaxInXs,
    )
    volume += result.invested

    addGain(call.date, -result.invested)
    for (const sg of result.saleGains) addGain(sg.date, sg.amount)

    finalWorth += result.gain
  }

  const { drawdown, worstDrawdown } = computeDrawdowns(gainByDate)

  return {
    totalPnl: finalWorth ? round(finalWorth, 3) : finalWorth,
    drawdown,
    worstDrawdown,
    volume: round(volume, 3),
  }
}

export function findRhTarget(
  calls: RhCall[],
  position: number,
  start: number,
  end: number,
  steps: number,
  isXs: boolean,
  averageSlippage = 0,
  realisticEntry = true,
  applySnipeTax = true,
  buyTaxInXs = true,
): FindTargetResult[] {
  const increment = (end - start) / (steps - 1)
  const values = [...new Set(Array.from({ length: steps }, (_, i) => round(start + increment * i, 1)))]
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
      applySnipeTax,
      buyTaxInXs,
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

function cell(row: (string | number | Date | boolean | null | undefined)[], index: number) {
  return index >= 0 ? row[index] : undefined
}

function asNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'boolean') return value ? 1 : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asOptNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = asNumber(value, Number.NaN)
  return Number.isFinite(n) ? n : null
}

function asString(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v === 'true' || v === '1' || v === 'yes'
  }
  return false
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && value) {
    const d = getDate(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function blockToDate(block: number): Date {
  return new Date(RH_REF_TIME_MS + (block - RH_REF_BLOCK) * RH_BLOCK_MS)
}

export function rawRowsToRhCalls(rawRows: RawRhRow[], blackList = [] as string[]): RhCall[] {
  const calls: RhCall[] = []

  for (const raw of rawRows) {
    const ca = asString(raw.ca).toLowerCase()
    if (!ca) continue

    const callMc = asNumber(raw.mc)
    const entryMc = asNumber(raw.entry_mc) || callMc
    const ath = asNumber(raw.current_ath_mc)
    const launchedBlock = asNumber(raw.launched_block)
    const updatedBlock = asNumber(raw.updated_block)
    const athBlock = asNumber(raw.ath_block)
    const ageS = asNumber(raw.age_s)
    const snapshotAt = asDate(raw.snapshot_at)
    const createdAt = asDate(raw.created_at)

    let creation: Date
    if (createdAt) creation = createdAt
    else if (launchedBlock) creation = blockToDate(launchedBlock)
    else if (snapshotAt && ageS) creation = new Date(snapshotAt.getTime() - ageS * 1000)
    else creation = snapshotAt ? new Date(snapshotAt.getTime()) : new Date()

    let date: Date
    if (snapshotAt) date = snapshotAt
    else if (ageS) date = new Date(creation.getTime() + ageS * 1000)
    else if (updatedBlock) date = blockToDate(updatedBlock)
    else date = new Date(creation.getTime())

    const athDelayHours =
      athBlock && launchedBlock
        ? ((athBlock - launchedBlock) * RH_BLOCK_MS) / 1000 / 60 / 60
        : 2

    const lp = asNumber(raw.lp_usd)
    const name = asString(raw.name) || asString(raw.symbol) || ca
    const xs = callMc > 0 ? ath / callMc : 0
    const bondingProgress = asOptNumber(raw.bonding_progress)
    const graduationState = asString(raw.graduation_state)
    const graduated =
      asBool(raw.graduated) || graduationState === 'graduated' || bondingProgress === 100
    const launchpad = asString(raw.launchpad)
    const isPons = isPonsLaunch(raw)

    calls.push({
      name,
      ca,
      nameAndCa: name + ca,
      creation: creation.toISOString(),
      date: date.toISOString(),
      postAth: asBool(raw.post_ath),
      xs,
      callMc,
      entryMc, 
      athDelayHours: athDelayHours > 0 ? athDelayHours : 2,
      ath,
      supply: PONS_SUPPLY,
      lp,
      lpRatio: callMc > 0 && lp > 0 ? lp / callMc : AVERAGE_LP_TO_MC_RATIO,
      ignored: blackList.includes(ca),
      creatorTaxBps: asNumber(raw.creator_tax_bps),
      ageS,
      snipeTaxSeconds: isPons
        ? asNumber(raw.snipe_tax_seconds, PONS_DEFAULT_SNIPE_SECONDS) || PONS_DEFAULT_SNIPE_SECONDS
        : asNumber(raw.snipe_tax_seconds),
      launchedBlock,
      updatedBlock,
      athBlock,
      bondingProgress,
      graduated,
      graduationState,
      graduationThresholdUsd: asNumber(raw.graduation_threshold_usd),
      curveRaisedUsd: asNumber(raw.curve_raised_usd),
      quoteSymbol: asString(raw.quote_symbol) || 'ETH',
      quoteClass: asString(raw.quote_class),
      deployer: asString(raw.deployer).toLowerCase(),
      ethPrice: asNumber(raw.eth_price),
      launchpad,
      isPons,
    })
  }

  return calls
}

export function parseRhRow(
  row: (string | number | Date | boolean | null | undefined)[],
  indexes: Record<keyof RawRhRow, number>,
): RawRhRow | null {
  const ca = asString(cell(row, indexes.ca))
  if (!ca) return null

  return {
    ca,
    mc: asNumber(cell(row, indexes.mc)),
    current_ath_mc: asNumber(cell(row, indexes.current_ath_mc)),
    ath_mc: asNumber(cell(row, indexes.ath_mc)),
    post_ath: cell(row, indexes.post_ath) as boolean | number | string | undefined,
    name: asString(cell(row, indexes.name)),
    symbol: asString(cell(row, indexes.symbol)),
    launch_mc: asNumber(cell(row, indexes.launch_mc)),
    entry_mc: asNumber(cell(row, indexes.entry_mc)),
    ath_x: asNumber(cell(row, indexes.ath_x)),
    now_x: asNumber(cell(row, indexes.now_x)),
    lp_usd: asNumber(cell(row, indexes.lp_usd)),
    creator_tax_bps: asNumber(cell(row, indexes.creator_tax_bps)),
    age_s: asNumber(cell(row, indexes.age_s)),
    snipe_tax_seconds: asNumber(cell(row, indexes.snipe_tax_seconds)),
    launched_block: asNumber(cell(row, indexes.launched_block)),
    updated_block: asNumber(cell(row, indexes.updated_block)),
    ath_block: asNumber(cell(row, indexes.ath_block)),
    bonding_progress: asNumber(cell(row, indexes.bonding_progress)),
    graduated: cell(row, indexes.graduated) as boolean | string | undefined,
    graduation_state: asString(cell(row, indexes.graduation_state)),
    graduation_threshold_usd: asNumber(cell(row, indexes.graduation_threshold_usd)),
    curve_raised_usd: asNumber(cell(row, indexes.curve_raised_usd)),
    quote_symbol: asString(cell(row, indexes.quote_symbol)),
    quote_class: asString(cell(row, indexes.quote_class)),
    deployer: asString(cell(row, indexes.deployer)),
    decimals: asNumber(cell(row, indexes.decimals), 18),
    snapshot_at: asDate(cell(row, indexes.snapshot_at)) || undefined,
    created_at: asDate(cell(row, indexes.created_at)) || undefined,
    eth_price: asNumber(cell(row, indexes.eth_price)),
    launchpad: asString(cell(row, indexes.launchpad)),
    curve: asString(cell(row, indexes.curve)),
  }
}
