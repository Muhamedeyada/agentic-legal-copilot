import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";

/**
 * Test / offline completion adapter. Never calls a network LLM.
 * Agents treat thrown errors as a signal to fall back to deterministic RAG/rules.
 */
export class MockCompletionAdapter implements CompletionPort {
  constructor(private readonly impl?: (input: CompletionRequest) => Promise<CompletionResult> | CompletionResult) {}

  async complete(input: CompletionRequest): Promise<CompletionResult> {
    if (this.impl) {
      return this.impl(input);
    }
    throw new Error("MockCompletionAdapter: no LLM (deterministic fallback).");
  }
}
