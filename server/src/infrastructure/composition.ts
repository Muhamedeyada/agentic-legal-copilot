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
import { IngestDocumentUseCase } from "../application/ingestion/ingest-document.js";
import { DocumentTextExtractor } from "./parsing/document-text.adapter.js";
import type { ContractCatalogPort } from "../domain/ports/contract-catalog.port.js";
import type { ApprovalPort } from "../domain/ports/approval.port.js";
import type { RunStorePort } from "../domain/ports/run-store.port.js";

export interface LegalServices {
  readonly orchestrator: LegalWorkflowOrchestrator;
  readonly counselGate: CounselApprovalUseCase;
  readonly events: RunEventBus;
  readonly catalog: ContractCatalogPort;
  readonly rag: DirectRagUseCase;
  readonly ingest: IngestDocumentUseCase;
  readonly databasePath: string | undefined;
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

export function resolveDatabasePath(config: AppConfig): string {
  const url = config.databaseUrl.trim();
  if (url === ":memory:") {
    return url;
  }
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (url.length === 0) {
    if (isServerless) {
      return "/tmp/app.db";
    }
    const repoRoot = resolve(resolveCorpusDir(config), "..", "..");
    return resolve(repoRoot, "data", "runtime", "app.db");
  }
  const path = url.replace(/^file:/, "");
  if (isAbsolute(path)) {
    return path;
  }
  if (isServerless) {
    return resolve("/tmp", path);
  }
  const repoRoot = resolve(resolveCorpusDir(config), "..", "..");
  return resolve(repoRoot, path);
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
  try {
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
  } catch (err) {
    console.warn(
      `[alc-server] Failed to initialize SQLite storage (${err instanceof Error ? err.message : String(err)}). Falling back to in-memory persistence.`,
    );
    return {
      runs: new InMemoryRunStoreAdapter(),
      approval: new InMemoryApprovalAdapter(),
      catalog: corpus,
      interruptedRuns: Promise.resolve(0),
    };
  }
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
    ingest: new IngestDocumentUseCase(new DocumentTextExtractor(), catalog, config.maxUploadChars),
    databasePath: path,
    interruptedRuns,
    close: () => db?.close(),
  };
}
