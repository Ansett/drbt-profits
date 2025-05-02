import type { Call, SolCall } from './Call'

export type HashInfo<C extends Call | SolCall = Call> = {
  id: string
  tags: string[]
  rugs: number
  xSum: number
  perf: {
    x5: number
    x10: number
    x50: number
    x100: number
  }
  mooners: number
  allCalls: C[]
}
