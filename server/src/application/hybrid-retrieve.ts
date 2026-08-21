import type { EmbeddingPort } from "../domain/ports/embedding.port.js";
import type { RetrievedChunk, VectorStorePort } from "../domain/ports/vector-store.port.js";
import { rankedFromOrder, reciprocalRankFusion } from "../domain/retrieval/rrf.js";
import type { CitationHit, RetrieveQuery, RetrieveResult } from "./dto.js";

const RRF_K = 60;
const DEFAULT_TOP_K = 8;
const CANDIDATE_K = 20;
/** Refuse if the fused winner is weaker than ~rank 12 on a single list. */
const MIN_RRF_SCORE = 1 / (RRF_K + 12);

export class HybridRetrieveUseCase {
  constructor(
    private readonly embeddings: EmbeddingPort,
    private readonly store: VectorStorePort,
  ) {}

  async execute(query: RetrieveQuery): Promise<RetrieveResult> {
    const text = query.text.trim();
    if (text.length === 0) {
      return { refused: true, reason: "empty_query", citations: [] };
    }

    const topK = query.topK ?? DEFAULT_TOP_K;
    const filter =
      query.language !== undefined || query.documentId !== undefined
        ? {
            ...(query.language !== undefined ? { language: query.language } : {}),
            ...(query.documentId !== undefined ? { documentId: query.documentId } : {}),
          }
        : undefined;

    const [queryVec] = await this.embeddings.embed([text]);
    if (!queryVec) {
      return { refused: true, reason: "not_enough_information", citations: [] };
    }

    const [dense, lexical] = await Promise.all([
      this.store.queryDense(queryVec, CANDIDATE_K, filter),
      this.store.queryLexical(text, CANDIDATE_K, filter),
    ]);

    const fused = reciprocalRankFusion(
      [rankedFromOrder(dense.map((c) => c.id)), rankedFromOrder(lexical.map((c) => c.id))],
      RRF_K,
    );

    const byId = new Map<string, RetrievedChunk>();
    for (const hit of [...dense, ...lexical]) {
      if (!byId.has(hit.id)) {
        byId.set(hit.id, hit);
      }
    }

    const ranked = [...fused.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => {
        const chunk = byId.get(id);
        if (!chunk) {
          return undefined;
        }
        return { chunk, score };
      })
      .filter((row): row is { chunk: RetrievedChunk; score: number } => row !== undefined);

    const best = ranked[0];
    if (!best || best.score < MIN_RRF_SCORE) {
      return { refused: true, reason: "not_enough_information", citations: [] };
    }

    const citations: CitationHit[] = ranked.slice(0, topK).map(({ chunk, score }) => ({
      source: chunk.source,
      clauseNumber: chunk.clauseNumber,
      pageOrSection: chunk.pageOrSection,
      text: chunk.text,
      score,
      documentId: chunk.documentId,
      language: chunk.language,
      title: chunk.title,
      section: chunk.section,
      chunkId: chunk.id,
    }));

    return { refused: false, citations };
  }
}
