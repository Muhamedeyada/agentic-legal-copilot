import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "./config.js";
import { createCompletionAdapter } from "./llm/factory.js";
import { InMemoryApprovalAdapter } from "./approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "./playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "./runs/in-memory.adapter.js";
import { FileContractCatalogAdapter } from "./corpus/file-catalog.adapter.js";
import { LegalWorkflowOrchestrator } from "../application/orchestrator.js";
import { CounselApprovalUseCase } from "../application/hitl/counsel-approval.js";
import { RunEventBus } from "../application/orchestration/event-bus.js";
import { DirectRagUseCase } from "../application/chat/direct-rag.js";
import type { ContractCatalogPort } from "../domain/ports/contract-catalog.port.js";

export interface LegalServices {
  readonly orchestrator: LegalWorkflowOrchestrator;
  readonly counselGate: CounselApprovalUseCase;
  readonly events: RunEventBus;
  readonly catalog: ContractCatalogPort;
  readonly rag: DirectRagUseCase;
}

export function resolveCorpusDir(config: AppConfig): string {
  const candidates = [
    config.corpusDir,
    resolve(process.cwd(), "../data/corpus"),
    resolve(process.cwd(), "data/corpus"),
    resolve(process.cwd(), "../../data/corpus"),
  ].filter((p) => p.length > 0);
  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  return resolve(process.cwd(), "../data/corpus");
}

export function createLegalServices(config: AppConfig): LegalServices {
  const approval = new InMemoryApprovalAdapter();
  const runs = new InMemoryRunStoreAdapter();
  const playbook = new InMemoryPlaybookAdapter();
  const events = new RunEventBus();
  const catalog = new FileContractCatalogAdapter(resolveCorpusDir(config));
  const orchestrator = new LegalWorkflowOrchestrator({
    completion: createCompletionAdapter(config),
    playbook,
    approval,
    runs,
    events,
    requireCounselApproval: config.requireCounselApproval,
    maxRetries: 1,
  });
  return {
    orchestrator,
    counselGate: new CounselApprovalUseCase(approval, runs, events),
    events,
    catalog,
    rag: new DirectRagUseCase(catalog, playbook),
  };
}
