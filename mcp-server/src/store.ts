import { rawRowsToSolCalls } from '../../shared/sol-compute.js'
import { rawRowsToRhCalls } from '../../shared/rh-compute.js'
import type { RawRhRow, RawSolRow, RhCall, SolCall } from '../../shared/types.js'

export type StoredArchive<T> = {
  calls: T[]
  storedAt: Date
}

const ONE_HOUR_MS = 60 * 60 * 1000
const solCache = new Map<string, StoredArchive<SolCall>>()
const rhCache = new Map<string, StoredArchive<RhCall>>()

function pruneCache<T>(cache: Map<string, StoredArchive<T>>) {
  const now = Date.now()
  for (const [id, archive] of cache) {
    if (now - archive.storedAt.getTime() > ONE_HOUR_MS) cache.delete(id)
  }
}

async function fetchJsonArray(url: string): Promise<unknown[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch backtest at ${url}: ${response.status} ${response.statusText}`)
  }
  const result = await response.json()
  return Array.isArray(result)
    ? result
    : typeof result === 'object' && Array.isArray(result.rows)
      ? result.rows
      : []
}

export function storeBacktest(url: string, calls: SolCall[]) {
  pruneCache(solCache)
  solCache.set(url, { calls, storedAt: new Date() })
}

export async function getBacktestCalls(url: string): Promise<SolCall[]> {
  const cached = solCache.get(url)
  if (cached) return cached.calls

  const rows = (await fetchJsonArray(url)) as RawSolRow[]
  const calls = rawRowsToSolCalls(rows)
  storeBacktest(url, calls)
  return calls
}

export function storeRhBacktest(url: string, calls: RhCall[]) {
  pruneCache(rhCache)
  rhCache.set(url, { calls, storedAt: new Date() })
}

export async function getRhBacktestCalls(url: string): Promise<RhCall[]> {
  const cached = rhCache.get(url)
  if (cached) return cached.calls

  const rows = (await fetchJsonArray(url)) as RawRhRow[]
  const calls = rawRowsToRhCalls(rows)
  storeRhBacktest(url, calls)
  return calls
}
