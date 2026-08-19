import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";

/** Hosted completions. SDK belongs here, not in domain or application. */
export class HostedCompletionAdapter implements CompletionPort {
  constructor(
    private readonly opts: { apiKey: string; baseUrl: string; model: string },
  ) {}

  async complete(_input: CompletionRequest): Promise<CompletionResult> {
    void this.opts;
    throw new Error("HostedCompletionAdapter is not connected.");
  }
}
