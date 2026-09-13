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
  exportAth?: number
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
  exportAth?: number
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

export type ChainId = 'ETH' | 'SOL' | 'RH'

export type RhCall = {
  name: string
  ca: string
  nameAndCa: string
  date: string
  creation: string
  postAth: boolean
  athDelayHours: number
  xs: number
  ignored: boolean
  supply: number
  callMc: number
  entryMc: number
  ath: number
  exportAth?: number
  lp: number
  lpRatio: number
  creatorTaxBps: number
  ageS: number
  snipeTaxSeconds: number
  launchedBlock: number
  updatedBlock: number
  athBlock: number
  bondingProgress: number | null
  graduated: boolean
  graduationState: string
  graduationThresholdUsd: number
  curveRaisedUsd: number
  quoteSymbol: string
  quoteClass: string
  deployer: string
  ethPrice: number
  launchpad: string
  isPons: boolean
}

export type RawRhRow = {
  ca: string
  mc: number
  current_ath_mc: number
  ath_mc?: number
  post_ath?: boolean | number | string
  name?: string
  symbol?: string
  launch_mc?: number
  entry_mc?: number
  ath_x?: number
  now_x?: number
  lp_usd?: number
  creator_tax_bps?: number
  age_s?: number
  snipe_tax_seconds?: number
  launched_block?: number
  updated_block?: number
  ath_block?: number
  bonding_progress?: number
  graduated?: boolean | string
  graduation_state?: string
  graduation_threshold_usd?: number
  curve_raised_usd?: number
  quote_symbol?: string
  quote_class?: string
  deployer?: string
  decimals?: number
  snapshot_at?: Date | string
  created_at?: Date | string
  eth_price?: number
  launchpad?: string
  curve?: string
}

export const RH_REQUIRED_HEADERS: Array<keyof RawRhRow> = ['ca', 'mc', 'current_ath_mc']

export const RH_OPTIONAL_HEADERS: Array<keyof RawRhRow> = [
  'name',
  'symbol',
  'launch_mc',
  'entry_mc',
  'ath_x',
  'now_x',
  'ath_mc',
  'post_ath',
  'lp_usd',
  'creator_tax_bps',
  'age_s',
  'snipe_tax_seconds',
  'launched_block',
  'updated_block',
  'ath_block',
  'bonding_progress',
  'graduated',
  'graduation_state',
  'graduation_threshold_usd',
  'curve_raised_usd',
  'quote_symbol',
  'quote_class',
  'deployer',
  'decimals',
  'snapshot_at',
  'created_at',
  'eth_price',
  'launchpad',
  'curve',
]

export const RH_HEADERS: Array<keyof RawRhRow> = [...RH_REQUIRED_HEADERS, ...RH_OPTIONAL_HEADERS]

export type AnyCall = Call | SolCall | RhCall