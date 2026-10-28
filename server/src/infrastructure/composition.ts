import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { AppConfig } from "./config.js";
import { createCompletionAdapter } from "./llm/factory.js";
import { InMemoryApprovalAdapter } from "./approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "./playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "./runs/in-memory.adapter.js";
import { FileContractCatalogAdapter } from "./corpus/file-catalog.adapter.js";
import { SqliteContractCatalogAdapter } from "./corpus/sqlite-catalog.adapter.js";
import { SqliteApprovalStoreAdapter } from "./approval/sqlite.adapter.js";
import { SqliteRunStoreAdapter } from "./runs/sqlite.adapter.js";
import { openDatabase, type SqliteDatabase } from "./sqlite/database.js";
import { LocalDeterministicEmbeddingAdapter } from "./embeddings/local-deterministic.adapter.js";
import { LegalWorkflowOrchestrator } from "../application/orchestrator.js";
import { CounselApprovalUseCase } from "../application/hitl/counsel-approval.js";
import { RunEventBus } from "../application/orchestration/event-bus.js";
import { DirectRagUseCase } from "../application/chat/direct-rag.js";
import type { ContractCatalogPort } from "../domain/ports/contract-catalog.port.js";
import type { ApprovalPort } from "../domain/ports/approval.port.js";
import type { RunStorePort } from "../domain/ports/run-store.port.js";

export interface LegalServices {
  readonly orchestrator: LegalWorkflowOrchestrator;
  readonly counselGate: CounselApprovalUseCase;
  readonly events: RunEventBus;
  readonly catalog: ContractCatalogPort;
  readonly rag: DirectRagUseCase;
  /** Path of the SQLite file, `:memory:`, or undefined when persistence is `memory`. */
  readonly databasePath: string | undefined;
  /** Runs that were mid-pipeline when the process last stopped and were marked FAILED. */
  readonly interruptedRuns: Promise<number>;
  close(): void;
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

/** Relative paths resolve against the repository root, so dev (cwd `server/`) and Docker agree. */
export function resolveDatabasePath(config: AppConfig): string {
  const url = config.databaseUrl.trim();
  if (url === ":memory:") {
    return url;
  }
  const repoRoot = resolve(resolveCorpusDir(config), "..", "..");
  if (url.length === 0) {
    return resolve(repoRoot, "data", "runtime", "app.db");
  }
  const path = url.replace(/^file:/, "");
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

interface Stores {
  readonly runs: RunStorePort;
  readonly approval: ApprovalPort;
  readonly catalog: ContractCatalogPort;
  readonly db?: SqliteDatabase;
  readonly path?: string;
  readonly interruptedRuns: Promise<number>;
}

function createStores(config: AppConfig): Stores {
  const corpus = new FileContractCatalogAdapter(resolveCorpusDir(config));
  if (config.persistence === "memory") {
    return {
      runs: new InMemoryRunStoreAdapter(),
      approval: new InMemoryApprovalAdapter(),
      catalog: corpus,
      interruptedRuns: Promise.resolve(0),
    };
  }
  const path = resolveDatabasePath(config);
  const db = openDatabase(path);
  const runs = new SqliteRunStoreAdapter(db);
  return {
    runs,
    approval: new SqliteApprovalStoreAdapter(db),
    catalog: new SqliteContractCatalogAdapter(db, corpus),
    db,
    path,
    interruptedRuns: runs.failInterruptedRuns("Interrupted: the server stopped before this run finished."),
  };
}

export function createLegalServices(config: AppConfig): LegalServices {
  const { runs, approval, catalog, db, path, interruptedRuns } = createStores(config);
  const playbook = new InMemoryPlaybookAdapter();
  const events = new RunEventBus();
  const embeddings = new LocalDeterministicEmbeddingAdapter();
  const orchestrator = new LegalWorkflowOrchestrator({
    completion: createCompletionAdapter(config),
    playbook,
    approval,
    runs,
    events,
    embeddings,
    requireCounselApproval: config.requireCounselApproval,
    maxRetries: 1,
    stepTimeoutMs: Math.max(30_000, config.llmTimeoutMs * 2 + 5_000),
  });
  return {
    orchestrator,
    counselGate: new CounselApprovalUseCase(approval, runs, events),
    events,
    catalog,
    rag: new DirectRagUseCase(catalog, playbook, embeddings),
    databasePath: path,
    interruptedRuns,
    close: () => db?.close(),
  };
}
