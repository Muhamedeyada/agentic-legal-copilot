import { z } from "zod";
import { SchemaViolationError } from "../../domain/errors.js";
import type { ReviewMemo } from "../../domain/entities/memo.js";
import type { ClauseExtractorOutput, MemoDrafterOutput, RiskAssessorOutput } from "./contracts.js";

export const LocaleZ = z.enum(["ar", "en", "mixed"]);
export const MemoLanguageZ = z.enum(["ar", "en", "both"]);
export const ClauseCategoryZ = z.enum([
  "liability",
  "indemnity",
  "ip",
  "payment",
  "termination",
  "jurisdiction",
  "confidentiality",
  "other",
]);
export const RiskSeverityZ = z.enum(["low", "medium", "high", "critical"]);

export const ExtractedClauseZ = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  category: ClauseCategoryZ,
  title: z.string(),
  text: z.string().min(1),
  language: LocaleZ,
  heading: z.string(),
  standard: z.boolean(),
  spanStart: z.number().int().nonnegative(),
  spanEnd: z.number().int().nonnegative(),
});

export const ClauseExtractorOutputZ = z.object({
  clauses: z.array(ExtractedClauseZ),
});

export const RiskFindingZ = z.object({
  id: z.string().min(1),
  clauseId: z.string().min(1),
  category: ClauseCategoryZ,
  severity: RiskSeverityZ,
  rationale: z.string().min(1),
  citationIds: z.array(z.string()),
  omitted: z.boolean(),
});

export const RiskAssessorOutputZ = z.object({
  findings: z.array(RiskFindingZ),
});

export const CitationZ = z.object({
  id: z.string().min(1),
  source: z.enum(["contract", "corpus"]),
  locator: z.string(),
  language: z.enum(["ar", "en"]),
  excerpt: z.string(),
  isTranslation: z.boolean(),
});

export const ReviewMemoZ = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  language: MemoLanguageZ,
  bodyAr: z.string().optional(),
  bodyEn: z.string().optional(),
  citations: z.array(CitationZ),
  approvedByCounsel: z.boolean(),
});

export const MemoDrafterOutputZ = z.object({
  memo: ReviewMemoZ,
});

export const RetrievalToolInputZ = z.object({
  query: z.string().min(1),
  language: z.enum(["ar", "en"]).optional(),
  category: ClauseCategoryZ.optional(),
  topK: z.number().int().positive().max(20).optional(),
});

export const RetrievalHitZ = z.object({
  chunkId: z.string(),
  text: z.string(),
  language: z.enum(["ar", "en"]),
  score: z.number(),
  documentId: z.string(),
  source: z.enum(["playbook", "vector"]),
});

export const RetrievalToolOutputZ = z.object({
  hits: z.array(RetrievalHitZ),
});

export const ClauseComparisonInputZ = z.object({
  contractClause: z.string().min(1),
  policyClause: z.string().min(1),
});

export const ClauseComparisonOutputZ = z.object({
  tokenOverlap: z.number().min(0).max(1),
  similar: z.boolean(),
  deviation: z.boolean(),
});

export const RiskFlagsZ = z.object({
  unlimitedLiability: z.boolean(),
  uncappedIndemnity: z.boolean(),
  oneDayTermination: z.boolean(),
  unilateralIp: z.boolean(),
  punitiveLateFee: z.boolean(),
});

export const RiskCalculatorInputZ = z.object({
  category: ClauseCategoryZ,
  omitted: z.boolean(),
  similarityToPlaybook: z.number().min(0).max(1),
  flags: RiskFlagsZ,
});

export const RiskCalculatorOutputZ = z.object({
  severity: RiskSeverityZ,
  reasons: z.array(z.string()).min(1),
});

export const SaveDraftMemoInputZ = z.object({
  runId: z.string().min(1),
  memo: ReviewMemoZ,
});

export const SaveDraftMemoOutputZ = z.object({
  status: z.literal("PENDING_APPROVAL"),
  memoId: z.string(),
});

export function parseContract<T>(schema: z.ZodType<T>, schemaName: string, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new SchemaViolationError(schemaName, result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

/** Drop explicit `undefined` optionals so domain types with exactOptionalPropertyTypes accept the memo. */
export function toReviewMemo(raw: z.infer<typeof ReviewMemoZ>): ReviewMemo {
  return {
    id: raw.id,
    contractId: raw.contractId,
    language: raw.language,
    citations: raw.citations,
    approvedByCounsel: raw.approvedByCounsel,
    ...(raw.bodyEn !== undefined ? { bodyEn: raw.bodyEn } : {}),
    ...(raw.bodyAr !== undefined ? { bodyAr: raw.bodyAr } : {}),
  };
}

export type { ClauseExtractorOutput, RiskAssessorOutput, MemoDrafterOutput };
