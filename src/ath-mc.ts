import bundled from './data/ath-mc.json'
import { reactive } from 'vue'
import { localStorageGet, localStorageSet, uuid } from './lib'
import {
  USER_ID_RE,
  caKey,
  cloneMap,
  type AthMcMap,
  type AthMcReports,
} from '../shared/ath-mc-file'

export type { AthMcMap, AthMcReports }

const USER_STORAGE_KEY = 'ath-mc-user'

const overrides = reactive<AthMcMap>(cloneMap(bundled))

function replaceOverrides(data: unknown) {
  for (const key of Object.keys(overrides)) delete overrides[key]
  Object.assign(overrides, cloneMap(data))
}

export { caKey }

export function athMcUserId(): string {
  const stored = localStorageGet(USER_STORAGE_KEY)
  if (stored && USER_ID_RE.test(stored)) return stored
  const id = uuid()
  localStorageSet(USER_STORAGE_KEY, id)
  return id
}

function reportsFor(ca: string): AthMcReports {
  return overrides[caKey(ca)] || {}
}

function reportValues(ca: string): number[] {
  return Object.values(reportsFor(ca))
}

/** Resolves after the local file is loaded (or immediately in production). */
export const athMcReady: Promise<void> = import.meta.env.DEV
  ? loadFromDevServer()
  : Promise.resolve()

async function loadFromDevServer() {
  try {
    const res = await fetch('/__ath-mc')
    if (!res.ok) return
    replaceOverrides(await res.json())
  } catch {
    // Keep the bundled JSON if the Vite write endpoint is unavailable.
  }
}

export function athSampleCount(ca: string): number {
  return reportValues(ca).length
}

export function hasAthOverride(ca: string): boolean {
  return athSampleCount(ca) > 0
}

export function getMyAthMc(ca: string): number | undefined {
  const value = reportsFor(ca)[athMcUserId()]
  return Number.isFinite(value) ? value : undefined
}

export function resolvedAth(ca: string, exportAth: number): number {
  const values = reportValues(ca)
  if (!values.length) return exportAth
  return meanWithoutOutliers(values)
}

export function applyAthOverrides<T extends { ca: string; ath: number; exportAth?: number }>(
  calls: T[],
): T[] {
  return calls.map(call => {
    const exportAth = call.exportAth ?? call.ath
    const ath = resolvedAth(call.ca, exportAth)
    if (ath === call.ath && call.exportAth === exportAth) return call
    return { ...call, ath, exportAth }
  })
}

export function patchCallAth<T extends { ca: string; ath: number; exportAth?: number }>(
  call: T,
  ca: string,
  ath: number | null,
): T {
  if (caKey(call.ca) !== caKey(ca)) return call
  const exportAth = call.exportAth ?? call.ath
  return { ...call, exportAth, ath: ath ?? exportAth }
}

export async function addAthMc(
  ca: string,
  value: number | null,
): Promise<{ ath: number | null; persisted: boolean; replaced: boolean; removed: boolean }> {
  await athMcReady
  const key = caKey(ca)
  const user = athMcUserId()
  const current = { ...reportsFor(key) }
  const replaced = Object.hasOwn(current, user)
  const cleared = value == null || !Number.isFinite(value) || value <= 0

  if (cleared) {
    delete current[user]
    if (Object.keys(current).length) overrides[key] = current
    else delete overrides[key]

    const persisted = await persist(key, null, user)
    const values = Object.values(current)
    return {
      ath: values.length ? meanWithoutOutliers(values) : null,
      persisted,
      replaced,
      removed: true,
    }
  }

  current[user] = value
  overrides[key] = current

  const persisted = await persist(key, value, user)
  return {
    ath: meanWithoutOutliers(Object.values(current)),
    persisted,
    replaced,
    removed: false,
  }
}

/** Average after dropping IQR outliers when there are enough samples. */
export function meanWithoutOutliers(values: number[]): number {
  const nums = values.filter(v => Number.isFinite(v) && v > 0)
  if (!nums.length) return 0
  if (nums.length < 4) return mean(nums)

  const sorted = [...nums].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lo = q1 - 1.5 * iqr
  const hi = q3 + 1.5 * iqr
  const filtered = sorted.filter(v => v >= lo && v <= hi)
  return mean(filtered.length ? filtered : sorted)
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  if (next === undefined) return sorted[base]
  return sorted[base] + rest * (next - sorted[base])
}

async function persist(ca: string, value: number | null, user: string): Promise<boolean> {
  try {
    const res = await fetch('/__ath-mc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ca, value, user }),
    })
    return res.ok
  } catch {
    return false
  }
}
