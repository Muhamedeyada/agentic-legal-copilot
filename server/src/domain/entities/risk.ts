export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskFinding {
  readonly id: string;
  readonly clauseId: string;
  readonly severity: RiskSeverity;
  readonly rationale: string;
  readonly citationIds: readonly string[];
}
