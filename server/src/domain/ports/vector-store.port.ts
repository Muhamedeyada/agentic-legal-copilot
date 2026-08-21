export interface VectorQueryFilter {
  readonly language?: "ar" | "en";
  readonly documentId?: string;
}

export interface ChunkMetadataRecord {
  readonly source: string;
  readonly title: string;
  readonly section: string;
  readonly clauseNumber: string;
  readonly version: string;
  readonly language: "ar" | "en";
  readonly pageOrSection: string;
  readonly documentId: string;
}

export interface StoredChunk {
  readonly id: string;
  readonly text: string;
  readonly vector: number[];
  readonly metadata: ChunkMetadataRecord;
}

export interface RetrievedChunk {
  readonly id: string;
  readonly text: string;
  readonly language: "ar" | "en";
  readonly score: number;
  readonly documentId: string;
  readonly source: string;
  readonly title: string;
  readonly section: string;
  readonly clauseNumber: string;
  readonly pageOrSection: string;
}

export interface VectorStorePort {
  upsert(chunks: readonly StoredChunk[]): Promise<void>;
  replaceDocument(
    documentId: string,
    chunks: readonly StoredChunk[],
    contentHash: string,
  ): Promise<void>;
  getDocumentHash(documentId: string): Promise<string | undefined>;
  queryDense(
    vector: number[],
    topK: number,
    filter?: VectorQueryFilter,
  ): Promise<readonly RetrievedChunk[]>;
  queryLexical(
    query: string,
    topK: number,
    filter?: VectorQueryFilter,
  ): Promise<readonly RetrievedChunk[]>;
  stats(): Promise<{ documents: number; chunks: number }>;
}
