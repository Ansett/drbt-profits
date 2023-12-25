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
export function round2Dec(value: number) {
  return Math.round(value * 100) / 100;
}

export function prettifyDate(date: string) {
  return date.replace("T", " ").replace(".000Z", "");
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
  return formatter.format(mc);
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
