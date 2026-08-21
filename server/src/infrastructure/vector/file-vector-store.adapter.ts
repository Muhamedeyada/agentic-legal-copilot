import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { bm25Rank } from "../../domain/retrieval/bm25.js";
import { cosineSimilarity } from "../../domain/retrieval/cosine.js";
import type {
  RetrievedChunk,
  StoredChunk,
  VectorQueryFilter,
  VectorStorePort,
} from "../../domain/ports/vector-store.port.js";

interface PersistShape {
  version: 1;
  embeddingModel: string;
  dimensions: number;
  documents: Record<string, string>;
  chunks: StoredChunk[];
}

function matchesFilter(chunk: StoredChunk, filter?: VectorQueryFilter): boolean {
  if (!filter) {
    return true;
  }
  if (filter.language !== undefined && chunk.metadata.language !== filter.language) {
    return false;
  }
  if (filter.documentId !== undefined && chunk.metadata.documentId !== filter.documentId) {
    return false;
  }
  return true;
}

function toRetrieved(chunk: StoredChunk, score: number): RetrievedChunk {
  return {
    id: chunk.id,
    text: chunk.text,
    language: chunk.metadata.language,
    score,
    documentId: chunk.metadata.documentId,
    source: chunk.metadata.source,
    title: chunk.metadata.title,
    section: chunk.metadata.section,
    clauseNumber: chunk.metadata.clauseNumber,
    pageOrSection: chunk.metadata.pageOrSection,
  };
}

/**
 * Embedded persistent vector + lexical index (JSON on disk). No Docker required.
 */
export class FileVectorStoreAdapter implements VectorStorePort {
  private chunks: StoredChunk[] = [];
  private documents: Record<string, string> = {};
  private loaded = false;

  constructor(
    private readonly filePath: string,
    private readonly embeddingModel: string,
    private readonly dimensions: number,
  ) {}

  async upsert(incoming: readonly StoredChunk[]): Promise<void> {
    await this.ensureLoaded();
    const byId = new Map(this.chunks.map((c) => [c.id, c]));
    for (const chunk of incoming) {
      this.assertDim(chunk.vector);
      byId.set(chunk.id, chunk);
    }
    this.chunks = [...byId.values()];
    await this.persist();
  }

  async replaceDocument(
    documentId: string,
    incoming: readonly StoredChunk[],
    contentHash: string,
  ): Promise<void> {
    await this.ensureLoaded();
    for (const chunk of incoming) {
      this.assertDim(chunk.vector);
    }
    this.chunks = this.chunks.filter((c) => c.metadata.documentId !== documentId);
    this.chunks.push(...incoming);
    this.documents[documentId] = contentHash;
    await this.persist();
  }

  async getDocumentHash(documentId: string): Promise<string | undefined> {
    await this.ensureLoaded();
    const hash = this.documents[documentId];
    return hash;
  }

  async queryDense(
    vector: number[],
    topK: number,
    filter?: VectorQueryFilter,
  ): Promise<readonly RetrievedChunk[]> {
    await this.ensureLoaded();
    this.assertDim(vector);
    const scored = this.chunks
      .filter((c) => matchesFilter(c, filter))
      .map((c) => toRetrieved(c, cosineSimilarity(vector, c.vector)))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  }

  async queryLexical(
    query: string,
    topK: number,
    filter?: VectorQueryFilter,
  ): Promise<readonly RetrievedChunk[]> {
    await this.ensureLoaded();
    const corpus = this.chunks.filter((c) => matchesFilter(c, filter));
    const ranked = bm25Rank(
      query,
      corpus.map((c) => ({ id: c.id, text: c.text })),
    ).slice(0, topK);
    const byId = new Map(corpus.map((c) => [c.id, c]));
    return ranked
      .map((row) => {
        const chunk = byId.get(row.id);
        return chunk ? toRetrieved(chunk, row.score) : undefined;
      })
      .filter((c): c is RetrievedChunk => c !== undefined);
  }

  async stats(): Promise<{ documents: number; chunks: number }> {
    await this.ensureLoaded();
    return { documents: Object.keys(this.documents).length, chunks: this.chunks.length };
  }

  private assertDim(vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimension ${vector.length} does not match index ${this.dimensions}. Delete data/runtime and re-ingest.`,
      );
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed.dimensions !== this.dimensions || parsed.embeddingModel !== this.embeddingModel) {
        this.chunks = [];
        this.documents = {};
      } else {
        this.chunks = parsed.chunks;
        this.documents = parsed.documents;
      }
    } catch {
      this.chunks = [];
      this.documents = {};
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload: PersistShape = {
      version: 1,
      embeddingModel: this.embeddingModel,
      dimensions: this.dimensions,
      documents: this.documents,
      chunks: this.chunks,
    };
    writeFileSync(this.filePath, JSON.stringify(payload), "utf8");
  }
}
