import writeXlsxFile from 'write-excel-file'
import type { Call, CallArchive, CallExportType, RowsForExport, SolCall } from './types/Call'
import type { HashInfo } from './types/HashInfo'
import type { AccuracyLog, Log } from './types/Log'
import type { ToastServiceMethods } from 'primevue/toastservice'
import { INITIAL_TP_SIZE_CODE } from './constants'
import { TakeProfit } from './types/TakeProfit'

type ExportedRows = {
  value: string | number
  format?: string
}[]

export interface DebouncedFunction<Args extends any[], F extends (...args: Args) => any> {
  (this: ThisParameterType<F>, ...args: Args & Parameters<F>): void // Promise<ReturnType<F>>
  cancel: () => boolean
}

export function debounce<Args extends any[], F extends (...args: Args) => any>(
  callback: Function,
  waitMilliseconds = 100,
  options: {
    immediate?: boolean
    onAnimationFrame?: boolean
  } = {},
): DebouncedFunction<Args, F> {
  const { immediate = false, onAnimationFrame = false } = options
  let timeoutId: number | undefined

  const fn = function (this: ThisParameterType<F>, ...args: Parameters<F>) {
    const context = this

    const doLater = function () {
      timeoutId = undefined
      callback.apply(context, args)
    }

    const shouldCallNow = immediate && timeoutId === undefined

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      timeoutId = undefined
    }

    timeoutId = onAnimationFrame
      ? window.requestAnimationFrame(doLater)
      : window.setTimeout(doLater, waitMilliseconds)

    if (shouldCallNow) {
      callback.apply(context, args)
    }
  }
  // cancel the pending function and returns true if something was actually canceled
  fn.cancel = (): boolean => {
    if (!timeoutId) return false
    window.clearTimeout(timeoutId)
    timeoutId = undefined
    return true
  }

  return fn
}

export function sleep(ms = 0, callback: Function = () => true) {
  return new Promise(resolve => setTimeout(() => resolve(callback()), ms))
}

export function extractDate(rawDate: string) {
  let [date, hour] = rawDate.split(/[T ]/)
  return date
}

export function decimalHourToString(num: number) {
  var minutes = (num % 1) * 60
  const hours = num - (num % 1)

  return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0')
}

export function round(num: number, decimals = 2) {
  const multiplicator = 10 ** decimals
  return Math.round(num * multiplicator) / multiplicator
}

const formatter = Intl.NumberFormat('en', { notation: 'compact' })
export function prettifyMc(mc: number) {
  const formatted = formatter.format(mc)
  return formatted.endsWith('T') ? '...' : formatted
}

export function localStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch (e) { } // in case storage is corrupted
}
export function localStorageSetObject(key: string, value: Record<string, any>) {
  try {
    localStorageSet(key, JSON.stringify(value))
  } catch (e) { } // in case storage is corrupted
}

export function localStorageGet(key: string): string | null {
  let value: string | null = null
  try {
    value = localStorage.getItem(key)
  } catch (e) { } // in case storage is corrupted
  return value
}

export function localStorageGetObject(key: string): Record<string, any> | null {
  let value: string | null = localStorageGet(key)
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed
  } catch (e) { } // in case storage is corrupted
  return null
}

export function addTagsToHashes<C extends Call | SolCall = Call>(
  hashes: Record<string, HashInfo<C>>,
  tags: Record<string, string[]> | null,
  minCallsCount: number,
) {
  // Show only hashes with some calls, and sort calls by Xs and rug status
  const bigHashes = Object.keys(hashes).reduce((arr, h) => {
    if (hashes[h].allCalls.length >= minCallsCount) {
      hashes[h].allCalls.sort((a, b) =>
        'rug' in a && !a.rug && 'rug' in b && b.rug ? -1 : 'rug' in a && a.rug && 'rug' in b && !b.rug ? 1 : a.xs > b.xs ? -1 : a.xs < b.xs ? 1 : 0,
      )

      arr.push(hashes[h])
    }
    return arr
  }, [] as HashInfo<C>[])

  // Add tags
  if (tags) {
    for (const hash of bigHashes) {
      if (tags[hash.id]) hash.tags = tags[hash.id]
    }
  }

  return bigHashes
}

