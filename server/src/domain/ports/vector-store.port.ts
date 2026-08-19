export interface RetrievedChunk {
  readonly id: string;
  readonly text: string;
  readonly language: "ar" | "en";
  readonly score: number;
  readonly documentId: string;
}

export interface VectorStorePort {
  upsert(
    chunks: ReadonlyArray<{
      id: string;
      text: string;
      language: "ar" | "en";
      documentId: string;
      vector: number[];
    }>,
  ): Promise<void>;
  query(vector: number[], topK: number): Promise<readonly RetrievedChunk[]>;
}
