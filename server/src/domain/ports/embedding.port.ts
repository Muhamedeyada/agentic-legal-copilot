export interface EmbeddingPort {
  embed(texts: readonly string[]): Promise<readonly number[][]>;
  readonly model: string;
  readonly dimensions: number;
}
