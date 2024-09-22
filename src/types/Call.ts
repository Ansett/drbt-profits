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
  nbSnipes: number
  lp: number
  block: number
  ethPrice: number
  ignored: boolean
  decimals: number
  lpVersion: number
}

export type DiffType = 'ADDED' | 'REMOVED' | 'IN-BOTH'
export type CallDiff = {
  call: Call
  status: DiffType
}

export type RowsForExport = {
  value: string | number | Date
  format?: string // if date
  fontWeight?: 'bold'
  align?: 'left' | 'center' | 'right'
}[][]

export type CallArchive = {
  fileName: string
  calls: Call[]
  rows: (string | number | Date)[][]
  caColumn: number
}

export type CallExportType = 'Left' | 'Right' | 'Intersection' | 'Merge'
