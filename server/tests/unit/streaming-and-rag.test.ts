import { describe, expect, it } from "vitest";
import { RunCancelledError } from "../../src/domain/errors.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { RunEventBus } from "../../src/application/orchestration/event-bus.js";
import { DirectRagUseCase } from "../../src/application/chat/direct-rag.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import { InMemoryApprovalAdapter } from "../../src/infrastructure/approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";
import type { ContractCatalogPort, ContractRecord } from "../../src/domain/ports/contract-catalog.port.js";

const SAMPLE = `
## 1. Confidentiality
The parties shall keep confidential information secret for three (3) years.
`.trim();

function makeOrchestrator(events?: RunEventBus) {
  return new LegalWorkflowOrchestrator({
    completion: new MockCompletionAdapter(),
    playbook: new InMemoryPlaybookAdapter(),
    approval: new InMemoryApprovalAdapter(),
    runs: new InMemoryRunStoreAdapter(),
    ...(events ? { events } : {}),
    requireCounselApproval: true,
    maxRetries: 0,
    stepTimeoutMs: 5_000,
  });
}

describe("streaming events and cancellation", () => {
  it("emits AGENT_START, CLAUSE_EXTRACTED, RISK_FOUND, and AWAITING_APPROVAL", async () => {
    const events = new RunEventBus();
    const seen: string[] = [];
    const orchestrator = makeOrchestrator(events);
    const pending = orchestrator.start({
      contractId: "omit-core",
      text: SAMPLE,
      language: "en",
    });
    const run = await pending;
    const types = events.historyFor(run.runId).map((e) => e.type);
    seen.push(...types);
    expect(seen).toContain("AGENT_START");
    expect(seen).toContain("CLAUSE_EXTRACTED");
    expect(seen).toContain("RISK_FOUND");
    expect(seen).toContain("TOOL_EXEC");
    expect(seen).toContain("AWAITING_APPROVAL");
  });

  it("replays history to a late subscriber", async () => {
    const events = new RunEventBus();
    const orchestrator = makeOrchestrator(events);
    const run = await orchestrator.start({
      contractId: "omit-core",
      text: SAMPLE,
      language: "en",
    });
    const replayed: string[] = [];
    events.subscribe(run.runId, (e) => replayed.push(e.type));
    expect(replayed).toContain("AWAITING_APPROVAL");
  });

  it("cancels when the abort signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const orchestrator = makeOrchestrator();
    await expect(
      orchestrator.start({ contractId: "c", text: SAMPLE, language: "en" }, { signal: ac.signal }),
    ).rejects.toBeInstanceOf(RunCancelledError);
  });
});

describe("direct RAG", () => {
  it("returns playbook citations for a liability query", async () => {
    const catalog: ContractCatalogPort = {
      async list() {
        return [];
      },
      async get(): Promise<ContractRecord | undefined> {
        return undefined;
      },
      async saveUpload() {
        throw new Error("unused");
      },
    };
    const rag = new DirectRagUseCase(catalog, new InMemoryPlaybookAdapter());
    const result = await rag.ask({ query: "liability cap twelve months fees", language: "en" });
    expect(result.refused).toBe(false);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]?.chunkId).toMatch(/playbook/);
  });

  it("refuses when there is not enough information", async () => {
    const catalog: ContractCatalogPort = {
      async list() {
        return [];
      },
      async get(): Promise<ContractRecord | undefined> {
        return undefined;
      },
      async saveUpload() {
        throw new Error("unused");
      },
    };
    const rag = new DirectRagUseCase(catalog, new InMemoryPlaybookAdapter());
    const result = await rag.ask({ query: "amoxicillin dosage pediatric" });
    expect(result.refused).toBe(true);
    expect(result.reason).toBe("not_enough_information");
  });
});
