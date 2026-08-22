import type { PlaybookPort } from "../../domain/ports/playbook.port.js";
import type { VectorStorePort } from "../../domain/ports/vector-store.port.js";
import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";
import { tokenOverlap } from "../../domain/retrieval/arabic-normalize.js";
import {
  RetrievalToolInputZ,
  RetrievalToolOutputZ,
} from "../agents/schemas.js";
import type { ToolDefinition } from "./registry.js";
import { z } from "zod";

export type RetrievalInput = z.infer<typeof RetrievalToolInputZ>;
export type RetrievalOutput = z.infer<typeof RetrievalToolOutputZ>;

export function createRetrievalTool(deps: {
  playbook: PlaybookPort;
  vectors?: VectorStorePort;
  embeddings?: EmbeddingPort;
}): ToolDefinition<RetrievalInput, RetrievalOutput> {
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

      const lexical = playbook
        .filter((c) => !input.language || c.language === input.language)
        .map((c) => ({
          chunkId: c.id,
          text: c.text,
          language: c.language,
          score: tokenOverlap(input.query, `${c.title} ${c.text}`),
          documentId: c.id,
          source: "playbook" as const,
        }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      const vectorHits: RetrievalOutput["hits"] = [];
      if (deps.vectors && deps.embeddings) {
        try {
          const [vec] = await deps.embeddings.embed([input.query]);
          if (vec) {
            const dense = await deps.vectors.query(vec, topK);
            for (const hit of dense) {
              vectorHits.push({
                chunkId: hit.id,
                text: hit.text,
                language: hit.language,
                score: hit.score,
                documentId: hit.documentId,
                source: "vector",
              });
            }
          }
        } catch {
          // Vector store is optional; playbook lexical search remains the fallback RAG path.
        }
      }

      const merged = [...lexical, ...vectorHits]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return { hits: merged };
    },
  };
}
