import {
  requestChars,
  type CompletionPort,
  type CompletionRequest,
  type CompletionResult,
  type ToolCallRequest,
} from "../../domain/ports/completion.port.js";
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

interface MockFinding {
  readonly id: string;
  readonly clauseId: string;
  readonly category: string;
  readonly severity: string;
  readonly omitted: boolean;
}

function memoPayload(input: CompletionRequest): Record<string, unknown> {
  const newline = input.user.indexOf("\n");
  return asRecord(JSON.parse(newline < 0 ? input.user : input.user.slice(0, newline)), "memo payload");
}

/** Findings worth precedent: high/critical deviations first, then omissions; one per category, at most three. */
function precedentTargets(payload: Record<string, unknown>): MockFinding[] {
  const findings = Array.isArray(payload.findings) ? (payload.findings as MockFinding[]) : [];
  const seen = new Set<string>();
  const flagged = findings.filter((f) => f.omitted || f.severity === "high" || f.severity === "critical");
  return [...flagged.filter((f) => !f.omitted), ...flagged.filter((f) => f.omitted)]
    .filter((f) => !seen.has(f.category) && seen.add(f.category))
    .slice(0, 3);
}

function excerptsFrom(input: CompletionRequest): Map<string, string> {
  const body = unwrapUntrustedDocument(input.user);
  const parsed = body ? (JSON.parse(body) as { excerpts?: Array<{ findingId: string; text: string }> }) : {};
  return new Map((parsed.excerpts ?? []).map((e) => [e.findingId, e.text]));
}

function observations(input: CompletionRequest): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const turn of input.history ?? []) {
    if (turn.role === "tool") out.set(turn.toolCallId, JSON.parse(turn.content) as Record<string, unknown>);
  }
  return out;
}

function firstHit(observation: Record<string, unknown> | undefined): { chunkId: string; excerpt: string } | undefined {
  const hits = observation?.hits;
  return Array.isArray(hits) && hits.length > 0 ? (hits[0] as { chunkId: string; excerpt: string }) : undefined;
}

/**
 * Deterministic ReAct script: retrieve precedent for flagged findings, compare flagged clauses with the
 * top hit, then answer with the draft plus a precedent section built from the observations.
 */
function memoReact(input: CompletionRequest): { text: string; toolCalls?: ToolCallRequest[] } {
  const payload = memoPayload(input);
  const targets = precedentTargets(payload);
  const seen = observations(input);
  const language = payload.language === "ar" || payload.language === "en" ? payload.language : undefined;

  const retrievals = targets
    .map((f, i) => ({ f, id: `ret_${i}` }))
    .filter(({ id }) => !seen.has(id));
  if (retrievals.length > 0) {
    return {
      text: "",
      toolCalls: retrievals.map(({ f, id }) => ({
        id,
        name: "retrieval_tool",
        arguments: JSON.stringify({ query: `${f.category} standard clause`, category: f.category, topK: 2, ...(language ? { language } : {}) }),
      })),
    };
  }

  const excerpts = excerptsFrom(input);
  const comparisons = targets.flatMap((f, i) => {
    const hit = firstHit(seen.get(`ret_${i}`));
    const clause = excerpts.get(f.id);
    return !f.omitted && hit && clause && !seen.has(`cmp_${i}`)
      ? [{ id: `cmp_${i}`, name: "clause_comparison_tool", arguments: JSON.stringify({ contractClause: clause, policyClause: hit.excerpt }) }]
      : [];
  });
  if (comparisons.length > 0) {
    return { text: "", toolCalls: comparisons };
  }

  const en: string[] = [];
  const ar: string[] = [];
  targets.forEach((f, i) => {
    const hit = firstHit(seen.get(`ret_${i}`));
    if (!hit) return;
    const cmp = seen.get(`cmp_${i}`);
    if (cmp && typeof cmp.tokenOverlap === "number") {
      const pct = Math.round(cmp.tokenOverlap * 100);
      en.push(`- ${f.category}: ${pct}% overlap with ${hit.chunkId}${cmp.deviation === true ? " (deviates from playbook)" : ""}.`);
      ar.push(`- ${f.category}: تطابق ${pct}% مع ${hit.chunkId}${cmp.deviation === true ? " (انحراف عن دليل المراجعة)" : ""}.`);
    } else {
      en.push(`- ${f.category}: playbook precedent ${hit.chunkId}.`);
      ar.push(`- ${f.category}: سابقة من دليل المراجعة ${hit.chunkId}.`);
    }
  });

  const draft = asRecord(payload.draft, "draft");
  const contractId = stringField(payload, "contractId");
  const withSection = (body: unknown, heading: string, lines: string[]): string | undefined =>
    typeof body !== "string" ? undefined : lines.length === 0 ? body : `${body}\n\n${heading}\n${lines.join("\n")}`;
  const bodyEn = withSection(draft.bodyEn, "## Precedent check", en);
  const bodyAr = withSection(draft.bodyAr, "## مراجعة السوابق", ar);
  return {
    text: JSON.stringify({
      memo: {
        id: `${contractId}:memo`,
        contractId,
        language: payload.language === "ar" || payload.language === "both" ? payload.language : "en",
        ...(bodyEn !== undefined ? { bodyEn } : {}),
        ...(bodyAr !== undefined ? { bodyAr } : {}),
        citations: [],
        approvedByCounsel: false,
      },
    }),
  };
}

/** Single-shot fixture for callers that do not offer tools. */
function memoDraft(input: CompletionRequest): string {
  const payload = memoPayload(input);
  const draft = asRecord(payload.draft, "draft");
  const contractId = stringField(payload, "contractId");
  return JSON.stringify({
    memo: {
      id: `${contractId}:memo`,
      contractId,
      language: payload.language === "ar" || payload.language === "both" ? payload.language : "en",
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

export class MockCompletionAdapter implements CompletionPort {
  constructor(private readonly impl?: Responder) {}

  async complete(input: CompletionRequest): Promise<CompletionResult> {
    if (this.impl) {
      return this.impl(input);
    }
    if (input.jsonSchemaName === "memo_drafter_output" && (input.tools?.length ?? 0) > 0) {
      const step = memoReact(input);
      return this.result(input, step.text, step.toolCalls);
    }
    const fixture = input.jsonSchemaName ? FIXTURES[input.jsonSchemaName] : undefined;
    if (!fixture) {
      throw new Error(`MockCompletionAdapter: no fixture for schema "${input.jsonSchemaName ?? "none"}".`);
    }
    return this.result(input, fixture(input));
  }

  private result(input: CompletionRequest, text: string, toolCalls?: readonly ToolCallRequest[]): CompletionResult {
    const callChars = (toolCalls ?? []).reduce((n, c) => n + c.name.length + c.arguments.length, 0);
    return {
      text,
      providerId: "mock",
      model: "deterministic-v1",
      usage: {
        promptTokens: Math.ceil(requestChars(input) / 4),
        completionTokens: estimateTokens(text) + Math.ceil(callChars / 4),
      },
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    };
  }
}
