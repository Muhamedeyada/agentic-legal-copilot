import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { HybridRetrieveUseCase } from "../application/hybrid-retrieve.js";
import { IngestCorpusUseCase } from "../application/ingest-corpus.js";
import { ReviewOrchestrator } from "../application/orchestrator.js";
import type { EmbeddingPort } from "../domain/ports/embedding.port.js";
import type { VectorStorePort } from "../domain/ports/vector-store.port.js";
import { InMemoryApprovalAdapter } from "./approval/in-memory.adapter.js";
import { loadConfig, type AppConfig } from "./config.js";
import { FileCorpusAdapter } from "./corpus/file-corpus.adapter.js";
import { createEmbeddingAdapter } from "./embeddings/factory.js";
import { createCompletionAdapter } from "./llm/factory.js";
import { FileVectorStoreAdapter } from "./vector/file-vector-store.adapter.js";
import { InMemoryVectorStoreAdapter } from "./vector/in-memory.adapter.js";

export interface AppServices {
  readonly config: AppConfig;
  readonly embeddings: EmbeddingPort;
  readonly store: VectorStorePort;
  readonly ingest: IngestCorpusUseCase;
  readonly retrieve: HybridRetrieveUseCase;
  readonly orchestrator: ReviewOrchestrator;
}

export function resolveExistingPath(configured: string, fallbacks: string[]): string {
  const candidates = [resolve(process.cwd(), configured), ...fallbacks.map((f) => resolve(process.cwd(), f))];
  return candidates.find((p) => existsSync(p)) ?? candidates[0] ?? configured;
}

function resolveIndexPath(configured: string): string {
  const existing = [resolve(process.cwd(), configured), resolve(process.cwd(), "../data/runtime/vector-index.json"), resolve(process.cwd(), "data/runtime/vector-index.json")];
  const found = existing.find((p) => existsSync(p));
  if (found) {
    return found;
  }
  if (existsSync(resolve(process.cwd(), "../data/corpus"))) {
    return resolve(process.cwd(), "../data/runtime/vector-index.json");
  }
  if (existsSync(resolve(process.cwd(), "data/corpus"))) {
    return resolve(process.cwd(), "data/runtime/vector-index.json");
  }
  return existing[0] ?? configured;
}

export function createServices(config = loadConfig()): AppServices {
  const embeddings = createEmbeddingAdapter(config);
  const corpusDir = resolveExistingPath(config.corpusDir, ["../data/corpus", "data/corpus"]);
  const indexPath = resolveIndexPath(config.vectorIndexPath);

  const store: VectorStorePort =
    config.vectorStoreProvider === "memory"
      ? new InMemoryVectorStoreAdapter()
      : new FileVectorStoreAdapter(indexPath, embeddings.model, embeddings.dimensions);

  const source = new FileCorpusAdapter(corpusDir);
  const ingest = new IngestCorpusUseCase(source, embeddings, store);
  const retrieve = new HybridRetrieveUseCase(embeddings, store);
  const orchestrator = new ReviewOrchestrator({
    completion: createCompletionAdapter(config),
    vectors: store,
    approval: new InMemoryApprovalAdapter(),
    requireCounselApproval: config.requireCounselApproval,
  });

  return { config, embeddings, store, ingest, retrieve, orchestrator };
}
