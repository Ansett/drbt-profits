import { openDB, type DBSchema } from 'idb'
import type { BlockTx } from './types/Transaction'

interface MyDB extends DBSchema {
  blocks: {
    key: string // ca-block
    value: BlockTx[]
  }
}

const dbName = 'worker'
const dbVersion = 1
const blockStore = 'blocks'
// https://web.dev/articles/indexeddb?hl=fr

const compoundId = (ca: string, blockStart: number, blockEnd: number) =>
  `v2-${ca}-${blockStart}-${blockEnd}`

export async function createBlockStore() {
  return openDB<MyDB>(dbName, dbVersion, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(blockStore)) {
        db.createObjectStore(blockStore)
      }
    },
  })
}

export async function storeBlockDataInStore(
  ca: string,
  blockStart: number,
  blockEnd: number,
  data: BlockTx[],
) {
  const db = await openDB<MyDB>(dbName, dbVersion)
  await db.put(blockStore, data, compoundId(ca, blockStart, blockEnd))
}

export async function getBlockDataFromStore(
  ca: string,
  blockStart: number,
  blockEnd: number,
): Promise<BlockTx[] | undefined> {
  const db = await openDB<MyDB>(dbName, dbVersion)
  const entry = await db.get(blockStore, compoundId(ca, blockStart, blockEnd))
  return entry
}
