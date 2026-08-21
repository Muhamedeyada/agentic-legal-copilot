import { tokenize } from "./arabic-normalize.js";

export interface Bm25Document {
  readonly id: string;
  readonly text: string;
}

const K1 = 1.2;
const B = 0.75;

export function bm25Rank(query: string, docs: readonly Bm25Document[]): Array<{ id: string; score: number }> {
  const qTokens = tokenize(query);
  if (qTokens.length === 0 || docs.length === 0) {
    return [];
  }

  const tokenized = docs.map((d) => ({ id: d.id, tokens: tokenize(d.text) }));
  const avgdl = tokenized.reduce((s, d) => s + d.tokens.length, 0) / tokenized.length;
  const df = new Map<string, number>();
  for (const d of tokenized) {
    const unique = new Set(d.tokens);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  const N = tokenized.length;
  const scored = tokenized.map((d) => {
    const tfMap = new Map<string, number>();
    for (const t of d.tokens) {
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    }
    let score = 0;
    for (const q of qTokens) {
      const tf = tfMap.get(q) ?? 0;
      if (tf === 0) {
        continue;
      }
      const n = df.get(q) ?? 0;
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
      const denom = tf + K1 * (1 - B + B * (d.tokens.length / avgdl));
      score += idf * ((tf * (K1 + 1)) / denom);
    }
    return { id: d.id, score };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}
