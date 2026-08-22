import type { RequestHandler } from "express";
import { RateLimitExceededError, SlidingWindowLimiter } from "../../application/security/rate-limit.js";

export function rateLimitMiddleware(limitPerMinute: number): RequestHandler {
  const limiter = new SlidingWindowLimiter(limitPerMinute, 60_000);
  return (req, res, next) => {
    const key = req.ip ?? "anon";
    if (!limiter.allow(key)) {
      const err = new RateLimitExceededError(60);
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: err.code, message: err.message });
      return;
    }
    next();
  };
}
