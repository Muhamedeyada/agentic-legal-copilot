import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type SqliteDatabase } from "../../src/infrastructure/sqlite/database.js";
import { SqliteRunStoreAdapter } from "../../src/infrastructure/runs/sqlite.adapter.js";
import { SqliteApprovalStoreAdapter } from "../../src/infrastructure/approval/sqlite.adapter.js";
import { SqliteContractCatalogAdapter } from "../../src/infrastructure/corpus/sqlite-catalog.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { CounselApprovalUseCase } from "../../src/application/hitl/counsel-approval.js";
import { loadConfig } from "../../src/infrastructure/config.js";
import { createLegalServices, resolveDatabasePath } from "../../src/infrastructure/composition.js";
import type { ContractCatalogPort, ContractRecord } from "../../src/domain/ports/contract-catalog.port.js";
import type { WorkflowRun } from "../../src/domain/entities/workflow.js";

const CONTRACT = [
  "## 1. Liability",
  "The Supplier's liability shall not be subject to any monetary cap.",
  "## 2. Termination",
  "Either party may terminate on thirty (30) days' prior written notice.",
  "## 3. Governing Law",
  "This Agreement is governed by the laws of England and Wales.",
  "## 4. Indemnity",
  "Each party shall indemnify the other, capped at the liability cap.",
].join("\n");

let dir: string;
let path: string;
const open: SqliteDatabase[] = [];

function connect(): SqliteDatabase {
  const db = openDatabase(path);
  open.push(db);
  return db;
}

function restart(): SqliteDatabase {
  open.splice(0).forEach((db) => db.close());
  return connect();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "alc-sqlite-"));
  path = join(dir, "nested", "app.db");
});

afterEach(() => {
  open.splice(0).forEach((db) => db.close());
  rmSync(dir, { recursive: true, force: true });
});

function orchestratorOn(db: SqliteDatabase) {
  const runs = new SqliteRunStoreAdapter(db);
  const approval = new SqliteApprovalStoreAdapter(db);
  const orchestrator = new LegalWorkflowOrchestrator({
    completion: new MockCompletionAdapter(),
    playbook: new InMemoryPlaybookAdapter(),
    approval,
    runs,
    requireCounselApproval: true,
    maxRetries: 0,
  });
  return { runs, approval, orchestrator, gate: new CounselApprovalUseCase(approval, runs) };
}

describe("openDatabase", () => {
  it("creates the file and parent folders, and migrates once", () => {
    const db = connect();
    expect(db.pragma("user_version", { simple: true })).toBe(1);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();
    expect(tables).toEqual(expect.arrayContaining(["approval_audit", "approvals", "run_traces", "runs", "uploads"]));
    const again = restart();
    expect(again.pragma("user_version", { simple: true })).toBe(1);
  });
});

describe("SqliteRunStoreAdapter", () => {
  it("round-trips a full review run, including traces and token usage, across a restart", async () => {
    const { orchestrator } = orchestratorOn(connect());
    const run = await orchestrator.start({ contractId: "c-1", text: CONTRACT, language: "both" });
    expect(run.state).toBe("AWAITING_APPROVAL");

    const reloaded = await new SqliteRunStoreAdapter(restart()).get(run.runId);
    expect(reloaded).toEqual(run);
    expect(reloaded?.traces.length).toBeGreaterThan(5);
    expect(reloaded?.traces.some((t) => t.toolName === "risk_calculator_tool")).toBe(true);
    expect((reloaded?.tokenUsage.promptTokens ?? 0) + (reloaded?.tokenUsage.completionTokens ?? 0)).toBeGreaterThan(0);
    expect(reloaded?.memo?.approvedByCounsel).toBe(false);
  });

  it("appends traces without duplicating ones already stored", async () => {
    const db = connect();
    const store = new SqliteRunStoreAdapter(db);
    const run: WorkflowRun = {
      runId: "r-append",
      contractId: "c",
      language: "en",
      contractText: "x",
      state: "INIT",
      clauses: [],
      findings: [],
      memo: undefined,
      rejectionReason: undefined,
      traces: [{ at: "t1", step: "INIT", latencyMs: 0, input: {}, output: {} }],
      tokenUsage: { promptTokens: 0, completionTokens: 0 },
      iteration: 0,
      createdAt: "t0",
      updatedAt: "t0",
    };
    await store.save(run);
    await store.save(run);
    run.traces.push({ at: "t2", step: "EXTRACTING", agentId: "clause_extractor", latencyMs: 3.7, input: { a: 1 }, output: null, tokenUsage: { promptTokens: 5, completionTokens: 2 } });
    await store.save(run);
    const got = await store.get("r-append");
    expect(got?.traces).toHaveLength(2);
    expect(got?.traces[1]).toEqual({
      at: "t2",
      step: "EXTRACTING",
      agentId: "clause_extractor",
      latencyMs: 4,
      input: { a: 1 },
      output: null,
      tokenUsage: { promptTokens: 5, completionTokens: 2 },
    });
    expect(await store.get("missing")).toBeUndefined();
  });

  it("marks runs that were mid-pipeline at shutdown as FAILED, but keeps runs awaiting Counsel", async () => {
    const db = connect();
    const store = new SqliteRunStoreAdapter(db);
    const base = { contractId: "c", language: "en" as const, contractText: "x", clauses: [], findings: [], memo: undefined, rejectionReason: undefined, traces: [], tokenUsage: { promptTokens: 0, completionTokens: 0 }, iteration: 1, createdAt: "t", updatedAt: "t" };
    await store.save({ ...base, runId: "mid", state: "ASSESSING" });
    await store.save({ ...base, runId: "waiting", state: "AWAITING_APPROVAL", traces: [] });

    const after = new SqliteRunStoreAdapter(restart());
    expect(await after.failInterruptedRuns("interrupted")).toBe(1);
    const mid = await after.get("mid");
    expect(mid?.state).toBe("FAILED");
    expect(mid?.traces.at(-1)).toMatchObject({ step: "FAILED", error: "interrupted" });
    expect((await after.get("waiting"))?.state).toBe("AWAITING_APPROVAL");
  });
});

