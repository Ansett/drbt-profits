import type { AnyCall, Call } from './Call'

export type HashInfo<C extends AnyCall = Call> = {
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
  mooners2: number
  allCalls: C[]
}
