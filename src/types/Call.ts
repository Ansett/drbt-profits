export type Call = {
  name: string
  ca: string
  nameAndCa: string // for filtering
  date: string
  price: number
  callMc: number
  xs: number
  ath: number
  athDate: string
  athDelayHours: number
  callTimeAth: number
  delay: number // s
  fList: string
  supply: number
  maxBuy: number
  buyTax: number
  rug: boolean
  hashF: string
  gwei: number
  buyGas: number
  nbBribes: number
  lp: number
  block: number
  ethPrice: number
  ignored: boolean
  decimals: number
  lpVersion: number
}

export type SolCall = {
  name: string
  ca: string
  nameAndCa: string // for filtering
  date: string
  postAth: boolean
  athDelayHours: number
  xs: number
  ignored: boolean
  supply: number
  price: number
  callMc: number
  ath: number
  lp: number // can be 0
  solPrice: number
  programIds: string[]
}

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