export function sumObjectProperty<T extends Record<string, any>>(
  arr: T[],
  numGetter: (t: T) => number,
) {
  return arr.reduce((sum, obj) => sum + numGetter(obj), 0)
}

// Sale date is prorated from sale MC / ATH ratio
export function getSaleDate(call: Call | SolCall, saleMc: number) {
  const saleDelayHours = (call.athDelayHours / call.ath) * saleMc
  const saleDate = new Date(call.date)
  saleDate.setTime(saleDate.getTime() + saleDelayHours * 60 * 60 * 1000)

  return saleDate.toISOString().split('T')[0]
}

const REGEX_XY_CHAR = /[xy]/g
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(REGEX_XY_CHAR, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function mergeOrderedTuples(
  arr1: [number, number][],
  arr2: [number, number][],
): [number, number][] {
  const merged = structuredClone(arr1)
  merged.forEach(item => {
    const newValue = arr2.find(v => v[0] === item[0])
    if (newValue) item[1] = newValue[1]
  })
  return merged
}

function mean_absolute_error(accuracy: AccuracyLog[]) {
  if (!accuracy.length) return 0
  let sum = 0
  for (let i = 0; i < accuracy.length; i++) {
    sum += Math.abs(accuracy[i].realBuyMc - accuracy[i].theoricBuyMc)
  }
  return sum / accuracy.length
}
function mean_squared_error(accuracy: AccuracyLog[]) {
  if (!accuracy.length) return 0
  let sum = 0
  for (let i = 0; i < accuracy.length; i++) {
    sum += Math.pow(accuracy[i].realBuyMc - accuracy[i].theoricBuyMc, 2)
  }
  return sum / accuracy.length
}
function root_mean_squared_error(accuracy: AccuracyLog[]) {
  if (!accuracy.length) return 0
  let mse = mean_squared_error(accuracy)
  return Math.sqrt(mse)
}
export function mean_absolute_percentage_error(accuracy: AccuracyLog[]) {
  if (!accuracy.length) return 0
  let sum = 0
  for (let i = 0; i < accuracy.length; i++) {
    sum += Math.abs((accuracy[i].realBuyMc - accuracy[i].theoricBuyMc) / accuracy[i].realBuyMc)
  }
  return (sum / accuracy.length) * 100
}
export function mean_percentage_error(accuracy: AccuracyLog[]) {
  if (!accuracy.length) return 0
  let sum = 0
  for (let i = 0; i < accuracy.length; i++) {
    sum += (accuracy[i].realBuyMc - accuracy[i].theoricBuyMc) / accuracy[i].realBuyMc
  }
  return (sum / accuracy.length) * 100
}

export async function downloadDataUrl(
  dataUrl: string,
  filename?: string,
  open?: boolean,
): Promise<any> {
  const link = document.createElement('a')
  link.href = dataUrl
  if (open) link.target = '_blank'
  else link.download = filename || ''
  document.body.appendChild(link)
  link.click()
  await sleep(0)
  try {
    document.body.removeChild(link)
  } catch (e) { }
  if (filename) window.URL.revokeObjectURL(link.href) // if there is a filename we consider it's an inline data-url (which needs revocation)
}

export function getTextFileContent(file: File): Promise<string> {
  return new Promise(resolve => {
    if (!file) resolve('')

    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.readAsText(file)
  })
}

export function getRowForExport(row: (string | number | Date)[]): ExportedRows {
  return row.map(cell => ({
    value: typeof cell === 'object' ? (cell ? cell.toString() : '') : cell,
    format:
      // stringification before worker post has transformed Date to string, so passing along a format for the XLSX export
      typeof cell === 'string' && cell.includes('.000Z') ? 'yyyy/mm/dd hh:mm:ss' : '',
  }))
}

function formatRowsForExport(rows: RowsForExport) {
  for (const index in rows) {
    for (const cell of rows[index]) {
      // header
      if (index === '0') {
        cell.fontWeight = 'bold'
        cell.align = 'center'
      } else {
        // recreate Date from string so it can be converted properly in XLSX
        if (cell.format?.startsWith('yyyy')) cell.value = new Date(cell.value)
      }
    }
  }
}

async function downloadBlob(blob: Blob, title: CallExportType) {
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.download = `${title}.xlsx`
  document.body.appendChild(link)
  link.click()
  await sleep(0)
  try {
    document.body.removeChild(link)
  } catch (e) { }
  window.URL.revokeObjectURL(link.href)
}

export async function downloadRowsXlsx(rows: RowsForExport, title: string) {
  formatRowsForExport(rows)
  const blob = await writeXlsxFile(rows, {
    stickyRowsCount: 1,
    fontFamily: 'Calibri',
    fontSize: 11,
  })
  downloadBlob(blob, title as CallExportType)
}

export function getRowsCorrespondingToLogs(
  logs: Log[] | null,
  caColumn: number,
  leftRows: CallArchive['rows'],
  rightRows: CallArchive['rows'] = [],
): ExportedRows[] {
  const headers = leftRows[0]
  leftRows.splice(0, 1)
  rightRows.splice(0, 1)

  const merged = [...leftRows]
  for (const right of rightRows) {
    if (leftRows.every(left => left[caColumn] !== right[caColumn])) merged.push(right)
  }

  const filtered = logs ? merged.filter(row => logs.some(log => log.ca === row[caColumn])) : merged

  return [getRowForExport(headers), ...filtered.map(getRowForExport)]
}

export function drbtSetRug(ca: string, state: boolean, apiKey: string, toast: ToastServiceMethods) {
  const params = new URLSearchParams({ ca, rug_state: state.toString() }).toString()
  const url = `https://defirobot.org/DRBT/SetRug?${params}`

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  })
    .then(async response => {
      if (!response.ok) {
        const errorMessage = await response.text()
        throw new Error(`Error ${response.status}: ${errorMessage}`)
      }

      const { message } = await response.json()
      toast.add({
        severity: 'success',
        summary: `${state ? 'Classified' : 'Unclassified'} has rug`,
        detail:
          message + `\n\nYou can DM @DeFi_Robot_ETH_bot /getruglog command to check a CA's status`,
        life: 10000,
      })
      return true
    })
    .catch(error => {
      toast.add({
        severity: 'error',
        summary: 'Failed to call DRBT rug API',
        detail: error.message ?? error.toString(),
        life: 10000,
      })
      return false
    })
}

