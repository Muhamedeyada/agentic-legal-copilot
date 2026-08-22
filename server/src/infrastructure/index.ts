/**
 * Infrastructure layer — adapters for LLM providers, embeddings, vector stores, I/O.
 * Implements domain ports. Swap hosted APIs for local fallbacks without changing inner layers.
 */

export { loadConfig, type AppConfig } from "./config.js";
export { HostedCompletionAdapter } from "./llm/hosted.adapter.js";
export { LocalCompletionAdapter } from "./llm/local.adapter.js";
export { MockCompletionAdapter } from "./llm/mock.adapter.js";
export { InMemoryApprovalAdapter } from "./approval/in-memory.adapter.js";
export { InMemoryPlaybookAdapter } from "./playbook/in-memory.adapter.js";
export { InMemoryRunStoreAdapter } from "./runs/in-memory.adapter.js";
export { createCompletionAdapter } from "./llm/factory.js";
export { createLegalServices } from "./composition.js";
