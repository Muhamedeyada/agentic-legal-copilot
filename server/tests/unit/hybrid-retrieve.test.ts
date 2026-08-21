import { describe, expect, it } from "vitest";
import { DefaultClauseLevelChunker } from "../../src/domain/chunking/clause-level-chunker.js";
import type { LegalDocument } from "../../src/domain/entities/document.js";
import { HybridRetrieveUseCase } from "../../src/application/hybrid-retrieve.js";
import { IngestCorpusUseCase } from "../../src/application/ingest-corpus.js";
import type { DocumentSourcePort } from "../../src/domain/ports/document-source.port.js";
import { LocalDeterministicEmbeddingAdapter } from "../../src/infrastructure/embeddings/local-deterministic.adapter.js";
import { InMemoryVectorStoreAdapter } from "../../src/infrastructure/vector/in-memory.adapter.js";

const sample: LegalDocument = {
  id: "D1T1-EN-NDA-TEST",
  title: "Mutual NDA",
  language: "en",
  version: "1.0",
  source: "test.md",
  contentHash: "hash-1",
  text: `## 5. Confidentiality

The receiving party shall keep confidential all non-public pricing models.

## 8. Liability and Indemnification

Each party's aggregate liability is limited to twelve months of fees.
`,
};

class MemorySource implements DocumentSourcePort {
  constructor(private readonly docs: LegalDocument[]) {}
  async list(): Promise<readonly LegalDocument[]> {
    return this.docs;
  }
}

describe("ingest + hybrid retrieve", () => {
  it("returns cited chunks for an in-corpus query and refuses out-of-corpus questions", async () => {
    const embeddings = new LocalDeterministicEmbeddingAdapter();
    const store = new InMemoryVectorStoreAdapter();
    const ingest = new IngestCorpusUseCase(new MemorySource([sample]), embeddings, store, new DefaultClauseLevelChunker());
    const ingestResult = await ingest.execute();
    expect(ingestResult.failed).toBe(0);
    expect(ingestResult.chunks).toBeGreaterThan(0);

    const skip = await ingest.execute();
    expect(skip.skipped).toBe(1);

    const retrieve = new HybridRetrieveUseCase(embeddings, store);
    const hit = await retrieve.execute({ text: "confidential pricing models" });
    expect(hit.refused).toBe(false);
    expect(hit.citations[0]?.clauseNumber).toBe("5");
    expect(hit.citations[0]?.source).toBe("test.md");
    expect(hit.citations[0]?.pageOrSection).toBe("§5");

    const miss = await retrieve.execute({ text: "what is the dosage of amoxicillin for a child" });
    expect(miss.refused).toBe(true);
    expect(miss.reason).toBe("not_enough_information");
  });
});
