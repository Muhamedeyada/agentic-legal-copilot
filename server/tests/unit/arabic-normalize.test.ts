import { describe, expect, it } from "vitest";
import { normalizeArabic, tokenize } from "../../src/domain/retrieval/arabic-normalize.js";

describe("normalizeArabic", () => {
  it("strips tashkeel and unifies alef / ya / ta marbuta", () => {
    expect(normalizeArabic("إِنْهَاء")).toBe("انهاء");
    expect(normalizeArabic("أسرار")).toBe("اسرار");
    expect(normalizeArabic("مسؤولية")).toBe("مسؤوليه");
    expect(normalizeArabic("على")).toBe("علي");
  });

  it("tokenizes mixed AR/EN after normalisation", () => {
    const tokens = tokenize("Termination إنهاء العقد");
    expect(tokens).toContain("termination");
    expect(tokens).toContain("انهاء");
    expect(tokens).toContain("العقد");
  });
});
