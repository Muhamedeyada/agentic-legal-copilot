import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";

/** Placeholder hosted adapter — wire the SDK here later, not in domain/application. */
export class HostedCompletionAdapter implements CompletionPort {
  constructor(
    private readonly opts: { apiKey: string; baseUrl: string; model: string },
  ) {}

  async complete(_input: CompletionRequest): Promise<CompletionResult> {
    void this.opts;
    throw new Error("HostedCompletionAdapter is a scaffold stub — not connected yet.");
  }
}
