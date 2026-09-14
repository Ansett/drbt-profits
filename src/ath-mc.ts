import { reactive } from 'vue'
import { localStorageGet, localStorageSet, uuid } from './lib'
import {
  USER_ID_RE,
  caKey,
  cloneMap,
  meanWithoutOutliers,
  type AthMcMap,
  type AthMcReports,
} from '../shared/ath-mc-file'

export type { AthMcMap, AthMcReports }

const USER_STORAGE_KEY = 'ath-mc-user'

const overrides = reactive<AthMcMap>({})

function replaceOverrides(data: unknown) {
  for (const key of Object.keys(overrides)) delete overrides[key]
  Object.assign(overrides, cloneMap(data))
}

export { caKey, meanWithoutOutliers }

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

/** Resolves after data/ath-mc.json is loaded (empty map if the file is missing). */
export const athMcReady: Promise<void> = loadAthMc()

async function loadAthMc() {
  try {
    const res = await fetch('/api/ath-mc')
    if (!res.ok) return
    replaceOverrides(await res.json())
  } catch {
    // Keep an empty map if the persist endpoint is unavailable.
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

async function persist(ca: string, value: number | null, user: string): Promise<boolean> {
  try {
    const res = await fetch('/api/ath-mc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ca, value, user }),
    })
    return res.ok
  } catch {
    return false
  }
}
