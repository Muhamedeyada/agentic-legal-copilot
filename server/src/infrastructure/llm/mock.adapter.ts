import type { CompletionPort, CompletionRequest, CompletionResult } from "../../domain/ports/completion.port.js";
import { estimateTokens } from "../../application/security/token-budget.js";
import { unwrapUntrustedDocument } from "../../application/security/prompt-isolation.js";
import { extractDeterministic } from "../../application/agents/clause-extractor.agent.js";

type Responder = (input: CompletionRequest) => Promise<CompletionResult> | CompletionResult;

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`MockCompletionAdapter: ${what} is not a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`MockCompletionAdapter: payload is missing "${key}".`);
  }
  return value;
}

/** Same rules the extractor falls back to, returned as a model would: `{ clauses }`. */
function clauseExtraction(input: CompletionRequest): string {
  const body = unwrapUntrustedDocument(input.user);
  if (body === undefined) {
    throw new Error("MockCompletionAdapter: contract envelope missing or truncated.");
  }
  const payload = asRecord(JSON.parse(body), "clause payload");
  const clauses = extractDeterministic({
    contractId: stringField(payload, "contractId"),
    text: stringField(payload, "text"),
  });
  return JSON.stringify({ clauses });
}

/** Returns the drafter's own deterministic draft as `{ memo }`. */
function memoDraft(input: CompletionRequest): string {
  const payload = asRecord(JSON.parse(input.user), "memo payload");
  const draft = asRecord(payload.draft, "draft");
  const contractId = stringField(payload, "contractId");
  const language = payload.language === "ar" || payload.language === "both" ? payload.language : "en";
  return JSON.stringify({
    memo: {
      id: `${contractId}:memo`,
      contractId,
      language,
      ...(typeof draft.bodyEn === "string" ? { bodyEn: draft.bodyEn } : {}),
      ...(typeof draft.bodyAr === "string" ? { bodyAr: draft.bodyAr } : {}),
      citations: [],
      approvedByCounsel: false,
    },
  });
}

const FIXTURES: Record<string, (input: CompletionRequest) => string> = {
  clause_extractor_output: clauseExtraction,
  memo_drafter_output: memoDraft,
};

/**
 * Offline completion adapter. Never calls a network LLM.
 * Answers each known schema with deterministic, schema-valid JSON and reports estimated usage
 * (~4 chars per token) so traces and the token meter behave as they would with a real provider.
 */
export class MockCompletionAdapter implements CompletionPort {
  constructor(private readonly impl?: Responder) {}

  async complete(input: CompletionRequest): Promise<CompletionResult> {
    if (this.impl) {
      return this.impl(input);
    }
    const fixture = input.jsonSchemaName ? FIXTURES[input.jsonSchemaName] : undefined;
    if (!fixture) {
      throw new Error(`MockCompletionAdapter: no fixture for schema "${input.jsonSchemaName ?? "none"}".`);
    }
    const text = fixture(input);
    return {
      text,
      providerId: "mock",
      model: "deterministic-v1",
      usage: {
        promptTokens: estimateTokens(input.system + input.user),
        completionTokens: estimateTokens(text),
      },
    };
  }
}
