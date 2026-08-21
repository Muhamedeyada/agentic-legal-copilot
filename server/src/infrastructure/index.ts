/**
 * Infrastructure layer — adapters for LLM providers, embeddings, vector stores, I/O.
 * Implements domain/application ports. Swap hosted APIs for local fallbacks without changing inner layers.
 */

export { loadConfig, type AppConfig } from "./config.js";
export { HostedCompletionAdapter } from "./llm/hosted.adapter.js";
export { LocalCompletionAdapter } from "./llm/local.adapter.js";
export { InMemoryApprovalAdapter } from "./approval/in-memory.adapter.js";
export { createCompletionAdapter } from "./llm/factory.js";
export { createEmbeddingAdapter } from "./embeddings/factory.js";
export { FileVectorStoreAdapter } from "./vector/file-vector-store.adapter.js";
export { InMemoryVectorStoreAdapter } from "./vector/in-memory.adapter.js";
export { createServices } from "./composition.js";
