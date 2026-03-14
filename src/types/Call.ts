export type { Call, SolCall } from '../../shared/types.js'

export type DiffType = 'ADDED' | 'REMOVED' | 'IN-BOTH'
export type CallDiff<C extends Call | SolCall = Call> = {
  call: C
  status: DiffType
}

export type RowsForExport = {
  value: string | number | Date
  format?: string // if date
  fontWeight?: 'bold'
  align?: 'left' | 'center' | 'right'
}[][]

export type CallArchive<C extends Call | SolCall = Call> = {
  fileName: string
  calls: C[]
  rows: (string | number | Date)[][]
  caColumn: number
}

export type CallExportType = 'Left' | 'Right' | 'Intersection' | 'Merge'
