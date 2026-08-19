import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";

/** Local completions (OpenAI-compatible base URL, e.g. Ollama). */
export class LocalCompletionAdapter implements CompletionPort {
  constructor(private readonly opts: { baseUrl: string; model: string }) {}

  async complete(_input: CompletionRequest): Promise<CompletionResult> {
    void this.opts;
    throw new Error("LocalCompletionAdapter is not connected.");
  }
}
