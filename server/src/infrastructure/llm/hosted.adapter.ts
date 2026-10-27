import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";
import { chatComplete, type ChatEndpoint } from "./openai-compatible.js";

export interface HostedCompletionOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxTokens?: number;
  readonly fetchImpl?: typeof fetch;
}

export class HostedCompletionAdapter implements CompletionPort {
  private readonly endpoint: ChatEndpoint;

  constructor(opts: HostedCompletionOptions) {
    if (opts.apiKey.trim().length === 0) {
      throw new Error("HostedCompletionAdapter requires an API key.");
    }
    this.endpoint = { providerId: "openai", retries: 1, ...opts };
  }

  complete(input: CompletionRequest): Promise<CompletionResult> {
    return chatComplete(this.endpoint, input);
  }
}
