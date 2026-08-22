/** Clause families the extractor must classify (D1 + bilingual headings). */
export type ClauseCategory =
  | "liability"
  | "indemnity"
  | "ip"
  | "payment"
  | "termination"
  | "jurisdiction"
  | "confidentiality"
  | "other";

/**
 * Dangerous families that must never be silently omitted (D1 guardrail).
 * Missing any of these is worse than a false-positive flag.
 */
export const MANDATORY_CLAUSE_CATEGORIES = [
  "liability",
  "termination",
  "jurisdiction",
  "indemnity",
] as const satisfies readonly ClauseCategory[];

export type MandatoryClauseCategory = (typeof MANDATORY_CLAUSE_CATEGORIES)[number];

export function isMandatoryCategory(category: ClauseCategory): category is MandatoryClauseCategory {
  return (MANDATORY_CLAUSE_CATEGORIES as readonly string[]).includes(category);
}
