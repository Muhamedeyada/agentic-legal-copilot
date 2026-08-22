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

export type ClauseCategory =
  | "liability"
  | "indemnity"
  | "ip"
  | "payment"
  | "termination"
  | "jurisdiction"
  | "confidentiality"
  | "other";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface ContractSummary {
  id: string;
  title: string;
  language: "ar" | "en";
  source: "corpus" | "upload";
  contractType?: string;
  highRisk?: boolean;
}

export interface ContractRecord extends ContractSummary {
  text: string;
}

export interface ExtractedClause {
  id: string;
  contractId: string;
  category: ClauseCategory;
  title: string;
  text: string;
  language: "ar" | "en" | "mixed";
  heading: string;
  standard: boolean;
  spanStart: number;
  spanEnd: number;
}

export interface RiskFinding {
  id: string;
  clauseId: string;
  category: ClauseCategory;
  severity: RiskSeverity;
  rationale: string;
  citationIds: readonly string[];
  omitted: boolean;
}

export interface Citation {
  id: string;
  source: "contract" | "corpus";
  locator: string;
  language: "ar" | "en";
  excerpt: string;
  isTranslation: boolean;
}

export interface ReviewMemo {
  id: string;
  contractId: string;
  language: "ar" | "en" | "both";
  bodyAr?: string;
  bodyEn?: string;
  citations: readonly Citation[];
  approvedByCounsel: boolean;
}

export interface RunTraceEvent {
  at: string;
  step: WorkflowState;
  agentId?: string;
  toolName?: string;
  latencyMs: number;
  input: unknown;
  output: unknown;
  error?: string;
  tokenUsage?: { promptTokens: number; completionTokens: number };
}

export interface WorkflowSnapshot {
  runId: string;
  contractId: string;
  language: "ar" | "en" | "both";
  state: WorkflowState;
  clauses: ExtractedClause[];
  findings: RiskFinding[];
  memo?: ReviewMemo;
  rejectionReason?: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  traces: RunTraceEvent[];
  iteration: number;
  createdAt: string;
  updatedAt: string;
}

export interface RagCitation {
  chunkId: string;
  documentId: string;
  source: "contract" | "playbook";
  locator: string;
  excerpt: string;
  language: "ar" | "en";
  score: number;
}

export interface RagAnswer {
  answer: string;
  refused: boolean;
  reason?: string;
  citations: RagCitation[];
}

export type StreamEventType =
  | "AGENT_START"
  | "TOOL_EXEC"
  | "CLAUSE_EXTRACTED"
  | "RISK_FOUND"
  | "AWAITING_APPROVAL"
  | "HITL_DECISION"
  | "RUN_FAILED"
  | "RUN_CANCELLED"
  | "ping";

export interface StreamEvent {
  type: StreamEventType;
  runId?: string;
  at?: string;
  agentId?: string;
  step?: WorkflowState;
  toolName?: string;
  latencyMs?: number;
  clause?: ExtractedClause;
  finding?: RiskFinding;
  tokenUsage?: { promptTokens: number; completionTokens: number };
  message?: string;
  decision?: "approved" | "rejected" | "edited";
}
