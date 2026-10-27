import { describe, expect, it } from "vitest";
import { bm25Rank } from "../../src/domain/retrieval/bm25.js";
import { HybridRanker, MIN_FUSED_SCORE } from "../../src/application/retrieval/hybrid-rank.js";
import { DirectRagUseCase } from "../../src/application/chat/direct-rag.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { LocalDeterministicEmbeddingAdapter } from "../../src/infrastructure/embeddings/local-deterministic.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryApprovalAdapter } from "../../src/infrastructure/approval/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import type { ContractCatalogPort, ContractRecord } from "../../src/domain/ports/contract-catalog.port.js";
import type { EmbeddingPort } from "../../src/domain/ports/embedding.port.js";

const embeddings = new LocalDeterministicEmbeddingAdapter();

describe("LocalDeterministicEmbeddingAdapter", () => {
  it("returns stable, L2-normalised 256-dim vectors", async () => {
    const [a, b] = await embeddings.embed(["liability cap", "liability cap"]);
    expect(a).toHaveLength(256);
    expect(a).toEqual(b);
    expect(Math.hypot(...(a ?? []))).toBeCloseTo(1, 10);
  });
});

describe("bm25Rank", () => {
  it("ranks the document holding the rarer query term first", () => {
    const ranked = bm25Rank("governing law delaware", [
      { id: "a", text: "This agreement is governed by the law of England." },
      { id: "b", text: "Governing law: the laws of Delaware apply." },
      { id: "c", text: "Payment is due within thirty days." },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("HybridRanker", () => {
  const candidates = [
    { id: "cap", text: "Liability is capped at twelve months of fees.", lexicalRelevance: 0.6 },
    { id: "notice", text: "Thirty days written notice of termination.", lexicalRelevance: 0.3 },
    { id: "off", text: "Liability capped fees months twelve.", lexicalRelevance: 0 },
  ];

  it("normalises fused scores so rank 1 on every list scores 1", async () => {
    const hits = await new HybridRanker(embeddings).rank(candidates, {
      query: "liability cap twelve months fees",
      minLexicalRelevance: 0.1,
      minDenseSimilarity: 0,
    });
    expect(hits[0]).toMatchObject({ id: "cap", score: 1, lexicalRank: 1, denseRank: 1 });
    for (const hit of hits) {
      expect(hit.score).toBeGreaterThan(0);
      expect(hit.score).toBeLessThanOrEqual(1);
    }
  });

  it("never lets a candidate below the lexical floor in through the dense list", async () => {
    const hits = await new HybridRanker(embeddings).rank(candidates, {
      query: "liability cap twelve months fees",
      minLexicalRelevance: 0.1,
      minDenseSimilarity: 0,
    });
    expect(hits.map((h) => h.id)).not.toContain("off");
  });

  it("returns nothing for an off-topic query, so callers refuse", async () => {
    const hits = await new HybridRanker(embeddings).rank(
      candidates.map((c) => ({ ...c, lexicalRelevance: 0 })),
      { query: "pediatric amoxicillin dosage", minLexicalRelevance: 0.1, minDenseSimilarity: 0 },
    );
    expect(hits).toEqual([]);
  });

  it("embeds each distinct text once across queries", async () => {
    let embedded = 0;
    const counting: EmbeddingPort = {
      model: "counting",
      async embed(texts) {
        embedded += texts.length;
        return embeddings.embed(texts);
      },
    };
    const ranker = new HybridRanker(counting);
    const opts = { query: "liability fees", minLexicalRelevance: 0.1, minDenseSimilarity: 0 };
    await ranker.rank(candidates, opts);
    await ranker.rank(candidates, opts);
    expect(embedded).toBe(3);
  });
});

const ARABIC_CONTRACT: ContractRecord = {
  id: "D1T1-AR-TEST",
  title: "اتفاق",
  language: "ar",
  source: "upload",
  text: [
    "## 1. بند المسؤولية",
    "تُحد مسؤولية مقدم الخدمة بما يعادل أتعاب اثني عشر شهراً.",
    "## 2. القانون الحاكم",
    "يخضع هذا الاتفاق لقوانين إنجلترا وويلز.",
  ].join("\n"),
};

const catalog: ContractCatalogPort = {
  async list() {
    return [];
  },
  async get(id) {
    return id === ARABIC_CONTRACT.id ? ARABIC_CONTRACT : undefined;
  },
  async saveUpload() {
    throw new Error("unused");
  },
};

describe("DirectRagUseCase (hybrid)", () => {
  const rag = new DirectRagUseCase(catalog, new InMemoryPlaybookAdapter(), embeddings);

  it("answers with fused 0..1 scores", async () => {
    const result = await rag.ask({ query: "liability cap twelve months fees", language: "en" });
    expect(result.refused).toBe(false);
    expect(result.citations[0]?.chunkId).toBe("playbook:en:liability");
    expect(result.citations[0]?.score).toBeGreaterThanOrEqual(MIN_FUSED_SCORE);
    expect(result.citations[0]?.score).toBeLessThanOrEqual(1);
  });

  it("finds the clause inside an Arabic contract", async () => {
    const result = await rag.ask({ query: "القانون الحاكم", documentId: ARABIC_CONTRACT.id });
    expect(result.refused).toBe(false);
    expect(result.citations[0]?.chunkId).toBe(`${ARABIC_CONTRACT.id}:clause:2`);
  });

  it("refuses out-of-corpus questions", async () => {
    const result = await rag.ask({ query: "pediatric amoxicillin dosage for otitis media" });
    expect(result.refused).toBe(true);
    expect(result.reason).toBe("not_enough_information");
  });
});

describe("memo citations", () => {
  it("quote the playbook clause text instead of a placeholder", async () => {
    const playbook = new InMemoryPlaybookAdapter();
    const orchestrator = new LegalWorkflowOrchestrator({
      completion: new MockCompletionAdapter(),
      playbook,
      approval: new InMemoryApprovalAdapter(),
      runs: new InMemoryRunStoreAdapter(),
      embeddings,
      requireCounselApproval: true,
      maxRetries: 0,
    });
    const run = await orchestrator.start({
      contractId: "cite",
      text: "## 1. Liability\nThe Supplier's liability is unlimited and not subject to any cap.",
      language: "en",
    });
    const citations = run.memo?.citations ?? [];
    expect(citations.length).toBeGreaterThan(0);
    expect(new Set(citations.map((c) => c.id)).size).toBe(citations.length);

    const policy = new Map((await playbook.list()).map((c) => [c.id, c]));
    for (const citation of citations) {
      expect(citation.excerpt).not.toMatch(/Playbook\/precedent chunk/);
      const clause = policy.get(citation.id);
      expect(clause).toBeDefined();
      expect(clause?.text.startsWith(citation.excerpt)).toBe(true);
      expect(citation.locator).toBe(clause?.title);
      expect(citation.language).toBe(clause?.language);
    }
  });
});
