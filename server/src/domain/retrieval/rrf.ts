export interface RankedItem {
  readonly id: string;
  readonly rank: number;
}

/**
 * Reciprocal Rank Fusion. Rank is 1-based.
 * score(d) = Σ 1 / (k + rank_i(d))
 */
export function reciprocalRankFusion(
  lists: readonly (readonly RankedItem[])[],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const item of list) {
      if (item.rank < 1) {
        throw new Error("RRF ranks must be 1-based");
      }
      const add = 1 / (k + item.rank);
      scores.set(item.id, (scores.get(item.id) ?? 0) + add);
    }
  }
  return scores;
}

export function rankedFromOrder(ids: readonly string[]): RankedItem[] {
  return ids.map((id, index) => ({ id, rank: index + 1 }));
}
