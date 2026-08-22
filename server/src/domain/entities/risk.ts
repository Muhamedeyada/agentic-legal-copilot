import type { ClauseCategory } from "./clause-category.js";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskFinding {
  readonly id: string;
  readonly clauseId: string;
  readonly category: ClauseCategory;
  readonly severity: RiskSeverity;
  readonly rationale: string;
  readonly citationIds: readonly string[];
  /** True when a mandatory family is absent from the contract (silent omission). */
  readonly omitted: boolean;
}
