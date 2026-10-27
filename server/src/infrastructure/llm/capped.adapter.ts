import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";
import {
  estimateTokens,
  TokenBudgetExceededError,
  type TokenBudget,
} from "../../application/security/token-budget.js";

/**
 * Enforces the prompt/completion budget around any provider (LLM10).
 * Oversize prompts are refused before the network call: clipping would corrupt the JSON payloads
 * agents send, and the agents already fall back to deterministic rules on any error.
 * Always reports usage, estimating it when the provider does not.
 */
export class CappedCompletionAdapter implements CompletionPort {
  constructor(
    private readonly inner: CompletionPort,
    private readonly budget: TokenBudget,
  ) {}

  async complete(input: CompletionRequest): Promise<CompletionResult> {
    const promptChars = input.system.length + input.user.length;
    if (promptChars > this.budget.maxPromptChars) {
      throw new TokenBudgetExceededError(promptChars, this.budget.maxPromptChars);
    }
    const result = await this.inner.complete(input);
    const text =
      result.text.length > this.budget.maxCompletionChars
        ? result.text.slice(0, this.budget.maxCompletionChars)
        : result.text;
    return {
      text,
      providerId: result.providerId,
      model: result.model,
      usage: result.usage ?? {
        promptTokens: estimateTokens(input.system + input.user),
        completionTokens: estimateTokens(result.text),
      },
    };
  }
}
