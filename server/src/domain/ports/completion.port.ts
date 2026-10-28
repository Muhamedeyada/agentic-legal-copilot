/** A function the model may call; `parameters` is a JSON Schema object (OpenAI function-calling shape). */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

/** A tool call requested by the model. `arguments` is the raw JSON string and is untrusted. */
export interface ToolCallRequest {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/** Turns after the initial system + user messages in a tool-calling conversation. */
export type ConversationTurn =
  | { readonly role: "assistant"; readonly content: string; readonly toolCalls: readonly ToolCallRequest[] }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

export interface CompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly jsonSchemaName?: string;
  readonly history?: readonly ConversationTurn[];
  readonly tools?: readonly ToolSpec[];
  /** When set, adapters that can stream report message content as it arrives; the result is still complete. */
  readonly onTextDelta?: (delta: string) => void;
}

export interface TokenUsageHint {
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export interface CompletionResult {
  readonly text: string;
  readonly providerId: string;
  readonly model: string;
  readonly usage?: TokenUsageHint;
  /** Present when the model asked for tools instead of (or before) a final answer. */
  readonly toolCalls?: readonly ToolCallRequest[];
}

export interface CompletionPort {
  complete(input: CompletionRequest): Promise<CompletionResult>;
}

/** Characters the provider will see for this request, used for budget checks. */
export function requestChars(input: CompletionRequest): number {
  let total = input.system.length + input.user.length;
  for (const turn of input.history ?? []) {
    total += turn.content.length;
    if (turn.role === "assistant") {
      for (const call of turn.toolCalls) total += call.name.length + call.arguments.length;
    }
  }
  return total;
}
