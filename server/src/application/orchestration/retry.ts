import { StepTimeoutError } from "../../domain/errors.js";

export async function withTimeout<T>(step: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new StepTimeoutError(step, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number },
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt === opts.retries) {
        break;
      }
      const delay = opts.baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
