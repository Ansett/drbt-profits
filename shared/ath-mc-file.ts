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
