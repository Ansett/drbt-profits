import type { Call, SolCall } from './types.js'

export function extractDate(rawDate: string): string {
  const [date] = rawDate.split(/[T ]/)
  return date
}

export function round(num: number, decimals = 2): number {
  const multiplicator = 10 ** decimals
  return Math.round(num * multiplicator) / multiplicator
}

export function getSaleDate(call: Call | SolCall, saleMc: number): string {
  const saleDelayHours = (call.athDelayHours / call.ath) * saleMc
  const saleDate = new Date(call.date)
  saleDate.setTime(saleDate.getTime() + saleDelayHours * 60 * 60 * 1000)
  return saleDate.toISOString().split('T')[0]
}

export function getPriceImpact(lpAmount: number, previousPrice: number, nbTokens: number): number {
  if (!lpAmount) return 5 / 100
  const lpOtherAmount = lpAmount / previousPrice
  const newPrice =
    (lpAmount - 1 * ((lpOtherAmount * lpAmount) / (lpOtherAmount + nbTokens) - lpAmount)) /
    (lpOtherAmount - nbTokens)
  return (newPrice / previousPrice - 1) * 100
}

export function getDate(stringOrDate: string | Date) {
  return typeof stringOrDate === 'string' ? new Date(stringOrDate) : stringOrDate
}

export function sumObjectProperty<T extends Record<string, any>>(
  arr: T[],
  numGetter: (t: T) => number,
) {
  return arr.reduce((sum, obj) => sum + numGetter(obj), 0)
}