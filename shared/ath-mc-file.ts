export const USER_ID_RE = /^[a-zA-Z0-9:_-]{2,64}$/

export type AthMcReports = Record<string, number>
export type AthMcMap = Record<string, AthMcReports>

export function caKey(ca: string): string {
  return ca.startsWith('0x') ? ca.toLowerCase() : ca
}

export function normalizeReports(value: unknown): AthMcReports {
  if (Array.isArray(value)) {
    const reports: AthMcReports = {}
    value.forEach((raw, index) => {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) reports[`anon:${index}`] = n
    })
    return reports
  }

  if (!value || typeof value !== 'object') return {}

  const reports: AthMcReports = {}
  for (const [user, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw)
    if (!USER_ID_RE.test(user) || !Number.isFinite(n) || n <= 0) continue
    reports[user] = n
  }
  return reports
}

export function cloneMap(data: unknown): AthMcMap {
  const src =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  return Object.fromEntries(
    Object.entries(src).map(([ca, values]) => [caKey(ca), normalizeReports(values)]),
  )
}

export function sortAthMcFile(data: AthMcMap): AthMcMap {
  return Object.fromEntries(
    Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ca, reports]) => [
        ca,
        Object.fromEntries(Object.entries(reports).sort(([a], [b]) => a.localeCompare(b))),
      ]),
  )
}

export function upsertAthMc(
  data: unknown,
  ca: string,
  user: string,
  value: number | null,
): { map: AthMcMap; reports: AthMcReports } {
  const key = caKey(ca)
  const map = cloneMap(data)
  const reports = { ...map[key] }
  if (value == null || !Number.isFinite(value) || value <= 0) delete reports[user]
  else reports[user] = value
  if (Object.keys(reports).length) map[key] = reports
  else delete map[key]
  return { map: sortAthMcFile(map), reports }
}

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

export function resolvedAthFromMap(athMc: AthMcMap, ca: string, exportAth: number): number {
  const values = Object.values(athMc[caKey(ca)] || {})
  if (!values.length) return exportAth
  return meanWithoutOutliers(values)
}

export function applyAthMap<T extends { ca: string; ath: number; exportAth?: number }>(
  calls: T[],
  athMc?: AthMcMap,
): T[] {
  if (!athMc || !Object.keys(athMc).length) return calls
  return calls.map(call => {
    const exportAth = call.exportAth ?? call.ath
    const ath = resolvedAthFromMap(athMc, call.ca, exportAth)
    if (ath === call.ath && call.exportAth === exportAth) return call
    return { ...call, ath, exportAth }
  })
}
