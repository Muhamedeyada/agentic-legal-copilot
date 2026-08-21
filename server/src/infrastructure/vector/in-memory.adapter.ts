import { bm25Rank } from "../../domain/retrieval/bm25.js";
import { cosineSimilarity } from "../../domain/retrieval/cosine.js";
import type {
  RetrievedChunk,
  StoredChunk,
  VectorQueryFilter,
  VectorStorePort,
} from "../../domain/ports/vector-store.port.js";

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

export class InMemoryVectorStoreAdapter implements VectorStorePort {
  private chunks: StoredChunk[] = [];
  private documents = new Map<string, string>();

  async upsert(incoming: readonly StoredChunk[]): Promise<void> {
    const byId = new Map(this.chunks.map((c) => [c.id, c]));
    for (const chunk of incoming) {
      byId.set(chunk.id, chunk);
    }
    this.chunks = [...byId.values()];
  }

  async replaceDocument(
    documentId: string,
    incoming: readonly StoredChunk[],
    contentHash: string,
  ): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.metadata.documentId !== documentId);
    this.chunks.push(...incoming);
    this.documents.set(documentId, contentHash);
  }

  async getDocumentHash(documentId: string): Promise<string | undefined> {
    return this.documents.get(documentId);
  }

  async queryDense(
    vector: number[],
    topK: number,
    filter?: VectorQueryFilter,
  ): Promise<readonly RetrievedChunk[]> {
    return this.chunks
      .filter((c) => this.matches(c, filter))
      .map((c) => toRetrieved(c, cosineSimilarity(vector, c.vector)))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async queryLexical(
    query: string,
    topK: number,
    filter?: VectorQueryFilter,
  ): Promise<readonly RetrievedChunk[]> {
    const corpus = this.chunks.filter((c) => this.matches(c, filter));
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
    return { documents: this.documents.size, chunks: this.chunks.length };
  }

  private matches(chunk: StoredChunk, filter?: VectorQueryFilter): boolean {
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
}
