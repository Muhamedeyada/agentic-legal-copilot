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

interface WireUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
}

interface ChatCompletionResponse {
  readonly model?: string;
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null; readonly tool_calls?: readonly WireToolCall[] };
  }>;
  readonly usage?: WireUsage;
}

interface WireToolCallDelta extends WireToolCall {
  readonly index?: number;
}

interface ChatCompletionChunk {
  readonly model?: string;
  readonly choices?: ReadonlyArray<{
    readonly delta?: { readonly content?: string | null; readonly tool_calls?: readonly WireToolCallDelta[] };
  }>;
  readonly usage?: WireUsage | null;
  readonly error?: { readonly message?: string };
}

/** A reply read either from one JSON body or from accumulated stream chunks. */
interface WireReply {
  readonly model?: string;
  readonly content: string;
  readonly toolCalls: readonly WireToolCall[];
  readonly usage?: WireUsage;
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
    ...(input.onTextDelta ? { stream: true, stream_options: { include_usage: true } } : {}),
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

    const isStream = (res.headers.get("content-type") ?? "").includes("text/event-stream");
    const data = isStream && res.body ? await readStream(res.body) : readJson((await res.json()) as ChatCompletionResponse);
    const toolCalls = fromWireToolCalls(data.toolCalls);
    const text = data.content;
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

  function readJson(data: ChatCompletionResponse): WireReply {
    const message = data.choices?.[0]?.message;
    const content = typeof message?.content === "string" ? message.content : "";
    // A server that ignored `stream: true` still gets its text shown once.
    if (content.length > 0) input.onTextDelta?.(content);
    return {
      ...(data.model ? { model: data.model } : {}),
      content,
      toolCalls: message?.tool_calls ?? [],
      ...(data.usage ? { usage: data.usage } : {}),
    };
  }

  /**
   * Reads `data:` lines from an OpenAI-style SSE body, forwarding content deltas as they arrive and
   * stitching tool-call fragments by index. Once a delta has been forwarded the request is never
   * retried, so the caller never sees duplicated text.
   */
  async function readStream(stream: ReadableStream<Uint8Array>): Promise<WireReply> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const calls = new Map<number, { id?: string; type?: string; name: string; arguments: string }>();
    let buffered = "";
    let content = "";
    let model: string | undefined;
    let usage: WireUsage | undefined;
    let done = false;

    const handle = (line: string): void => {
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        done = true;
        return;
      }
      if (payload.length === 0) return;
      const chunk = JSON.parse(payload) as ChatCompletionChunk;
      if (chunk.error) {
        throw new Error(`${endpoint.providerId}: stream error — ${chunk.error.message ?? "unknown"}`);
      }
      model ??= chunk.model;
      if (chunk.usage) usage = chunk.usage;
      const delta = chunk.choices?.[0]?.delta;
      if (typeof delta?.content === "string" && delta.content.length > 0) {
        content += delta.content;
        input.onTextDelta?.(delta.content);
      }
      for (const part of delta?.tool_calls ?? []) {
        const index = part.index ?? 0;
        const call = calls.get(index) ?? { name: "", arguments: "" };
        if (part.id) call.id = part.id;
        if (part.type) call.type = part.type;
        call.name += part.function?.name ?? "";
        call.arguments += part.function?.arguments ?? "";
        calls.set(index, call);
      }
    };

    try {
      while (!done) {
        const { value, done: ended } = await reader.read();
        if (ended) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          handle(line);
          if (done) break;
        }
      }
      buffered += decoder.decode();
      if (!done && buffered.length > 0) handle(buffered);
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new Error(`${endpoint.providerId}: stream stalled past ${endpoint.timeoutMs}ms.`);
      }
      if (err instanceof Error && err.message.startsWith(`${endpoint.providerId}:`)) throw err;
      throw new Error(`${endpoint.providerId}: stream interrupted (${err instanceof Error ? err.message : String(err)}).`);
    } finally {
      reader.releaseLock();
    }

    return {
      ...(model ? { model } : {}),
      content,
      toolCalls: [...calls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, c]) => ({
          ...(c.id ? { id: c.id } : {}),
          ...(c.type ? { type: c.type } : {}),
          function: { name: c.name, arguments: c.arguments },
        })),
      ...(usage ? { usage } : {}),
    };
  }
}
