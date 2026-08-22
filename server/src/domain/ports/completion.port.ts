export interface CompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly jsonSchemaName?: string;
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
}

export interface CompletionPort {
  complete(input: CompletionRequest): Promise<CompletionResult>;
}
