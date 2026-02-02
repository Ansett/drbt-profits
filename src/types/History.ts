export type SolTokenHistory = {
  fileName: string
  mint: string
  name: string
  snapshots: Record<string, string | number>[]
}

export type MatchingResults = Map<string, {
  mc: number
  date: string
  failedConditions: string[]
}>