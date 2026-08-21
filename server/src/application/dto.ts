import type { Locale } from "../domain/entities/contract.js";

export interface ExtractClausesInput {
  readonly contractId: string;
  readonly text: string;
  readonly languageHint?: Locale;
}

export interface AssessRiskInput {
  readonly contractId: string;
  readonly clauseIds: readonly string[];
}

export interface DraftMemoInput {
  readonly reviewId: string;
  readonly contractId: string;
  readonly language: "ar" | "en" | "both";
}

export interface ReviewJob {
  readonly id: string;
  readonly contractId: string;
  readonly status: "ingested" | "extracted" | "assessed" | "awaiting_approval" | "drafted";
}

export type IngestDocumentStatus = "ingested" | "skipped_unchanged" | "failed";

export interface IngestDocumentResult {
  readonly documentId: string;
  readonly source: string;
  readonly status: IngestDocumentStatus;
  readonly chunkCount: number;
  readonly error?: string;
}

export interface IngestCorpusResult {
  readonly documents: readonly IngestDocumentResult[];
  readonly ingested: number;
  readonly skipped: number;
  readonly failed: number;
  readonly chunks: number;
}

export interface RetrieveQuery {
  readonly text: string;
  readonly topK?: number;
  readonly language?: "ar" | "en";
  readonly documentId?: string;
}

export interface CitationHit {
  readonly source: string;
  readonly clauseNumber: string;
  readonly pageOrSection: string;
  readonly text: string;
  readonly score: number;
  readonly documentId: string;
  readonly language: "ar" | "en";
  readonly title: string;
  readonly section: string;
  readonly chunkId: string;
}

export interface RetrieveResult {
  readonly refused: boolean;
  readonly reason?: "empty_query" | "not_enough_information";
  readonly citations: readonly CitationHit[];
}
