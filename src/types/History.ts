export type SolTokenHistory = {
  fileName: string
  mint: string
  name: string
  history: Record<string, string | number>[]
}