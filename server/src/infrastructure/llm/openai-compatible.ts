import {
  requestChars,
  type CompletionRequest,
  type CompletionResult,
  type ConversationTurn,
  type ToolCallRequest,
} from "../../domain/ports/completion.port.js";
import { estimateTokens } from "../../application/security/token-budget.js";

export interface ChatEndpoint {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly maxTokens?: number;
  readonly retries?: number;
  readonly fetchImpl?: typeof fetch;
}

interface WireToolCall {
  readonly id?: string;
  readonly type?: string;
  readonly function?: { readonly name?: string; readonly arguments?: string };
}

interface ChatCompletionResponse {
  readonly model?: string;
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null; readonly tool_calls?: readonly WireToolCall[] };
  }>;
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

const MAX_RETRY_DELAY_MS = 5_000;

function toWireTurn(turn: ConversationTurn): Record<string, unknown> {
  if (turn.role === "tool") {
    return { role: "tool", tool_call_id: turn.toolCallId, content: turn.content };
  }
  return {
    role: "assistant",
    content: turn.content.length > 0 ? turn.content : null,
    ...(turn.toolCalls.length > 0
      ? {
          tool_calls: turn.toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        }
      : {}),
  };
}

function fromWireToolCalls(calls: readonly WireToolCall[] | undefined): ToolCallRequest[] {
  return (calls ?? [])
    .filter((c) => c.type === undefined || c.type === "function")
    .map((c, index) => ({
      id: c.id ?? `call_${index}`,
      name: c.function?.name ?? "",
      arguments: c.function?.arguments ?? "",
    }));
}

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

export async function chatComplete(endpoint: ChatEndpoint, input: CompletionRequest): Promise<CompletionResult> {
  const doFetch = endpoint.fetchImpl ?? fetch;
  const url = `${endpoint.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const tools = input.tools ?? [];
  const body = JSON.stringify({
    model: endpoint.model,
    temperature: 0,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
      ...(input.history ?? []).map(toWireTurn),
    ],
    ...(tools.length > 0
      ? {
          tools: tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          tool_choice: "auto",
        }
      : input.jsonSchemaName
        ? { response_format: { type: "json_object" } }
        : {}),
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
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      const message = `${endpoint.providerId}: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`;
      if (res.status === 429 || res.status >= 500) {
        throw new RetryableError(message, retryAfterMs(res.headers.get("retry-after")));
      }
      throw new Error(message);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const message = data.choices?.[0]?.message;
    const toolCalls = fromWireToolCalls(message?.tool_calls);
    const text = typeof message?.content === "string" ? message.content : "";
    if (text.length === 0 && toolCalls.length === 0) {
      throw new Error(`${endpoint.providerId}: completion had no message content.`);
    }
    const prompt = data.usage?.prompt_tokens;
    const completion = data.usage?.completion_tokens;
    return {
      text,
      providerId: endpoint.providerId,
      model: data.model ?? endpoint.model,
      usage: {
        promptTokens: typeof prompt === "number" ? prompt : Math.ceil(requestChars(input) / 4),
        completionTokens: typeof completion === "number" ? completion : estimateTokens(text),
      },
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    };
  }
}
