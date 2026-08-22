import type { AppConfig } from "./config.js";
import { createCompletionAdapter } from "./llm/factory.js";
import { InMemoryApprovalAdapter } from "./approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "./playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "./runs/in-memory.adapter.js";
import { LegalWorkflowOrchestrator } from "../application/orchestrator.js";
import { CounselApprovalUseCase } from "../application/hitl/counsel-approval.js";

export interface LegalServices {
  readonly orchestrator: LegalWorkflowOrchestrator;
  readonly counselGate: CounselApprovalUseCase;
}

export function createLegalServices(config: AppConfig): LegalServices {
  const approval = new InMemoryApprovalAdapter();
  const runs = new InMemoryRunStoreAdapter();
  const playbook = new InMemoryPlaybookAdapter();
  const orchestrator = new LegalWorkflowOrchestrator({
    completion: createCompletionAdapter(config),
    playbook,
    approval,
    runs,
    requireCounselApproval: config.requireCounselApproval,
    maxRetries: 1,
  });
  return {
    orchestrator,
    counselGate: new CounselApprovalUseCase(approval, runs),
  };
}
