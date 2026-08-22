import type { ClauseCategory } from "./clause-category.js";
import type { Locale } from "./contract.js";
import type { ReviewMemo } from "./memo.js";
import type { RiskFinding } from "./risk.js";

export type WorkflowState =
  | "INIT"
  | "EXTRACTING"
  | "ASSESSING"
  | "DRAFTING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EDITED"
  | "COMPLETED"
  | "FAILED";

export type AgentId = "clause_extractor" | "risk_assessor" | "memo_drafter";

export type ToolName =
  | "retrieval_tool"
  | "clause_comparison_tool"
  | "risk_calculator_tool"
  | "save_draft_memo_tool";

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export interface RunTraceEvent {
  readonly at: string;
  readonly step: WorkflowState;
  readonly agentId?: AgentId;
  readonly toolName?: ToolName;
  readonly latencyMs: number;
  readonly input: unknown;
  readonly output: unknown;
  readonly tokenUsage?: TokenUsage;
  readonly error?: string;
}

export interface ExtractedClause {
  readonly id: string;
  readonly contractId: string;
  readonly category: ClauseCategory;
  readonly title: string;
  readonly text: string;
  readonly language: Locale;
  readonly heading: string;
  readonly standard: boolean;
  readonly spanStart: number;
  readonly spanEnd: number;
}

export interface WorkflowRun {
  readonly runId: string;
  readonly contractId: string;
  readonly language: "ar" | "en" | "both";
  readonly contractText: string;
  state: WorkflowState;
  clauses: ExtractedClause[];
  findings: RiskFinding[];
  memo: ReviewMemo | undefined;
  rejectionReason: string | undefined;
  traces: RunTraceEvent[];
  tokenUsage: TokenUsage;
  iteration: number;
  createdAt: string;
  updatedAt: string;
}
