import { AnyCall, Call } from '../../shared/types.js'

export type { AnyCall, Call, ChainId, RhCall, SolCall } from '../../shared/types.js'

export type DiffType = 'ADDED' | 'REMOVED' | 'IN-BOTH'
export type CallDiff<C extends AnyCall = Call> = {
  call: C
  status: DiffType
}

export type RowsForExport = {
  value: string | number | Date
  format?: string // if date
  fontWeight?: 'bold'
  align?: 'left' | 'center' | 'right'
}[][]

export type CallArchive<C extends AnyCall = Call> = {
  fileName: string
  calls: C[]
  rows: (string | number | Date)[][]
  caColumn: number
}

export type CallExportType = 'Left' | 'Right' | 'Intersection' | 'Merge'
