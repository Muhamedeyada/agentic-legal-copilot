import type { EmbeddingPort } from "../../domain/ports/embedding.port.js";
import type { AppConfig } from "../config.js";
import { LocalDeterministicEmbeddingAdapter } from "./local-deterministic.adapter.js";
import { OpenAIEmbeddingAdapter } from "./openai.adapter.js";

export function createEmbeddingAdapter(config: AppConfig): EmbeddingPort {
  if (config.embeddingProvider === "openai" && config.openaiApiKey.length > 0) {
    return new OpenAIEmbeddingAdapter({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      model: config.embeddingModel,
    });
  }
  return new LocalDeterministicEmbeddingAdapter();
}
