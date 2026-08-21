import { describe, expect, it } from "vitest";
import { DefaultClauseLevelChunker } from "../../src/domain/chunking/clause-level-chunker.js";
import type { LegalDocument } from "../../src/domain/entities/document.js";

const chunker = new DefaultClauseLevelChunker();

function doc(id: string, language: "ar" | "en", text: string): LegalDocument {
  return {
    id,
    title: id,
    language,
    version: "1.0",
    source: `${id}.md`,
    text,
    contentHash: "x",
  };
}

describe("DefaultClauseLevelChunker", () => {
  it("splits English contracts on numbered article headings", () => {
    const text = `---
document_id: t
language: en
version: 1.0
---

# Sample NDA

Preamble parties agree.

## 5. Confidentiality

Keep secrets for three years.

## 8. Liability and Indemnification

Liability is capped at twelve months of fees.
`;
    const chunks = chunker.chunk(doc("EN-1", "en", text));
    const numbers = chunks.map((c) => c.metadata.clauseNumber);
    expect(numbers).toContain("5");
    expect(numbers).toContain("8");
    const conf = chunks.find((c) => c.metadata.clauseNumber === "5");
    expect(conf?.text).toMatch(/Keep secrets/);
    expect(conf?.metadata.section).toMatch(/Confidentiality/);
    expect(conf?.metadata.language).toBe("en");
    expect(conf?.metadata.pageOrSection).toBe("§5");
  });

  it("splits Arabic contracts on بند-style numbered headings", () => {
    const text = `# عقد

مقدمة.

## 5. السرية

يجب المحافظة على السرية.

## 7. مدة العقد والإنهاء والإخطار

يجوز الإنهاء بإخطار.
`;
    const chunks = chunker.chunk(doc("AR-1", "ar", text));
    const secrecy = chunks.find((c) => c.metadata.clauseNumber === "5");
    expect(secrecy?.metadata.section).toContain("السرية");
    expect(secrecy?.text).toContain("المحافظة");
    expect(chunks.some((c) => c.metadata.clauseNumber === "7")).toBe(true);
  });
});
