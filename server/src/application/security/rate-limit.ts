export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMITED";

  constructor(retryAfterSec: number) {
    super(`Too many requests. Retry after ${retryAfterSec}s.`);
    this.name = "RateLimitExceededError";
  }
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const prior = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (prior.length >= this.limit) {
      this.hits.set(key, prior);
      return false;
    }
    prior.push(now);
    this.hits.set(key, prior);
    return true;
  }
}
