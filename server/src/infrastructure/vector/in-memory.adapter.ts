import type { RetrievedChunk, VectorStorePort } from "../../domain/ports/vector-store.port.js";

export class InMemoryVectorStoreAdapter implements VectorStorePort {
  async upsert(): Promise<void> {
    throw new Error("Vector store adapter is a scaffold stub — not connected yet.");
  }

  async query(_vector: number[], _topK: number): Promise<readonly RetrievedChunk[]> {
    void _vector;
    void _topK;
    throw new Error("Vector store adapter is a scaffold stub — not connected yet.");
  }
}
