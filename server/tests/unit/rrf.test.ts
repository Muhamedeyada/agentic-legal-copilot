import { describe, expect, it } from "vitest";
import { rankedFromOrder, reciprocalRankFusion } from "../../src/domain/retrieval/rrf.js";

describe("reciprocalRankFusion", () => {
  it("boosts items that rank highly on both dense and lexical lists", () => {
    const dense = rankedFromOrder(["a", "b", "c"]);
    const lexical = rankedFromOrder(["c", "a", "d"]);
    const fused = reciprocalRankFusion([dense, lexical], 60);

    expect(fused.get("a") ?? 0).toBeGreaterThan(fused.get("b") ?? 0);
    expect(fused.get("c") ?? 0).toBeGreaterThan(fused.get("d") ?? 0);
    expect(fused.get("a") ?? 0).toBeGreaterThan(fused.get("d") ?? 0);
  });

  it("uses 1-based ranks with k in the denominator", () => {
    const fused = reciprocalRankFusion([rankedFromOrder(["only"])], 60);
    expect(fused.get("only")).toBeCloseTo(1 / 61, 8);
  });

  it("rejects 0-based ranks", () => {
    expect(() => reciprocalRankFusion([[{ id: "x", rank: 0 }]])).toThrow(/1-based/);
  });
});
