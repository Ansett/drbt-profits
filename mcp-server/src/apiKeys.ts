import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

export interface ApiKey {
  id: string
  key: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  usageCount: number
}

const DATA_DIR = process.env.DATA_DIR ?? resolve(import.meta.dirname, '../../data')
const KEYS_FILE = resolve(DATA_DIR, 'api-keys.json')

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function loadKeys(): ApiKey[] {
  ensureDir()
  if (!existsSync(KEYS_FILE)) return []
  return JSON.parse(readFileSync(KEYS_FILE, 'utf-8'))
}

function saveKeys(keys: ApiKey[]) {
  ensureDir()
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2))
}

export function getKeys(): Omit<ApiKey, 'key'>[] {
  return loadKeys().map(({ key, ...rest }) => ({
    ...rest,
    maskedKey: key.slice(0, 8) + '…' + key.slice(-4),
  })) as any
}

export function createKey(name: string): ApiKey {
  const keys = loadKeys()
  const newKey: ApiKey = {
    id: randomBytes(8).toString('hex'),
    key: 'profits_' + randomBytes(24).toString('hex'),
    name,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    usageCount: 0,
  }
  keys.push(newKey)
  saveKeys(keys)
  return newKey
}

export function deleteKey(id: string): boolean {
  const keys = loadKeys()
  const idx = keys.findIndex(k => k.id === id)
  if (idx === -1) return false
  keys.splice(idx, 1)
  saveKeys(keys)
  return true
}

/** Validate a bearer token against stored keys. Returns the key record if valid. */
export function validateBearer(bearer: string): ApiKey | null {
  const keys = loadKeys()
  return keys.find(k => k.key === bearer) ?? null
}

/** Record a usage hit for a key (by its raw token). */
export function recordUsage(bearer: string) {
  const keys = loadKeys()
  const key = keys.find(k => k.key === bearer)
  if (key) {
    key.usageCount++
    key.lastUsedAt = new Date().toISOString()
    saveKeys(keys)
  }
}
