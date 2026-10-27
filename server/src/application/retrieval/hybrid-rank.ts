import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";
import { bm25Rank } from "../../domain/retrieval/bm25.js";
import { cosineSimilarity } from "../../domain/retrieval/cosine.js";
import { rankedFromOrder, reciprocalRankFusion } from "../../domain/retrieval/rrf.js";

export const RRF_K = 60;
/** Candidates kept per list before fusion. */
const CANDIDATE_K = 20;
/** Bound the embedding cache; uploads keep adding new texts. */
const MAX_CACHED_EMBEDDINGS = 5_000;

/**
 * Refuse when the best fused score is below this (scores are normalised to 0..1, where 1 means
 * rank 1 in every list). RRF only sees rank order, so out-of-corpus detection comes from the
 * lexical floor: an off-topic query admits no candidates and nothing reaches this bar.
 */
export const MIN_FUSED_SCORE = 0.25;

export interface HybridCandidate {
  readonly id: string;
  /** Text that BM25 and the embedding both see. */
  readonly text: string;
  /**
   * Absolute lexical relevance in 0..1 (e.g. query-token coverage). BM25 scores are unbounded and
   * corpus-relative, so this is what decides whether a candidate may enter the lexical list at all.
   */
  readonly lexicalRelevance: number;
}

export interface HybridHit {
  readonly id: string;
  /** Normalised RRF score, 0..1. */
  readonly score: number;
  readonly lexicalRank?: number;
  readonly denseRank?: number;
}

export interface HybridRankOptions {
  /** Query as BM25 and the embedding see it (already expanded / cleaned by the caller). */
  readonly query: string;
  readonly minLexicalRelevance: number;
  readonly minDenseSimilarity: number;
}

/**
 * Lexical BM25 + dense cosine, fused with Reciprocal Rank Fusion (k = 60).
 * Raw BM25 and cosine values are never compared with each other; only their ranks are fused.
 * Without an embedding port it degrades to BM25 alone.
 *
 * The dense list re-ranks only lexically admitted candidates. The default embedding is a hashed
 * bag-of-tokens: on the golden set, off-topic queries reach the same cosine (0.22–0.31) as real ones,
 * so dense similarity alone must never let a candidate answer. A calibrated semantic embedding
 * could add dense-only recall with its own floor.
 */
export class HybridRanker {
  private readonly vectors = new Map<string, readonly number[]>();

  constructor(private readonly embeddings?: EmbeddingPort) {}

  async rank(candidates: readonly HybridCandidate[], opts: HybridRankOptions): Promise<HybridHit[]> {
    if (candidates.length === 0) {
      return [];
    }
    const admitted = new Set(
      candidates.filter((c) => c.lexicalRelevance >= opts.minLexicalRelevance).map((c) => c.id),
    );
    // IDF statistics come from the whole pool; the floor only decides who may be ranked.
    const lexical = bm25Rank(opts.query, candidates)
      .filter((row) => admitted.has(row.id))
      .slice(0, CANDIDATE_K)
      .map((row) => row.id);

    const lists = [lexical];
    let dense: string[] = [];
    if (this.embeddings) {
      const pool = candidates.filter((c) => admitted.has(c.id));
      const [queryVec, ...docVecs] = await this.embed([opts.query, ...pool.map((c) => c.text)]);
      dense = pool
        .map((c, i) => ({ id: c.id, sim: queryVec && docVecs[i] ? cosineSimilarity(queryVec, docVecs[i]) : 0 }))
        .filter((row) => row.sim >= opts.minDenseSimilarity)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, CANDIDATE_K)
        .map((row) => row.id);
      lists.push(dense);
    }

    const fused = reciprocalRankFusion(lists.map(rankedFromOrder), RRF_K);
    const best = lists.length / (RRF_K + 1);
    return [...fused.entries()]
      .map(([id, raw]) => {
        const lexicalRank = lexical.indexOf(id) + 1;
        const denseRank = dense.indexOf(id) + 1;
        return {
          id,
          score: raw / best,
          ...(lexicalRank > 0 ? { lexicalRank } : {}),
          ...(denseRank > 0 ? { denseRank } : {}),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private async embed(texts: readonly string[]): Promise<ReadonlyArray<readonly number[] | undefined>> {
    const embeddings = this.embeddings;
    if (!embeddings) {
      return [];
    }
    let missing = [...new Set(texts.filter((t) => !this.vectors.has(t)))];
    if (this.vectors.size + missing.length > MAX_CACHED_EMBEDDINGS) {
      this.vectors.clear();
      missing = [...new Set(texts)];
    }
    if (missing.length > 0) {
      const fresh = await embeddings.embed(missing);
      missing.forEach((text, i) => {
        const vec = fresh[i];
        if (vec) {
          this.vectors.set(text, vec);
        }
      });
    }
    return texts.map((t) => this.vectors.get(t));
  }
}
