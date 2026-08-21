import type { EmbeddingPort } from "../domain/ports/embedding.port.js";
import type { VectorStorePort } from "../domain/ports/vector-store.port.js";
import type { DocumentSourcePort } from "../domain/ports/document-source.port.js";
import type { StoredChunk } from "../domain/ports/vector-store.port.js";
import {
  DefaultClauseLevelChunker,
  type ClauseLevelChunker,
} from "../domain/chunking/clause-level-chunker.js";
import type { IngestCorpusResult, IngestDocumentResult } from "./dto.js";

export class IngestCorpusUseCase {
  private readonly chunker: ClauseLevelChunker;

  constructor(
    private readonly source: DocumentSourcePort,
    private readonly embeddings: EmbeddingPort,
    private readonly store: VectorStorePort,
    chunker?: ClauseLevelChunker,
  ) {
    this.chunker = chunker ?? new DefaultClauseLevelChunker();
  }

  async execute(): Promise<IngestCorpusResult> {
    const documents = await this.source.list();
    const results: IngestDocumentResult[] = [];

    for (const doc of documents) {
      try {
        const existing = await this.store.getDocumentHash(doc.id);
        if (existing === doc.contentHash) {
          results.push({
            documentId: doc.id,
            source: doc.source,
            status: "skipped_unchanged",
            chunkCount: 0,
          });
          continue;
        }

        const chunks = this.chunker.chunk(doc);
        if (chunks.length === 0) {
          throw new Error("No clauses produced");
        }

        const vectors = await this.embeddings.embed(chunks.map((c) => c.text));
        if (vectors.length !== chunks.length) {
          throw new Error("Embedding count mismatch");
        }

        const stored: StoredChunk[] = chunks.map((chunk, i) => ({
          id: chunk.id,
          text: chunk.text,
          vector: [...(vectors[i] ?? [])],
          metadata: {
            source: chunk.metadata.source,
            title: chunk.metadata.title,
            section: chunk.metadata.section,
            clauseNumber: chunk.metadata.clauseNumber,
            version: chunk.metadata.version,
            language: chunk.metadata.language,
            pageOrSection: chunk.metadata.pageOrSection,
            documentId: chunk.documentId,
          },
        }));

        await this.store.replaceDocument(doc.id, stored, doc.contentHash);
        results.push({
          documentId: doc.id,
          source: doc.source,
          status: "ingested",
          chunkCount: stored.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown-error";
        results.push({
          documentId: doc.id,
          source: doc.source,
          status: "failed",
          chunkCount: 0,
          error: message,
        });
      }
    }

    return {
      documents: results,
      ingested: results.filter((r) => r.status === "ingested").length,
      skipped: results.filter((r) => r.status === "skipped_unchanged").length,
      failed: results.filter((r) => r.status === "failed").length,
      chunks: results.reduce((s, r) => s + (r.status === "ingested" ? r.chunkCount : 0), 0),
    };
  }
}
