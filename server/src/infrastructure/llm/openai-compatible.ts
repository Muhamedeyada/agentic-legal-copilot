import type { CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";
import { estimateTokens } from "../../application/security/token-budget.js";

export interface ChatEndpoint {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  /** Upper bound on generated tokens; keeps spend predictable. */
  readonly maxTokens?: number;
  /** Extra attempts after a 429 / 5xx / network error. */
  readonly retries?: number;
  readonly fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  readonly model?: string;
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string | null } }>;
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

const MAX_RETRY_DELAY_MS = 5_000;

class RetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

function retryAfterMs(header: string | null): number | undefined {
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, MAX_RETRY_DELAY_MS) : undefined;
}

/**
 * POST {baseUrl}/chat/completions (OpenAI wire format, also served by Ollama, vLLM, LM Studio).
 * JSON mode is requested whenever the caller names a schema; Zod validation stays in the agents.
 */
export async function chatComplete(endpoint: ChatEndpoint, input: CompletionRequest): Promise<CompletionResult> {
  const doFetch = endpoint.fetchImpl ?? fetch;
  const url = `${endpoint.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = JSON.stringify({
    model: endpoint.model,
    temperature: 0,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    ...(input.jsonSchemaName ? { response_format: { type: "json_object" } } : {}),
    ...(endpoint.maxTokens ? { max_tokens: endpoint.maxTokens } : {}),
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.apiKey) {
    headers.Authorization = `Bearer ${endpoint.apiKey}`;
  }

  const attempts = (endpoint.retries ?? 1) + 1;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await attemptOnce();
    } catch (err) {
      if (!(err instanceof RetryableError) || attempt >= attempts) {
        throw err;
      }
      const delay = err.retryAfterMs ?? 250 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  async function attemptOnce(): Promise<CompletionResult> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(endpoint.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new Error(`${endpoint.providerId}: no response within ${endpoint.timeoutMs}ms.`);
      }
      throw new RetryableError(`${endpoint.providerId}: network error (${err instanceof Error ? err.message : String(err)}).`);
    }

    if (!res.ok) {
      // Provider error bodies never contain our key; still keep them short in logs and traces.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      const message = `${endpoint.providerId}: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`;
      if (res.status === 429 || res.status >= 500) {
        throw new RetryableError(message, retryAfterMs(res.headers.get("retry-after")));
      }
      throw new Error(message);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.length === 0) {
      throw new Error(`${endpoint.providerId}: completion had no message content.`);
    }
    const prompt = data.usage?.prompt_tokens;
    const completion = data.usage?.completion_tokens;
    return {
      text,
      providerId: endpoint.providerId,
      model: data.model ?? endpoint.model,
      usage: {
        promptTokens: typeof prompt === "number" ? prompt : estimateTokens(input.system + input.user),
        completionTokens: typeof completion === "number" ? completion : estimateTokens(text),
      },
    };
  }
}
