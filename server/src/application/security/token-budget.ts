export interface TokenBudget {
  readonly maxPromptChars: number;
  readonly maxCompletionChars: number;
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  maxPromptChars: 12_000,
  maxCompletionChars: 8_000,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function clipPrompt(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n[TRUNCATED_FOR_TOKEN_CAP]`;
}

export class TokenBudgetExceededError extends Error {
  readonly code = "TOKEN_BUDGET_EXCEEDED";

  constructor(actual: number, max: number) {
    super(`Prompt length ${actual} exceeds cap ${max}.`);
    this.name = "TokenBudgetExceededError";
  }
}
