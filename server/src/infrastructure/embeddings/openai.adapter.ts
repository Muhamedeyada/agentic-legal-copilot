import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

export class OpenAIEmbeddingAdapter implements EmbeddingPort {
  readonly model: string;
  readonly dimensions: number;

  constructor(
    private readonly opts: {
      apiKey: string;
      baseUrl: string;
      model: string;
      dimensions?: number;
    },
  ) {
    this.model = opts.model;
    this.dimensions = opts.dimensions ?? 1536;
  }

  async embed(texts: readonly string[]): Promise<readonly number[][]> {
    if (!this.opts.apiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }
    const out: number[][] = [];
    const batchSize = 64;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const rows = await this.embedBatch(batch);
      out.push(...rows);
    }
    return out;
  }

  private async embedBatch(batch: readonly string[]): Promise<number[][]> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/embeddings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.opts.model, input: batch }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Embedding provider HTTP ${res.status}: ${body.slice(0, 400)}`);
    }
    const json = (await res.json()) as OpenAIEmbeddingResponse;
    const ordered = [...json.data].sort((a, b) => a.index - b.index);
    return ordered.map((row) => row.embedding);
  }
}
