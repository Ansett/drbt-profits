export type Log = {
  date: string
  ca: string
  name: string
  invested: number
  gasPrice?: number
  xs: number // -99 is rug
  xsDiff: number | null
  callMc: number
  ath: number
  gain: number
  info: string
  hitTp: string[]
  slippage: number
  ignored: boolean
  flag: 'ignored' | '' // to allow search
  /* for accuracy check */
  nbBribes?: number
  buyTax?: number
  supply: number
  delay?: number
  callBlock?: number
  theoricBlock?: number
  basePrice: number // eth or sol price
}

export type AccuracyLog = {
  slippage: number
  bribes?: number
  relativeError: number // in %
  theoricBuyMc: number
  realBuyMc: number
  ca: string
  delay?: number
  callBlock?: number
  theoricBlock?: number
  realBlock?: number
}
