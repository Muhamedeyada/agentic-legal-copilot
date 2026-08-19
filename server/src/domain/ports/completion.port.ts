export interface CompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly jsonSchemaName?: string;
}

export interface CompletionResult {
  readonly text: string;
  readonly providerId: string;
  readonly model: string;
}

export interface CompletionPort {
  complete(input: CompletionRequest): Promise<CompletionResult>;
}
