import {
  Alchemy,
  AssetTransfersCategory,
  Network,
  Utils,
  type BigNumber,
  type AssetTransfersResult,
} from 'alchemy-sdk'
import { round, sleep, uuid } from './lib'
import type { BlockTx, TokenTransfer } from './types/Transaction'
import { BUILDER_ADDYS } from './constants'

const BANANA = '0x3328F7f4A1D1C57c35df56bBf0c9dCAFCA309C49'

function getAlchemy(apiKey: string) {
  return new Alchemy({
    apiKey,
    network: Network.ETH_MAINNET,
  })
}

export async function fetchTxsFromBlock(
  blockStart: number,
  blockEnd: number,
  ca: string,
  apiKey = '',
  withBuilderInfo = false,
): Promise<null | BlockTx[]> {
  await sleep(1)

  const blockStartHex = Utils.hexlify(blockStart)
  const blockEndHex = Utils.hexlify(blockEnd)

  const alchemy = getAlchemy(apiKey)

  const [tokens, block] = await Promise.all([
    alchemy.core.getAssetTransfers({
      fromBlock: blockStartHex,
      toBlock: blockEndHex,
      contractAddresses: [ca],
      category: withBuilderInfo
        ? [AssetTransfersCategory.ERC20, AssetTransfersCategory.INTERNAL]
        : [AssetTransfersCategory.ERC20],
    }),
    alchemy.core.getBlockWithTransactions(blockEndHex),
  ]).catch(e => {
    return [null, null]
  })
  if (!tokens || !block) return null

  // There are several token transfers because of taxes, we regroup and sum al of them into a single one for each parent tx
  const tokensReceived = regroupSameTokenTxs(
    tokens.transfers.filter(tk => tk.category === AssetTransfersCategory.ERC20),
  )

  const internalTxs = tokens.transfers.filter(tk => tk.category === AssetTransfersCategory.INTERNAL)

  const buys = tokensReceived.map(token => {
    // Get parent transaction corresponding to the token transfer
    const tx = block.transactions.find(tx => tx.hash === token.hash)
    // no tx when dealing for block < blockEnd
    if (!tx)
      return {
        buyer: uuid(),
        amount: token.amount,
        gasPrice: 99999999,
        block: token.block,
      }

    // Get internal transaction corresponding to the token transfer
    const builderTx = internalTxs.find(
      tx => tx.hash === token.hash && tx.to && BUILDER_ADDYS.includes(tx.to),
    )

    return {
      buyer: tx.from,
      amount: token.amount,
      gasPrice: builderTx ? 99999999 : intGwei(tx.maxPriorityFeePerGas),
      block: token.block,
    }
  })

  // remove double tx, most likely a sandwich bot
  return buys.filter(buy => buys.filter(b => b.buyer === buy.buyer).length === 1)
}

function regroupSameTokenTxs<T extends AssetTransfersResult[]>(txs: T): TokenTransfer[] {
  let order = 1

  const sumAmountByCa = txs.reduce((acc, tx) => {
    const amount = tx.value || 0
    if (!acc[tx.hash]) {
      acc[tx.hash] = {
        order,
        amount,
        ca: tx.rawContract.address!,
        symbol: tx.asset!,
        hash: tx.hash,
        block: hexToInt(tx.blockNum),
      }
      order++
    } else {
      acc[tx.hash].amount += amount
    }
    return acc
  }, {} as Record<string, TokenTransfer>)

  return Object.values(sumAmountByCa)
}

function hexToInt(hex: any) {
  return parseInt(hex)
}

function intGwei(hexGas?: BigNumber): number {
  return hexGas ? round(hexToInt(hexGas) / 1000000000, 1) : 0
}

export async function fetchAllBuysFrom(addy: string, firstBlock: number, apiKey = '') {
  const alchemy = getAlchemy(apiKey)
  const fromBlock = Utils.hexlify(firstBlock)

  const tokens = await alchemy.core.getAssetTransfers({
    fromBlock,
    toAddress: addy,
    category: [AssetTransfersCategory.ERC20],
  })

  const eth = await alchemy.core.getAssetTransfers({
    fromBlock,
    fromAddress: addy,
    category: [AssetTransfersCategory.EXTERNAL],
  })

  const reimbursments = await alchemy.core.getAssetTransfers({
    fromBlock,
    fromAddress: BANANA,
    toAddress: addy,
    category: [AssetTransfersCategory.INTERNAL],
  })

  return tokens.transfers.reduce(
    (arr, token) => {
      const tx = eth.transfers.find(tx => tx.hash === token.hash)
      if (!tx) return arr

      const reimbursement = reimbursments.transfers.find(re => re.hash === token.hash)

      arr.push({
        symbol: token.asset || '',
        block: hexToInt(tx.blockNum),
        ca: token.rawContract.address || '',
        amount: token.value || 0,
        eth: (tx.value || 0) - (reimbursement?.value || 0),
      })

      return arr
    },
    [] as {
      symbol: string
      block: number
      ca: string
      amount: number
      eth: number
    }[],
  )
}