export const getHeaderIndexes = <T extends string>(
  header: (string | number | Date)[],
  names: T[],
  onFail: (message: string) => void
): Record<T, number> | null => {
  const indexes = {} as Record<T, number>

  for (const name of names) {
    const allIndexes = header.flatMap((h, i) => (h === name ? i : []))
    if (!allIndexes.length) {
      // we'll use a default value if ETHPrice is not found
      if (name !== 'ETHPrice' && name !== 'sol_price') {
        onFail(`${name} header not found`)
        return null
      }
      indexes[name] = -1
      continue
    }

    // if the same header is present multiple time in sheet, take the last one
    indexes[name] = allIndexes.length > 1 ? allIndexes[allIndexes.length - 1] : allIndexes[0]
  }

  return indexes
}

export function fixTakeProfits(tps: TakeProfit[], initTp: TakeProfit) {
  // add taking-initial TP
  if (tps[0].size !== INITIAL_TP_SIZE_CODE) tps.unshift(initTp)
  for (const tp of tps) {
    if (tp.amount === undefined) {
      tp.amount = (tp as any).eth ?? initTp.amount
      tp.withAmount = (tp as any).withAmount ?? false
    }
  }
}

export const getPriceImpact = (lpAmount: number, previousPrice: number, nbTokens: number): number => {
  if (!lpAmount) return 5 / 100

  const lpOtherAmount = lpAmount / previousPrice
  const newPrice =
    (lpAmount - 1 * ((lpOtherAmount * lpAmount) / (lpOtherAmount + nbTokens) - lpAmount)) /
    (lpOtherAmount - nbTokens)
  const slippage = (newPrice / previousPrice - 1) * 100

  return slippage
}

export function initHash(id: string) {
  return {
    id,
    tags: [],
    perf: {
      x5: 0,
      x10: 0,
      x50: 0,
      x100: 0,
    },
    mooners: 0,
    mooners2: 0,
    rugs: 0,
    xSum: 0,
    allCalls: [],
  }
}

export function callIsPostAth(call: Call): boolean {
  return !call.rug && call.date > call.athDate
}