import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";
import { chatComplete, type ChatEndpoint } from "./openai-compatible.js";

export interface LocalCompletionOptions {
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly apiKey?: string;
  readonly maxTokens?: number;
  readonly fetchImpl?: typeof fetch;
}

/** Local completions (OpenAI-compatible base URL, e.g. Ollama `/v1`). No key required. */
export class LocalCompletionAdapter implements CompletionPort {
  private readonly endpoint: ChatEndpoint;

  constructor(opts: LocalCompletionOptions) {
    this.endpoint = { providerId: "local", retries: 1, ...opts };
  }

  complete(input: CompletionRequest): Promise<CompletionResult> {
    return chatComplete(this.endpoint, input);
  }
}
