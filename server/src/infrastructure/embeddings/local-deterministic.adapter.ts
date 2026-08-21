import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";
import { tokenize } from "../../domain/retrieval/arabic-normalize.js";

const DIMENSIONS = 256;

/** Offline / test embeddings: hashed bag-of-tokens, L2-normalised. */
export class LocalDeterministicEmbeddingAdapter implements EmbeddingPort {
  readonly model = "local-deterministic-hash-v1";
  readonly dimensions = DIMENSIONS;

  async embed(texts: readonly string[]): Promise<readonly number[][]> {
    return texts.map((text) => hashEmbed(text));
  }
}

function hashEmbed(text: string): number[] {
  const vec = new Array<number>(DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    vec[0] = 1;
    return vec;
  }
  for (const token of tokens) {
    const i = fnv1a(token) % DIMENSIONS;
    vec[i] = (vec[i] ?? 0) + 1;
  }
  let norm = 0;
  for (const v of vec) {
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
