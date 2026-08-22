import { splitClauses } from "../../domain/chunking/split-clauses.js";
import { tokenOverlap } from "../../domain/retrieval/arabic-normalize.js";
import type { ContractCatalogPort } from "../../domain/ports/contract-catalog.port.js";
import type { PlaybookPort } from "../../domain/ports/playbook.port.js";

export interface RagCitation {
  readonly chunkId: string;
  readonly documentId: string;
  readonly source: "contract" | "playbook";
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
}

export interface DirectRagInput {
  readonly query: string;
  readonly language?: "ar" | "en";
  readonly documentId?: string;
  readonly topK?: number;
}

const MIN_SCORE = 0.08;

/**
 * Direct RAG over the selected contract + playbook (keyword/overlap).
 * Application layer only — no vector SDK.
 */
export class DirectRagUseCase {
  constructor(
    private readonly catalog: ContractCatalogPort,
    private readonly playbook: PlaybookPort,
  ) {}

  async ask(input: DirectRagInput): Promise<RagAnswer> {
    const query = input.query.trim();
    if (query.length === 0) {
      return {
        answer: "",
        refused: true,
        reason: "not_enough_information",
        citations: [],
      };
    }

    const hits: RagCitation[] = [];
    const playbook = await this.playbook.list();
    for (const clause of playbook) {
      if (input.language && clause.language !== input.language) {
        continue;
      }
      const score = tokenOverlap(query, `${clause.title} ${clause.text}`);
      if (score <= 0) {
        continue;
      }
      hits.push({
        chunkId: clause.id,
        documentId: clause.id,
        source: "playbook",
        locator: clause.title,
        excerpt: clause.text.slice(0, 280),
        language: clause.language,
        score,
      });
    }

    if (input.documentId) {
      const doc = await this.catalog.get(input.documentId);
      if (doc) {
        for (const [index, part] of splitClauses(doc.text).entries()) {
          const score = tokenOverlap(query, `${part.heading} ${part.text}`);
          if (score <= 0) {
            continue;
          }
          const language = part.language === "ar" ? "ar" : "en";
          hits.push({
            chunkId: `${doc.id}:clause:${index + 1}`,
            documentId: doc.id,
            source: "contract",
            locator: part.heading || part.title,
            excerpt: part.text.slice(0, 280),
            language,
            score,
          });
        }
      }
    }

    const topK = input.topK ?? 6;
    const ranked = [...hits].sort((a, b) => b.score - a.score).slice(0, topK);
    const best = ranked[0];
    if (!best || best.score < MIN_SCORE) {
      return {
        answer: "",
        refused: true,
        reason: "not_enough_information",
        citations: ranked,
      };
    }

    const lines = ranked.map(
      (c, i) => `${i + 1}. [${c.source} · ${c.locator}] ${c.excerpt}`,
    );
    return {
      answer: `Retrieved ${ranked.length} supporting chunk(s) for the query. Use the citations; do not treat this as legal advice.\n\n${lines.join("\n\n")}`,
      refused: false,
      citations: ranked,
    };
  }
}