describe("SqliteApprovalStoreAdapter", () => {
  it("keeps the current decision and an append-only audit trail across a restart", async () => {
    const approvals = new SqliteApprovalStoreAdapter(connect());
    await approvals.reject("run-1", "counsel-a", "cap missing");
    await approvals.editAndApprove("run-1", "counsel-b", { bodyEn: "edited" });

    const after = new SqliteApprovalStoreAdapter(restart());
    expect(await after.isApproved("run-1")).toBe(true);
    expect(await after.getRecord("run-1")).toMatchObject({ decision: "edited", counselId: "counsel-b", editedMemo: { bodyEn: "edited" } });
    expect((await after.getRecord("run-1"))?.reason).toBeUndefined();
    const audit = await after.auditTrail("run-1");
    expect(audit.map((a) => [a.decision, a.counselId, a.reason])).toEqual([
      ["rejected", "counsel-a", "cap missing"],
      ["edited", "counsel-b", undefined],
    ]);
    expect(await after.isApproved("unknown")).toBe(false);
  });
});

describe("SqliteContractCatalogAdapter", () => {
  const corpus: ContractCatalogPort = {
    async list() {
      return [{ id: "D1T1-EN-NDA-001", title: "NDA", language: "en", source: "corpus", contractType: "nda" }];
    },
    async get(id): Promise<ContractRecord | undefined> {
      return id === "D1T1-EN-NDA-001" ? { id, title: "NDA", language: "en", source: "corpus", text: "corpus text" } : undefined;
    },
    async saveUpload() {
      throw new Error("corpus is read-only");
    },
  };

  it("persists uploads across a restart and still serves the corpus", async () => {
    const saved = await new SqliteContractCatalogAdapter(connect(), corpus).saveUpload({ title: "  ", language: "ar", text: "نص العقد" });
    expect(saved.title).toBe("Uploaded contract");

    const after = new SqliteContractCatalogAdapter(restart(), corpus);
    expect((await after.list()).map((c) => [c.id, c.source])).toEqual([
      ["D1T1-EN-NDA-001", "corpus"],
      [saved.id, "upload"],
    ]);
    expect(await after.get(saved.id)).toEqual(saved);
    expect((await after.get("D1T1-EN-NDA-001"))?.text).toBe("corpus text");
  });
});

describe("restart: Counsel can approve a run created before the restart", () => {
  it("approves through new adapters on the same database file", async () => {
    const before = orchestratorOn(connect());
    const run = await before.orchestrator.start({ contractId: "c-2", text: CONTRACT, language: "en" });

    const after = orchestratorOn(restart());
    const done = await after.gate.approveRun(run.runId, "counsel-z");
    expect(done.state).toBe("COMPLETED");
    expect(done.memo?.approvedByCounsel).toBe(true);
    expect((await after.runs.get(run.runId))?.state).toBe("COMPLETED");
    expect(await after.approval.isApproved(run.runId)).toBe(true);
  });
});

describe("composition", () => {
  it("uses SQLite by default and in-memory SQLite under the test runner", () => {
    const config = loadConfig();
    expect(config.persistence).toBe("sqlite");
    expect(config.databaseUrl).toBe(":memory:");
    const services = createLegalServices(config);
    expect(services.databasePath).toBe(":memory:");
    services.close();
  });

  it("resolves relative and default database paths against the repository root", () => {
    const config = loadConfig();
    const root = resolveDatabasePath({ ...config, databaseUrl: "" }).replace(/[\\/]data[\\/]runtime[\\/]app\.db$/, "");
    expect(resolveDatabasePath({ ...config, databaseUrl: "" })).toMatch(/[\\/]data[\\/]runtime[\\/]app\.db$/);
    expect(resolveDatabasePath({ ...config, databaseUrl: "file:./data/runtime/x.db" })).toBe(join(root, "data", "runtime", "x.db"));
    expect(resolveDatabasePath({ ...config, databaseUrl: path })).toBe(path);
  });

  it("keeps the pure in-memory stores available", () => {
    const services = createLegalServices({ ...loadConfig(), persistence: "memory" });
    expect(services.databasePath).toBeUndefined();
    services.close();
  });
});
