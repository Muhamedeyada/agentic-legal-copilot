import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";

export type UserRole = "counsel" | "analyst";

export interface AuthenticatedUser {
  readonly userId: string;
  readonly role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthTokens {
  readonly analystToken: string;
  readonly counselToken: string;
}

export const COUNSEL_FORBIDDEN = { error: "Forbidden: Requires Legal Counsel authorization" } as const;

/** Constant-time compare; hashing first keeps lengths equal. */
function tokenMatches(candidate: string, expected: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === "string") {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  // EventSource cannot set headers, so SSE streams may pass the token as a query parameter.
  const accept = req.headers.accept ?? "";
  if (req.method === "GET" && accept.includes("text/event-stream")) {
    const fromQuery = req.query.access_token;
    if (typeof fromQuery === "string" && fromQuery.length > 0) {
      return fromQuery;
    }
  }
  return undefined;
}

function roleForToken(token: string, tokens: AuthTokens): UserRole | undefined {
  if (tokenMatches(token, tokens.counselToken)) {
    return "counsel";
  }
  if (tokenMatches(token, tokens.analystToken)) {
    return "analyst";
  }
  return undefined;
}

/**
 * Resolves the caller from `Authorization: Bearer <token>`.
 * The token decides the role. `x-user-role` may only narrow it (counsel → analyst),
 * never grant counsel, because any client can set that header.
 */
export function authenticate(tokens: AuthTokens): RequestHandler {
  return (req, res, next) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: "UNAUTHENTICATED", message: "Bearer token is required." });
      return;
    }
    const tokenRole = roleForToken(token, tokens);
    if (!tokenRole) {
      res.status(401).json({ error: "UNAUTHENTICATED", message: "Invalid bearer token." });
      return;
    }
    const requested = req.headers["x-user-role"];
    const role: UserRole = tokenRole === "counsel" && requested === "analyst" ? "analyst" : tokenRole;
    req.user = { userId: `demo-${role}`, role };
    next();
  };
}

/** Decision audit identity comes from the token, never from the request body. */
export function counselId(req: Request): string {
  return req.user?.userId ?? "anonymous";
}

/** HITL decisions and memo finalization are Counsel-only. */
export const requireCounsel: RequestHandler = (req, res, next) => {
  if (req.user?.role !== "counsel") {
    res.status(403).json(COUNSEL_FORBIDDEN);
    return;
  }
  next();
};
