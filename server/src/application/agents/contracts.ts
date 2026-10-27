import type { ExtractedClause } from "../../domain/entities/workflow.js";
import type { ReviewMemo } from "../../domain/entities/memo.js";
import type { RiskFinding } from "../../domain/entities/risk.js";

export interface ClauseExtractorOutput {
  readonly clauses: readonly ExtractedClause[];
}

export interface RiskAssessorOutput {
  readonly findings: readonly RiskFinding[];
}

export interface MemoDrafterOutput {
  readonly memo: ReviewMemo;
}
