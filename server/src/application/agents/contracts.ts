import type { ExtractedClause } from "../../domain/entities/workflow.js";
import type { ReviewMemo } from "../../domain/entities/memo.js";
import type { RiskFinding } from "../../domain/entities/risk.js";

/** Typed boundary for the Clause Extractor agent. */
export interface ClauseExtractorOutput {
  readonly clauses: readonly ExtractedClause[];
}

/** Typed boundary for the Risk Assessor agent. */
export interface RiskAssessorOutput {
  readonly findings: readonly RiskFinding[];
}

/** Typed boundary for the Memo Drafter agent (Counsel-gated finalization). */
export interface MemoDrafterOutput {
  readonly memo: ReviewMemo;
}
