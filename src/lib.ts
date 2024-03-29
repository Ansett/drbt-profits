import type { Call } from "./types/Call";
import type { HashInfo } from "./types/HashInfo";

export interface DebouncedFunction<
  Args extends any[],
  F extends (...args: Args) => any
> {
  (this: ThisParameterType<F>, ...args: Args & Parameters<F>): void; // Promise<ReturnType<F>>
  cancel: () => boolean;
}

export function debounce<Args extends any[], F extends (...args: Args) => any>(
  callback: Function,
  waitMilliseconds = 100,
  options: {
    immediate?: boolean;
    onAnimationFrame?: boolean;
  } = {}
): DebouncedFunction<Args, F> {
  const { immediate = false, onAnimationFrame = false } = options;
  let timeoutId: number | undefined;

  const fn = function (this: ThisParameterType<F>, ...args: Parameters<F>) {
    const context = this;

    const doLater = function () {
      timeoutId = undefined;
      callback.apply(context, args);
    };

    const shouldCallNow = immediate && timeoutId === undefined;

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    timeoutId = onAnimationFrame
      ? window.requestAnimationFrame(doLater)
      : window.setTimeout(doLater, waitMilliseconds);

    if (shouldCallNow) {
      callback.apply(context, args);
    }
  };
  // cancel the pending function and returns true if something was actually canceled
  fn.cancel = (): boolean => {
    if (!timeoutId) return false;
    window.clearTimeout(timeoutId);
    timeoutId = undefined;
    return true;
  };

  return fn;
}

export function sleep(ms = 0, callback: Function = () => true) {
  return new Promise((resolve) =>
    window.setTimeout(() => resolve(callback()), ms)
  );
}
export function roundDec(value: number, decNumber = 2) {
  const mult = 10 ** decNumber;
  return Math.round(value * mult) / mult;
}

export function prettifyDate(
  rawDate: string,
  chunk: "date" | "hour" | "all" = "all"
) {
  let [date, hour] = rawDate.split(/[T ]/);
  hour = hour.replace(".000Z", "");
  return chunk === "date" ? date : chunk === "hour" ? hour : date + " " + hour;
}

export function decimalHourToString(num: number) {
  var minutes = (num % 1) * 60;
  const hours = num - (num % 1);

  return (
    hours.toString().padStart(2, "0") +
    ":" +
    minutes.toString().padStart(2, "0")
  );
}

export function round(num: number, decimals = 2) {
  const multiplicator = 10 ** decimals;
  return Math.round(num * multiplicator) / multiplicator;
}

const formatter = Intl.NumberFormat("en", { notation: "compact" });
export function prettifyMc(mc: number) {
  const formatted = formatter.format(mc);
  return formatted.endsWith("T") ? "..." : formatted;
}

export function localStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {} // in case storage is corrupted
}
export function localStorageSetObject(key: string, value: Record<string, any>) {
  try {
    localStorageSet(key, JSON.stringify(value));
  } catch (e) {} // in case storage is corrupted
}

export function localStorageGet(key: string): string | null {
  let value: string | null = null;
  try {
    value = localStorage.getItem(key);
  } catch (e) {} // in case storage is corrupted
  return value;
}

export function localStorageGetObject(key: string): Record<string, any> | null {
  let value: string | null = localStorageGet(key);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch (e) {} // in case storage is corrupted
  return null;
}

export function addTagsToHashes(
  hashes: Record<string, HashInfo>,
  tags: Record<string, string[]> | null,
  minCallsCount: number
) {
  // Show only hashes with some calls, and sort calls by Xs and rug status
  const bigHashes = Object.keys(hashes).reduce((arr, h) => {
    if (hashes[h].allCalls.length >= minCallsCount) {
      hashes[h].allCalls.sort((a, b) =>
        !a.rug && b.rug
          ? -1
          : a.rug && !b.rug
          ? 1
          : a.xs > b.xs
          ? -1
          : a.xs < b.xs
          ? 1
          : 0
      );

      arr.push(hashes[h]);
    }
    return arr;
  }, [] as HashInfo[]);

  // Add tags
  if (tags) {
    for (const hash of bigHashes) {
      if (tags[hash.id]) hash.tags = tags[hash.id];
    }
  }

  return bigHashes;
}

export function sumObjectProperty<T extends Record<string, any>>(
  arr: T[],
  numGetter: (t: T) => number
) {
  return arr.reduce((sum, obj) => sum + numGetter(obj), 0);
}

export function guessValues(
  MIN: number,
  MAX: number,
  AVG: number,
  N: number
): number[] {
  // Initialize the values with a linear distribution
  var values = Array.from(
    { length: N },
    (_, i) => MIN + (i * (MAX - MIN)) / (N - 1)
  );

  // Calculate the current average
  var currentAvg = values.reduce((a, b) => a + b, 0) / N;

  // Calculate the difference between the current and target averages
  var diff = AVG - currentAvg;

  // Calculate the total of all values, excluding the first and last
  var total = values.slice(1, N - 1).reduce((a, b) => a + b, 0);

  // Distribute the difference proportionally among all values, except the first and last
  for (var i = 1; i < N - 1; i++) {
    var proportion = values[i] / total;
    values[i] += diff * proportion;
  }

  return values;
}
