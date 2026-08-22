/**
 * Domain layer — entities, value objects, and ports.
 *
 * ZERO external dependencies. Do not import express, LLM SDKs, vector clients,
 * or any infrastructure/presentation module from this folder.
 */

export type { Locale, Clause, ContractDocument } from "./entities/contract.js";
export type {
  ClauseCategory,
  MandatoryClauseCategory,
} from "./entities/clause-category.js";
export { MANDATORY_CLAUSE_CATEGORIES, isMandatoryCategory } from "./entities/clause-category.js";
export type { RiskFinding, RiskSeverity } from "./entities/risk.js";
export type { ReviewMemo, Citation } from "./entities/memo.js";
export type { PlaybookClause } from "./entities/playbook.js";
export type {
  WorkflowState,
  WorkflowRun,
  ExtractedClause,
  RunTraceEvent,
  AgentId,
  ToolName,
  TokenUsage,
} from "./entities/workflow.js";
export type { CompletionPort, CompletionRequest, CompletionResult } from "./ports/completion.port.js";
export type { EmbeddingPort } from "./ports/embedding.port.js";
export type { VectorStorePort, RetrievedChunk } from "./ports/vector-store.port.js";
export type {
  ApprovalPort,
  ApprovalRecord,
  ApprovalDecision,
  CounselEditedMemo,
} from "./ports/approval.port.js";
export type { PlaybookPort } from "./ports/playbook.port.js";
export type { RunStorePort } from "./ports/run-store.port.js";
export {
  ApprovalRequiredError,
  InvalidStateTransitionError,
  MaxIterationsError,
  StepTimeoutError,
  ToolNotAllowedError,
  SchemaViolationError,
  RunNotFoundError,
} from "./errors.js";
export { assertTransition, canTransition } from "./workflow/transitions.js";
export { redactPii } from "./security/pii-redact.js";
export { detectPromptInjection, stripInjectionPhrases } from "./security/prompt-injection.js";
export { expandBilingualQuery } from "./retrieval/bilingual-expand.js";
