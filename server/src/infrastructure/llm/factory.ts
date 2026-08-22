import type { CompletionPort } from "../../domain/ports/completion.port.js";
import type { AppConfig } from "../config.js";
import { HostedCompletionAdapter } from "./hosted.adapter.js";
import { LocalCompletionAdapter } from "./local.adapter.js";
import { MockCompletionAdapter } from "./mock.adapter.js";

export function createCompletionAdapter(config: AppConfig): CompletionPort {
  if (config.llmProvider === "local") {
    return new LocalCompletionAdapter({
      baseUrl: config.localLlmBaseUrl,
      model: config.localLlmModel,
    });
  }
  if (!config.openaiApiKey) {
    return new MockCompletionAdapter();
  }
  return new HostedCompletionAdapter({
    apiKey: config.openaiApiKey,
    baseUrl: config.openaiBaseUrl,
    model: config.openaiChatModel,
  });
}
