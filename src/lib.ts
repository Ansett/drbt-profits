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
