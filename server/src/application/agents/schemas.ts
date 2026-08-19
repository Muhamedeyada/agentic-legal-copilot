import type { Clause } from "../../domain/entities/contract.js";
import type { RiskFinding } from "../../domain/entities/risk.js";
import type { ReviewMemo } from "../../domain/entities/memo.js";

/** Typed boundary for the Clause Extractor agent. */
export interface ClauseExtractorOutput {
  readonly clauses: readonly Clause[];
}

/** Typed boundary for the Risk Assessor agent. */
export interface RiskAssessorOutput {
  readonly findings: readonly RiskFinding[];
}

/** Typed boundary for the Memo Drafter agent (Counsel-gated). */
export interface MemoDrafterOutput {
  readonly memo: ReviewMemo;
}
