export type DocumentLanguage = "ar" | "en";

export interface ChunkMetadata {
  readonly source: string;
  readonly title: string;
  readonly section: string;
  readonly clauseNumber: string;
  readonly version: string;
  readonly language: DocumentLanguage;
  readonly pageOrSection: string;
}

export interface LegalDocument {
  readonly id: string;
  readonly title: string;
  readonly language: DocumentLanguage;
  readonly version: string;
  readonly source: string;
  readonly text: string;
  readonly contentHash: string;
}

export interface Chunk {
  readonly id: string;
  readonly documentId: string;
  readonly text: string;
  readonly metadata: ChunkMetadata;
}
