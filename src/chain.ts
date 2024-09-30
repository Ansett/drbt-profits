import {
  Alchemy,
  AssetTransfersCategory,
  Network,
  Utils,
  type BigNumber,
  type AssetTransfersResult,
  type AssetTransfersResponse,
} from 'alchemy-sdk'
import { round, sleep, uuid } from './lib'
import type { BlockTx, TokenTransfer } from './types/Transaction'
import { BUILDER_ADDYS, CURRENT_CACHED_BLOCK_VERSION, WRAPPED_ETH_ADDY } from './constants'
import { storeBlockDataInStore } from './db'

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
  decimals: number,
  apiKey = '',
): Promise<null | BlockTx[]> {
  await sleep(100)

  const blockStartHex = Utils.hexlify(blockStart)
  const blockEndHex = Utils.hexlify(blockEnd)

  const alchemy = getAlchemy(apiKey)

  const [tokenTransfers, block] = await Promise.all([
    fetchPaginatedTransfers(pageKey =>
      alchemy.core.getAssetTransfers({
        fromBlock: blockStartHex,
        toBlock: blockEndHex,
        // withMetadata: true, // true to get metadata.blockTimestamp
        contractAddresses: [ca, WRAPPED_ETH_ADDY],
        category: [AssetTransfersCategory.ERC20, AssetTransfersCategory.INTERNAL],
        pageKey,
      }),
    ),
    alchemy.core.getBlockWithTransactions(blockEndHex),
  ]).catch(e => {
    return [null, null]
  })
  if (!tokenTransfers || !block) return null

  // There are several token transfers because of taxes, we regroup and sum all of them into a single one for each parent tx
  const tokensReceived = regroupSameTokenTxs(
    tokenTransfers.filter(
      tk =>
        tk.category === AssetTransfersCategory.ERC20 &&
        tk.rawContract.address?.toLowerCase() === ca.toLowerCase(),
    ),
    decimals,
  )
  const internalTxs = tokenTransfers.filter(tk => tk.category === AssetTransfersCategory.INTERNAL)

  const buys = tokensReceived
    .filter(token => token.amount)
    .map(token => {
      // Get parent transaction corresponding to the token transfer (no tx when dealing with block < blockEnd)
      const transaction = block.transactions.find(tx => tx.hash === token.hash)
      const buyer = transaction?.from

      // remove token sales (the "buyer" addy is in at least a `from` field of token transfers)
      if (buyer && token.from.includes(buyer.toLowerCase())) return null

      const dexPayment = tokenTransfers.find(
        tk =>
          tk.hash.toLowerCase() === token.hash.toLowerCase() &&
          tk.rawContract.address?.toLowerCase() === WRAPPED_ETH_ADDY,
      )

      const botPayment = internalTxs.find(
        tx =>
          tx.hash.toLowerCase() === token.hash.toLowerCase() &&
          tx.to?.toLowerCase() === WRAPPED_ETH_ADDY,
      )
      if (!dexPayment && !botPayment) console.warn('NOT payment TX for ', ca)
      const paidETH = dexPayment?.value || botPayment?.value || 0.1111111111

      const builderTx = internalTxs.find(
        tx =>
          tx.hash.toLowerCase() === token.hash.toLowerCase() &&
          tx.to &&
          BUILDER_ADDYS.includes(tx.to),
      )

      return {
        buyer: buyer || uuid(),
        amount: token.amount,
        paidETH,
        priceETH: paidETH / token.amount,
        priority: builderTx || !buyer ? 99999999 : intGwei(transaction.maxPriorityFeePerGas),
        block: token.block,
        version: CURRENT_CACHED_BLOCK_VERSION,
      } as BlockTx
    })
    .filter(Boolean) as BlockTx[]

  // remove double tx, most likely a sandwich bot
  const cleanedTxs = buys.filter(buy => buys.filter(b => b.buyer === buy.buyer).length === 1)
  await storeBlockDataInStore(ca, blockStart, blockEnd, cleanedTxs)
  return cleanedTxs
}

function regroupSameTokenTxs<T extends AssetTransfersResult[]>(
  txs: T,
  decimals: number,
): TokenTransfer[] {
  let order = 1

  const sumAmountByCa = txs.reduce((acc, tx) => {
    const amount = tx.value || hexToInt(tx.rawContract.value) / Math.pow(10, decimals) || 0
    if (!acc[tx.hash]) {
      acc[tx.hash] = {
        order,
        amount,
        ca: tx.rawContract.address!,
        symbol: tx.asset!,
        hash: tx.hash,
        block: hexToInt(tx.blockNum),
        from: [tx.from.toLowerCase()],
      }
      order++
    } else {
      acc[tx.hash].amount += amount
      acc[tx.hash].from.push(tx.from.toLowerCase())
    }
    return acc
  }, {} as Record<string, TokenTransfer>)

  return Object.values(sumAmountByCa)
}

function hexToInt(hex: any) {
  return hex ? parseInt(hex) : 0
}

function intGwei(hexGas?: BigNumber): number {
  return hexGas ? round(hexToInt(hexGas) / 1000000000, 1) : 0
}

export async function fetchAllBuysFrom(addy: string, firstBlock: number, apiKey = '') {
  const alchemy = getAlchemy(apiKey)
  const fromBlock = Utils.hexlify(firstBlock)

  const tokenTransfers = await fetchPaginatedTransfers(pageKey =>
    alchemy.core.getAssetTransfers({
      fromBlock,
      toAddress: addy,
      category: [AssetTransfersCategory.ERC20],
      pageKey,
    }),
  )

  const ethTransfers = await fetchPaginatedTransfers(pageKey =>
    alchemy.core.getAssetTransfers({
      fromBlock,
      fromAddress: addy,
      category: [AssetTransfersCategory.EXTERNAL],
      pageKey,
    }),
  )

  // only needed for bribes afaik
  const reimbursmentTransfers = await fetchPaginatedTransfers(pageKey =>
    alchemy.core.getAssetTransfers({
      fromBlock,
      fromAddress: BANANA,
      toAddress: addy,
      category: [AssetTransfersCategory.INTERNAL],
      pageKey,
    }),
  )

  return tokenTransfers.reduce(
    (arr, token) => {
      const tx = ethTransfers.find(tx => tx.hash === token.hash)
      if (!tx) return arr

      const reimbursement = reimbursmentTransfers.find(re => re.hash === token.hash)

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

async function fetchPaginatedTransfers<
  F extends (pageKey?: string) => Promise<AssetTransfersResponse>,
>(fn: F): Promise<AssetTransfersResult[]> {
  let pageKey: string | undefined
  let transfers: AssetTransfersResult[] = []
  do {
    const res = await fn(pageKey)
    transfers = transfers.concat(res.transfers)
    pageKey = res.pageKey
  } while (pageKey)

  return transfers
}
