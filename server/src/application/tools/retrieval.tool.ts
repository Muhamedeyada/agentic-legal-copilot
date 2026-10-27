import type { PlaybookPort } from "../../domain/ports/playbook.port.js";
import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";
import { tokenOverlap } from "../../domain/retrieval/arabic-normalize.js";
import {
  RetrievalToolInputZ,
  RetrievalToolOutputZ,
} from "../agents/schemas.js";
import { HybridRanker, MIN_FUSED_SCORE } from "../retrieval/hybrid-rank.js";
import type { ToolDefinition } from "./registry.js";
import { z } from "zod";

export type RetrievalInput = z.infer<typeof RetrievalToolInputZ>;
export type RetrievalOutput = z.infer<typeof RetrievalToolOutputZ>;

/** Playbook retrieval: BM25 + dense over policy clauses, fused with RRF (k = 60). */
export function createRetrievalTool(deps: {
  playbook: PlaybookPort;
  embeddings?: EmbeddingPort;
}): ToolDefinition<RetrievalInput, RetrievalOutput> {
  const ranker = new HybridRanker(deps.embeddings);
  return {
    name: "retrieval_tool",
    inputSchema: RetrievalToolInputZ,
    outputSchema: RetrievalToolOutputZ,
    sideEffecting: false,
    async execute(input) {
      const topK = input.topK ?? 5;
      const playbook = input.category
        ? await deps.playbook.byCategory(input.category, input.language)
        : await deps.playbook.list();
      const pool = playbook.filter((c) => !input.language || c.language === input.language);
      const byId = new Map(pool.map((c) => [c.id, c]));

      const ranked = await ranker.rank(
        pool.map((c) => {
          const text = `${c.title} ${c.text}`;
          return { id: c.id, text, lexicalRelevance: tokenOverlap(input.query, text) };
        }),
        { query: input.query, minLexicalRelevance: Number.EPSILON, minDenseSimilarity: 0 },
      );

      const hits = ranked
        .filter((hit) => hit.score >= MIN_FUSED_SCORE)
        .slice(0, topK)
        .flatMap((hit) => {
          const clause = byId.get(hit.id);
          return clause
            ? [
                {
                  chunkId: clause.id,
                  text: clause.text,
                  language: clause.language,
                  score: hit.score,
                  documentId: clause.id,
                  source: "playbook" as const,
                },
              ]
            : [];
        });

      return { hits };
    },
  };
}
