import { splitClauses } from "../../domain/chunking/split-clauses.js";
import { tokenOverlap } from "../../domain/retrieval/arabic-normalize.js";
import type { ContractCatalogPort } from "../../domain/ports/contract-catalog.port.js";
import type { PlaybookPort } from "../../domain/ports/playbook.port.js";
import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";
import { HybridRanker, MIN_FUSED_SCORE, type HybridCandidate } from "../retrieval/hybrid-rank.js";

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

const MIN_LEXICAL = 0.08;

export class DirectRagUseCase {
  private readonly ranker: HybridRanker;

  constructor(
    private readonly catalog: ContractCatalogPort,
    private readonly playbook: PlaybookPort,
    embeddings?: EmbeddingPort,
  ) {
    this.ranker = new HybridRanker(embeddings);
  }

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

    const candidates: Array<HybridCandidate & { citation: Omit<RagCitation, "score"> }> = [];
    const playbook = await this.playbook.list();
    for (const clause of playbook) {
      if (input.language && clause.language !== input.language) {
        continue;
      }
      const blob = `${clause.title} ${clause.text}`;
      candidates.push({
        id: clause.id,
        text: blob,
        lexicalRelevance: tokenOverlap(query, blob),
        citation: {
          chunkId: clause.id,
          documentId: clause.id,
          source: "playbook",
          locator: clause.title,
          excerpt: clause.text.slice(0, 280),
          language: clause.language,
        },
      });
    }

    if (input.documentId) {
      const doc = await this.catalog.get(input.documentId);
      if (doc) {
        for (const [index, part] of splitClauses(doc.text).entries()) {
          const blob = `${part.heading} ${part.text}`;
          const chunkId = `${doc.id}:clause:${index + 1}`;
          candidates.push({
            id: chunkId,
            text: blob,
            lexicalRelevance: tokenOverlap(query, blob),
            citation: {
              chunkId,
              documentId: doc.id,
              source: "contract",
              locator: part.heading || part.title,
              excerpt: part.text.slice(0, 280),
              language: part.language === "ar" ? "ar" : "en",
            },
          });
        }
      }
    }

    const topK = input.topK ?? 6;
    const byId = new Map(candidates.map((c) => [c.id, c.citation]));
    const hits = await this.ranker.rank(candidates, {
      query,
      minLexicalRelevance: MIN_LEXICAL,
      minDenseSimilarity: 0,
    });
    const ranked: RagCitation[] = hits.slice(0, topK).flatMap((hit) => {
      const citation = byId.get(hit.id);
      return citation ? [{ ...citation, score: hit.score }] : [];
    });
    const best = ranked[0];
    if (!best || best.score < MIN_FUSED_SCORE) {
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
