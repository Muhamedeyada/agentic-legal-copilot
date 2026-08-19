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
} from "./agents/schemas.js";
export { ReviewOrchestrator } from "./orchestrator.js";
