import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";

/** Placeholder local adapter (Ollama-compatible base URL). */
export class LocalCompletionAdapter implements CompletionPort {
  constructor(private readonly opts: { baseUrl: string; model: string }) {}

  async complete(_input: CompletionRequest): Promise<CompletionResult> {
    void this.opts;
    throw new Error("LocalCompletionAdapter is a scaffold stub — not connected yet.");
  }
}
