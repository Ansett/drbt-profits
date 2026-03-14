export type Call = {
  name: string
  ca: string
  nameAndCa: string // for filtering
  date: string
  creation: string // launch date
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


export type TakeProfit = {
  size: number
  xs: number
  withXs: boolean
  amount: number
  withAmount: boolean
  mc: number
  withMc: boolean
  andLogic: boolean
}

export type SolCall = {
  name: string
  ca: string
  nameAndCa: string // for filtering
  date: string
  creation: string // date
  postAth: boolean
  athDelayHours: number
  xs: number
  ignored: boolean
  supply: number
  callMc: number
  entryMc: number
  ath: number
  lp: number // can be 0
  solPrice: number
  programIds: string[]
  lpRatio: number
  uriImage: string
}

export type RawSolRow = {
  mint: string
  snapshot_at: Date
  created_at: Date
  name: string
  post_ath: string
  xs: string
  total_supply: number
  mc: number
  entry_mc: number
  current_ath_mc: number
  lp_sol_launch: number
  sol_price: number
  launched_slot: number
  current_ath_slot: number
  program_ids: string
  lp_ratio: number
  uri_content: string
}

export const SOL_HEADERS: Array<keyof RawSolRow> = [
  'mint',
  'snapshot_at',
  'created_at',
  'name',
  'post_ath',
  'xs',
  'total_supply',
  'mc',
  'entry_mc',
  'current_ath_mc',
  'lp_sol_launch',
  'sol_price',
  'launched_slot',
  'current_ath_slot',
  'program_ids',
  'lp_ratio',
  'uri_content',
]