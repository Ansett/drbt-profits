import { DEFAULT_RH_ETH_PRICE, RH_ETH_USD_DAYS } from './constants'
import { localStorageGetObject, localStorageSetObject } from './lib'
import type { RhCall } from '../shared/types'
import { extractDate } from '../shared/utils'

const CACHE_KEY = 'rh-eth-usd-daily'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const DAYS = RH_ETH_USD_DAYS
const BINANCE_URLS = [
  `https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=${DAYS}`,
  `https://data-api.binance.vision/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=${DAYS}`,
]

export type EthUsdByDay = Record<string, number>

export function ethUsdOnDate(prices: EthUsdByDay, isoDate: string): number {
  const day = extractDate(isoDate)
  if (prices[day] > 0) return prices[day]

  const days = Object.keys(prices).filter(d => prices[d] > 0).sort()
  if (!days.length) return DEFAULT_RH_ETH_PRICE

  const target = Date.parse(day + 'T00:00:00.000Z')
  let best = days[0]
  let bestDiff = Math.abs(target - Date.parse(best + 'T00:00:00.000Z'))
  for (const d of days) {
    const diff = Math.abs(target - Date.parse(d + 'T00:00:00.000Z'))
    if (diff < bestDiff) {
      best = d
      bestDiff = diff
    }
  }
  return prices[best] || DEFAULT_RH_ETH_PRICE
}

export function applyBinanceEthUsd(calls: RhCall[], prices: EthUsdByDay) {
  if (!Object.keys(prices).length) return
  for (const call of calls) {
    if (call.ethPrice > 0) continue
    call.ethPrice = ethUsdOnDate(prices, call.date)
  }
}

function readCache(): EthUsdByDay | null {
  const cached = localStorageGetObject(CACHE_KEY)
  if (!cached?.fetchedAt || !cached.prices) return null
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null
  return cached.prices as EthUsdByDay
}

async function fetchKlines(url: string): Promise<EthUsdByDay> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance ${res.status}`)
  const rows = (await res.json()) as Array<[number, string, string, string, string]>
  const prices: EthUsdByDay = {}
  for (const row of rows) {
    const day = new Date(row[0]).toISOString().slice(0, 10)
    const close = Number(row[4])
    if (day && close > 0) prices[day] = close
  }
  if (!Object.keys(prices).length) throw new Error('Binance empty')
  return prices
}

export async function fetchEthUsdDaily(): Promise<EthUsdByDay> {
  const cached = readCache()
  if (cached) return cached

  let lastError: unknown
  for (const url of BINANCE_URLS) {
    try {
      const prices = await fetchKlines(url)
      localStorageSetObject(CACHE_KEY, { fetchedAt: Date.now(), prices })
      return prices
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Binance ETHUSDT failed')
}
