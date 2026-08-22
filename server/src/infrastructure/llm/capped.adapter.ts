import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";
import { clipPrompt, type TokenBudget } from "../../application/security/token-budget.js";

/** Caps prompt size before any provider call (LLM10). */
export class CappedCompletionAdapter implements CompletionPort {
  constructor(
    private readonly inner: CompletionPort,
    private readonly budget: TokenBudget,
  ) {}

  async complete(input: CompletionRequest): Promise<CompletionResult> {
    const system = clipPrompt(input.system, Math.floor(this.budget.maxPromptChars * 0.25));
    const user = clipPrompt(input.user, Math.floor(this.budget.maxPromptChars * 0.75));
    const result = await this.inner.complete({
      system,
      user,
      ...(input.jsonSchemaName ? { jsonSchemaName: input.jsonSchemaName } : {}),
    });
    const text =
      result.text.length > this.budget.maxCompletionChars
        ? result.text.slice(0, this.budget.maxCompletionChars)
        : result.text;
    return {
      text,
      providerId: result.providerId,
      model: result.model,
      ...(result.usage ? { usage: result.usage } : {}),
    };
  }
}
