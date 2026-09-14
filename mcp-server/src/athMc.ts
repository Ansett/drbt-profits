import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cloneMap,
  sortAthMcFile,
  upsertAthMc,
  type AthMcMap,
  type AthMcReports,
} from '../../shared/ath-mc-file.js'

const DATA_DIR = process.env.DATA_DIR ?? resolve(import.meta.dirname, '../../data')
const ATH_MC_FILE = resolve(DATA_DIR, 'ath-mc.json')

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

export function getAthMcMap(): AthMcMap {
  if (!existsSync(ATH_MC_FILE)) return {}
  try {
    return sortAthMcFile(cloneMap(JSON.parse(readFileSync(ATH_MC_FILE, 'utf-8'))))
  } catch {
    return {}
  }
}

export function saveAthMc(ca: string, user: string, value: number | null): AthMcReports {
  const { map, reports } = upsertAthMc(getAthMcMap(), ca, user, value)
  ensureDir()
  writeFileSync(ATH_MC_FILE, JSON.stringify(map, null, 2) + '\n')
  return reports
}
