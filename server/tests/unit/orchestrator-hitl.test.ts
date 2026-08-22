import { describe, expect, it } from "vitest";
import { InvalidStateTransitionError, MaxIterationsError } from "../../src/domain/errors.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { CounselApprovalUseCase } from "../../src/application/hitl/counsel-approval.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import { InMemoryApprovalAdapter } from "../../src/infrastructure/approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";

const CONFIDENTIALITY_ONLY = `
## 1. Confidentiality
The parties shall keep confidential information secret for three (3) years.
`.trim();

const UNLIMITED_LIABILITY = `
## 1. Liability
The Supplier's liability shall not be subject to any monetary cap and is unlimited.

## 2. Indemnity
Each party shall indemnify the other, capped at twelve months of fees paid.

## 3. Termination
Either party may terminate on thirty (30) days' prior written notice.

## 4. Governing law
This agreement is governed by the laws of England and Wales. Courts of England have exclusive jurisdiction.
`.trim();

const ARABIC_SLA = `
## 1. بند الإنهاء
يجوز لمقدم الخدمة إنهاء الاتفاق بإخطار كتابي مدته يوم تقويمي واحد (1).

## 2. بند المسؤولية
تُحد مسؤولية مقدم الخدمة بما يعادل أتعاب اثني عشر شهراً.

## 3. بند التعويض
يعوض كل طرف الطرف الآخر في حدود سقف المسؤولية.

## 4. القانون الحاكم
يخضع هذا الاتفاق لقوانين إنجلترا وويلز.
`.trim();

function harness(opts?: { maxIterations?: number; requireCounselApproval?: boolean }) {
  const approval = new InMemoryApprovalAdapter();
  const runs = new InMemoryRunStoreAdapter();
  const orchestrator = new LegalWorkflowOrchestrator({
    completion: new MockCompletionAdapter(),
    playbook: new InMemoryPlaybookAdapter(),
    approval,
    runs,
    requireCounselApproval: opts?.requireCounselApproval ?? true,
    maxRetries: 0,
    stepTimeoutMs: 5_000,
    ...(opts?.maxIterations !== undefined ? { maxIterations: opts.maxIterations } : {}),
  });
  return {
    orchestrator,
    counsel: new CounselApprovalUseCase(approval, runs),
  };
}

describe("LegalWorkflowOrchestrator + counsel HITL (mocked LLM)", () => {
  it("stops at AWAITING_APPROVAL with a unique runId and traces", async () => {
    const { orchestrator } = harness();
    const run = await orchestrator.start({
      contractId: "D1T1-EN-NDA-omit",
      text: CONFIDENTIALITY_ONLY,
      language: "en",
    });

    expect(run.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(run.state).toBe("AWAITING_APPROVAL");
    expect(run.memo?.approvedByCounsel).toBe(false);
    expect(run.traces.some((t) => t.step === "EXTRACTING")).toBe(true);
    expect(run.traces.some((t) => t.toolName === "risk_calculator_tool")).toBe(true);
    expect(run.traces.some((t) => t.toolName === "save_draft_memo_tool")).toBe(true);
    expect(run.memo?.citations.length).toBeGreaterThan(0);
  });

  it("flags silent omission of liability, termination, governing law, and indemnity", async () => {
    const { orchestrator } = harness();
    const run = await orchestrator.start({
      contractId: "omit-core",
      text: CONFIDENTIALITY_ONLY,
      language: "en",
    });

    const omitted = run.findings.filter((f) => f.omitted);
    const cats = omitted.map((f) => f.category).sort();
    expect(cats).toEqual(["indemnity", "jurisdiction", "liability", "termination"]);
    expect(omitted.every((f) => f.severity === "critical")).toBe(true);
    expect(run.memo?.bodyEn).toMatch(/silent omission/i);
  });

  it("classifies Arabic headings and flags one-day termination", async () => {
    const { orchestrator } = harness();
    const run = await orchestrator.start({
      contractId: "D1T1-AR-SLA",
      text: ARABIC_SLA,
      language: "ar",
    });

    expect(run.clauses.some((c) => c.category === "termination" && c.language !== "en")).toBe(true);
    const term = run.findings.find((f) => f.category === "termination" && !f.omitted);
    expect(term?.severity).toBe("high");
    expect(run.findings.filter((f) => f.omitted)).toHaveLength(0);
  });

  it("scores uncapped liability as critical via the matrix, not the LLM", async () => {
    const { orchestrator } = harness();
    const run = await orchestrator.start({
      contractId: "D1T1-EN-NDA-003",
      text: UNLIMITED_LIABILITY,
      language: "en",
    });
    const liability = run.findings.find((f) => f.category === "liability" && !f.omitted);
    expect(liability?.severity).toBe("critical");
    expect(liability?.rationale).toMatch(/unlimited/i);
  });

  it("approveRun finalizes the memo", async () => {
    const { orchestrator, counsel } = harness();
    const started = await orchestrator.start({
      contractId: "c-approve",
      text: UNLIMITED_LIABILITY,
      language: "en",
    });
    const done = await counsel.approveRun(started.runId, "counsel-1");
    expect(done.state).toBe("COMPLETED");
    expect(done.memo?.approvedByCounsel).toBe(true);
  });

  it("rejectRun records feedback and completes", async () => {
    const { orchestrator, counsel } = harness();
    const started = await orchestrator.start({
      contractId: "c-reject",
      text: CONFIDENTIALITY_ONLY,
      language: "en",
    });
    const done = await counsel.rejectRun(started.runId, "Please expand the redlines.", "counsel-1");
    expect(done.state).toBe("COMPLETED");
    expect(done.rejectionReason).toBe("Please expand the redlines.");
    expect(done.memo?.approvedByCounsel).toBe(false);
  });

  it("editAndApproveRun overwrites counsel text before finalization", async () => {
    const { orchestrator, counsel } = harness();
    const started = await orchestrator.start({
      contractId: "c-edit",
      text: UNLIMITED_LIABILITY,
      language: "en",
    });
    const done = await counsel.editAndApproveRun(
      started.runId,
      { bodyEn: "Counsel-corrected memo." },
      "counsel-1",
    );
    expect(done.state).toBe("COMPLETED");
    expect(done.memo?.bodyEn).toBe("Counsel-corrected memo.");
    expect(done.memo?.approvedByCounsel).toBe(true);
  });

  it("refuses counsel actions before AWAITING_APPROVAL", async () => {
    const approval = new InMemoryApprovalAdapter();
    const runs = new InMemoryRunStoreAdapter();
    await runs.save({
      runId: "early",
      contractId: "c",
      language: "en",
      contractText: "x",
      state: "EXTRACTING",
      clauses: [],
      findings: [],
      memo: undefined,
      rejectionReason: undefined,
      traces: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0 },
      iteration: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const gate = new CounselApprovalUseCase(approval, runs);
    await expect(gate.approveRun("early", "c1")).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it("trips the max-iteration breaker", async () => {
    const { orchestrator } = harness({ maxIterations: 1 });
    await expect(
      orchestrator.start({
        contractId: "loop",
        text: CONFIDENTIALITY_ONLY,
        language: "en",
      }),
    ).rejects.toBeInstanceOf(MaxIterationsError);
  });
});
