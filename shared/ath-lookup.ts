import type { ChainId } from './types.js'

const GECKO_NETWORK: Record<ChainId, string> = {
  ETH: 'eth',
  SOL: 'solana',
  RH: 'robinhood',
}

const GMGN_CHAIN: Record<ChainId, string> = {
  ETH: 'eth',
  SOL: 'sol',
  RH: 'robinhood',
}

export type AthLookupSource = 'gmgn' | 'geckoterminal'

export type AthLookupResult = {
  ath: number
  source: AthLookupSource
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function isChainId(value: string): value is ChainId {
  return value === 'ETH' || value === 'SOL' || value === 'RH'
}

export function parseAthLookupChain(value: unknown): ChainId | null {
  const chain = String(value || '').toUpperCase()
  return isChainId(chain) ? chain : null
}

async function geckoJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 429) {
    throw new Error('GeckoTerminal rate limit (about 10 calls/min). Wait a minute and retry.')
  }
  if (!res.ok) throw new Error(`GeckoTerminal error ${res.status}`)
  return res.json()
}

function poolBaseIsToken(pool: any, token: string): boolean {
  const id = String(pool?.relationships?.base_token?.data?.id || '').toLowerCase()
  return id.includes(token.toLowerCase())
}

async function fetchGeckoAthMc(chain: ChainId, ca: string): Promise<number> {
  const network = GECKO_NETWORK[chain]
  const token = chain === 'SOL' ? ca : ca.toLowerCase()

  const tokenJson = await geckoJson(
    `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${encodeURIComponent(token)}`,
  )
  const supply = num(tokenJson?.data?.attributes?.normalized_total_supply)
  if (!(supply > 0)) throw new Error('Token not found on GeckoTerminal')

  const poolsJson = await geckoJson(
    `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${encodeURIComponent(token)}/pools`,
  )
  const pools = Array.isArray(poolsJson?.data) ? poolsJson.data : []
  const ranked = [...pools].sort(
    (a, b) => num(b?.attributes?.reserve_in_usd) - num(a?.attributes?.reserve_in_usd),
  )
  const pool = ranked.find(p => poolBaseIsToken(p, token)) || ranked[0]
  const poolAddr = pool?.attributes?.address
  if (!poolAddr) throw new Error('No pool found on GeckoTerminal')

  const ohlcvJson = await geckoJson(
    `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddr}/ohlcv/day?aggregate=1&limit=1000`,
  )
  const candles = ohlcvJson?.data?.attributes?.ohlcv_list
  if (!Array.isArray(candles) || !candles.length) {
    throw new Error('No price history on GeckoTerminal')
  }
  const highs = candles.map((row: unknown) => num(Array.isArray(row) ? row[2] : undefined)).filter(n => n > 0)
  if (!highs.length) throw new Error('No price history on GeckoTerminal')

  const athMc = Math.max(...highs) * supply
  if (!(athMc > 0)) throw new Error('Could not compute ATH MC')
  return athMc
}

function gmgnAthMc(payload: any): number {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const athPrice = num(data?.ath_price)
  const supply = num(data?.circulating_supply) || num(data?.total_supply)
  if (!(athPrice > 0 && supply > 0)) return NaN
  return athPrice * supply
}

function gmgnError(status: number, payload: unknown): Error {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const code = typeof body?.error === 'string' ? body.error : ''
  const message = typeof body?.message === 'string' ? body.message : ''
  if (status === 429) return new Error('GMGN rate limit. Wait a bit and retry.')
  if (code === 'AUTH_KEY_INVALID') return new Error('GMGN API key rejected')
  if (code === 'AUTH_INVALID' || code === 'AUTH_TIMESTAMP_EXPIRED' || code === 'AUTH_CLIENT_ID_REPLAYED') {
    return new Error(message || 'GMGN auth failed')
  }
  if (status === 401 || status === 403) {
    return new Error(message || code || 'GMGN API key rejected')
  }
  return new Error(message || code || `GMGN error ${status}`)
}

async function fetchGmgnAthMc(chain: ChainId, ca: string, apiKey: string): Promise<number> {
  const address = chain === 'SOL' ? ca : ca.toLowerCase()
  const url = new URL('https://openapi.gmgn.ai/v1/token/info')
  url.searchParams.set('chain', GMGN_CHAIN[chain])
  url.searchParams.set('address', address)
  url.searchParams.set('timestamp', String(Math.floor(Date.now() / 1000)))
  url.searchParams.set('client_id', crypto.randomUUID())

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-APIKEY': apiKey },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw gmgnError(res.status, json)
  if (json && typeof json === 'object' && 'code' in json && Number(json.code) !== 0) {
    throw gmgnError(res.status || 502, json)
  }
  const athMc = gmgnAthMc(json)
  if (!(athMc > 0)) throw new Error('GMGN did not return ATH')
  return athMc
}

/** GMGN when a key is set (1 call, ~20/s). Otherwise GeckoTerminal (3 calls, ~10/min). */
export async function fetchAthMc(
  chain: ChainId,
  ca: string,
  gmgnApiKey = process.env.GMGN_API_KEY,
): Promise<AthLookupResult> {
  const key = gmgnApiKey?.trim()
  if (key) {
    try {
      return { ath: await fetchGmgnAthMc(chain, ca, key), source: 'gmgn' }
    } catch (error) {
      try {
        return { ath: await fetchGeckoAthMc(chain, ca), source: 'geckoterminal' }
      } catch {
        throw error
      }
    }
  }
  return { ath: await fetchGeckoAthMc(chain, ca), source: 'geckoterminal' }
}
