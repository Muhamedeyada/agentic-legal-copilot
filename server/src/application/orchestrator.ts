import { ApprovalRequiredError } from "../domain/errors.js";
import type { ApprovalPort } from "../domain/ports/approval.port.js";
import type { CompletionPort } from "../domain/ports/completion.port.js";
import type { VectorStorePort } from "../domain/ports/vector-store.port.js";
import type { DraftMemoInput, ExtractClausesInput, AssessRiskInput } from "./dto.js";
import type {
  ClauseExtractorOutput,
  MemoDrafterOutput,
  RiskAssessorOutput,
} from "./agents/schemas.js";

export interface OrchestratorPorts {
  readonly completion: CompletionPort;
  readonly vectors: VectorStorePort;
  readonly approval: ApprovalPort;
  readonly requireCounselApproval: boolean;
}

/**
 * Coordinates Clause Extractor → Risk Assessor → (Counsel gate) → Memo Drafter.
 * Agent bodies are not wired yet; the class defines the call order and the gate.
 */
export class ReviewOrchestrator {
  constructor(private readonly ports: OrchestratorPorts) {}

  async extractClauses(_input: ExtractClausesInput): Promise<ClauseExtractorOutput> {
    throw new Error("Clause Extractor is not implemented yet.");
  }

  async assessRisk(_input: AssessRiskInput): Promise<RiskAssessorOutput> {
    throw new Error("Risk Assessor is not implemented yet.");
  }

  async draftMemo(input: DraftMemoInput): Promise<MemoDrafterOutput> {
    if (this.ports.requireCounselApproval) {
      const ok = await this.ports.approval.isApproved(input.reviewId);
      if (!ok) {
        throw new ApprovalRequiredError();
      }
    }
    throw new Error("Memo Drafter is not implemented yet.");
  }
}
