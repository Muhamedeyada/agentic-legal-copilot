/**
 * Application layer — use cases, DTOs, typed agent contracts, orchestrator.
 *
 * May import from `domain` only. Must NEVER import Express, LLM SDKs, or vector clients.
 * Side-effecting operations and final memo drafting require Counsel approval.
 */

export type {
  ExtractClausesInput,
  AssessRiskInput,
  DraftMemoInput,
  ReviewJob,
} from "./dto.js";
export type {
  ClauseExtractorOutput,
  RiskAssessorOutput,
  MemoDrafterOutput,
} from "./agents/contracts.js";
export { LegalWorkflowOrchestrator, ReviewOrchestrator } from "./orchestrator.js";
export { CorpusRagUseCase, indexContractText } from "./chat/corpus-rag.js";
export { CounselApprovalUseCase } from "./hitl/counsel-approval.js";
export { DirectRagUseCase } from "./chat/direct-rag.js";
export { RunEventBus } from "./orchestration/event-bus.js";
