export type BlockTx = {
  buyer: string
  gasPrice: number
  amount: number
  block: number
}

export type TokenTransfer = {
  ca: string
  amount: number
  symbol: string
  order: number
  hash: string
  block: number
}
