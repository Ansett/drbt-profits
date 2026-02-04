export type SolTokenHistory = {
  fileName: string
  mint: string
  name: string
  created: [string, string]
  allFields: string[]
  snapshots: Record<string, string | number>[]
}

export type MatchingResults = {
  line: number,
  mc: number
  timestamp: string,
  time: string,
  date: string
  failedConditions: string[]
  currentValues: Map<string, string>
}[]
