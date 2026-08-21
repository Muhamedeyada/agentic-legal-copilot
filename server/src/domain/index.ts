/**
 * Domain layer — entities, value objects, and ports.
 *
 * ZERO external dependencies. Do not import express, LLM SDKs, vector clients,
 * or any infrastructure/presentation module from this folder.
 */

export type { Locale, Clause, ContractDocument } from "./entities/contract.js";
export type { RiskFinding, RiskSeverity } from "./entities/risk.js";
export type { ReviewMemo, Citation } from "./entities/memo.js";
export type {
  LegalDocument,
  Chunk,
  ChunkMetadata,
  DocumentLanguage,
} from "./entities/document.js";
export type { CompletionPort, CompletionRequest, CompletionResult } from "./ports/completion.port.js";
export type { EmbeddingPort } from "./ports/embedding.port.js";
export type {
  VectorStorePort,
  RetrievedChunk,
  StoredChunk,
  VectorQueryFilter,
} from "./ports/vector-store.port.js";
export type { DocumentSourcePort } from "./ports/document-source.port.js";
export type { ApprovalPort } from "./ports/approval.port.js";
export { ApprovalRequiredError, LowEvidenceError } from "./errors.js";
export { DefaultClauseLevelChunker } from "./chunking/clause-level-chunker.js";
export { reciprocalRankFusion } from "./retrieval/rrf.js";
export { normalizeArabic, tokenize } from "./retrieval/arabic-normalize.js";
