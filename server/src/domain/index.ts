/**
 * Domain layer — entities, value objects, and ports.
 *
 * ZERO external dependencies. Do not import express, LLM SDKs, vector clients,
 * or any infrastructure/presentation module from this folder.
 */

export type { Locale, Clause, ContractDocument } from "./entities/contract.js";
export type { RiskFinding, RiskSeverity } from "./entities/risk.js";
export type { ReviewMemo, Citation } from "./entities/memo.js";
export type { CompletionPort, CompletionRequest, CompletionResult } from "./ports/completion.port.js";
export type { EmbeddingPort } from "./ports/embedding.port.js";
export type { VectorStorePort, RetrievedChunk } from "./ports/vector-store.port.js";
export type { ApprovalPort } from "./ports/approval.port.js";
export { ApprovalRequiredError } from "./errors.js";
