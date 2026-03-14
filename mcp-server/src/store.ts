import { rawRowsToSolCalls } from '../../shared/sol-compute.js'
import type { RawSolRow, SolCall } from '../../shared/types.js'

export type StoredArchive = {
  calls: SolCall[]
  storedAt: Date
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
const backtestCache = new Map<string, StoredArchive>()

export function storeBacktest(url: string, calls: SolCall[]) {
  // cleanup
  const now = new Date()
  for (const [id, archive] of backtestCache) {
    if (now.getTime() - archive.storedAt.getTime() > TWO_DAYS_MS) backtestCache.delete(id)
  }

  backtestCache.set(url, { calls, storedAt: now })
}

export async function getBacktestCalls(url: string): Promise<SolCall[]> {
  const cached = backtestCache.get(url)
  if (cached) return cached.calls

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch backtest at ${url}: ${response.status} ${response.statusText}`)
    
  const rows: RawSolRow[] = await response.json()
  if (!Array.isArray(rows)) return []

  const calls = rawRowsToSolCalls(rows)
  storeBacktest(url, calls)
  
  return calls
}
