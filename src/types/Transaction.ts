// NOTE: if a property is changed here, indexed DB data need to be cleared
export type BlockTx = {
  buyer: string
  priority: number
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
