import { splitClauses } from "../../domain/chunking/split-clauses.js";
import { queryCoverage } from "../../domain/retrieval/arabic-normalize.js";
import { expandBilingualQuery } from "../../domain/retrieval/bilingual-expand.js";
import { detectPromptInjection, stripInjectionPhrases } from "../../domain/security/prompt-injection.js";
import { redactPii } from "../../domain/security/pii-redact.js";
import { sanitizeModelText } from "../security/output-sanitize.js";
import type { PlaybookPort } from "../../domain/ports/playbook.port.js";

export interface IndexedChunk {
  readonly chunkId: string;
  readonly documentId: string;
  readonly source: "corpus" | "playbook";
  readonly locator: string;
  readonly text: string;
  readonly language: "ar" | "en";
}

export interface RagCitation {
  readonly chunkId: string;
  readonly documentId: string;
  readonly source: "corpus" | "playbook";
  readonly locator: string;
  readonly excerpt: string;
  readonly language: "ar" | "en";
  readonly score: number;
}

export interface RagAnswer {
  readonly answer: string;
  readonly refused: boolean;
  readonly reason?: string;
  readonly citations: readonly RagCitation[];
  readonly injectionDetected: boolean;
}

export interface CorpusRagInput {
  readonly query: string;
  readonly documentId?: string;
  readonly topK?: number;
  readonly language?: "ar" | "en";
}

const MIN_SCORE = 0.22;

export class CorpusRagUseCase {
  constructor(
    private readonly chunks: readonly IndexedChunk[],
    private readonly playbook?: PlaybookPort,
  ) {}

  async ask(input: CorpusRagInput): Promise<RagAnswer> {
    const injectionDetected = detectPromptInjection(input.query);
    let query = input.query.trim();
    if (query.length === 0) {
      return refuse("not_enough_information", injectionDetected);
    }
    if (injectionDetected) {
      query = stripInjectionPhrases(query);
      if (query.length < 8 && !input.documentId) {
        return refuse("prompt_injection_blocked", injectionDetected);
      }
    }

    const expanded = expandBilingualQuery(query);
    const pool = input.documentId
      ? this.chunks.filter((c) => c.documentId === input.documentId)
      : this.chunks;

    const scored: RagCitation[] = [];
    for (const chunk of pool) {
      const blob = `${chunk.locator} ${chunk.text} ${chunk.documentId}`;
      const lexical = Math.max(queryCoverage(query, blob), queryCoverage(expanded, blob));
      const headingBoost = 0.35 * Math.max(queryCoverage(query, chunk.locator), queryCoverage(expanded, chunk.locator));
      const score = lexical + headingBoost;
      if (score <= 0) {
        continue;
      }
      scored.push(toCitation(chunk, score));
    }

    if (this.playbook && !input.documentId) {
      const pb = await this.playbook.list();
      for (const clause of pb) {
        const score = Math.max(
          queryCoverage(query, `${clause.title} ${clause.text}`),
          queryCoverage(expanded, `${clause.title} ${clause.text}`),
        );
        if (score <= 0) {
          continue;
        }
        scored.push({
          chunkId: clause.id,
          documentId: clause.id,
          source: "playbook",
          locator: clause.title,
          excerpt: sanitizeModelText(clause.text.slice(0, 800)),
          language: clause.language,
          score,
        });
      }
    }

    const topK = input.topK ?? 5;
    const ranked = [...scored].sort((a, b) => b.score - a.score).slice(0, topK);
    const best = ranked[0];
    if (!best || best.score < MIN_SCORE) {
      return {
        answer: "",
        refused: true,
        reason: "not_enough_information",
        citations: ranked,
        injectionDetected,
      };
    }

    const lines = ranked.map(
      (c, i) => `${i + 1}. [${c.documentId} · ${c.locator}] ${c.excerpt}`,
    );
    return {
      answer: sanitizeModelText(
        `Retrieved ${ranked.length} chunk(s). Not legal advice.\n\n${lines.join("\n\n")}`,
      ),
      refused: false,
      citations: ranked,
      injectionDetected,
    };
  }
}

function toCitation(chunk: IndexedChunk, score: number): RagCitation {
  return {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    source: chunk.source,
    locator: chunk.locator,
        excerpt: sanitizeModelText(chunk.text.slice(0, 800)),
    language: chunk.language,
    score,
  };
}

function refuse(reason: string, injectionDetected: boolean): RagAnswer {
  return {
    answer: "",
    refused: true,
    reason,
    citations: [],
    injectionDetected,
  };
}

export function indexContractText(documentId: string, raw: string, language: "ar" | "en"): IndexedChunk[] {
  const redacted = redactPii(raw).text;
  return splitClauses(redacted).map((part, index) => ({
    chunkId: `${documentId}:clause:${index + 1}`,
    documentId,
    source: "corpus" as const,
    locator: part.heading || part.title,
    text: part.text,
    language: part.language === "ar" ? "ar" : language,
  }));
}
