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
