import type { CompletionPort } from "../../domain/ports/completion.port.js";
import type { AppConfig } from "../config.js";
import { HostedCompletionAdapter } from "./hosted.adapter.js";
import { LocalCompletionAdapter } from "./local.adapter.js";
import { MockCompletionAdapter } from "./mock.adapter.js";
import { CappedCompletionAdapter } from "./capped.adapter.js";

function looksLikePlaceholderKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed.length === 0 ||
    trimmed.includes("your-openai") ||
    trimmed.includes("sk-your-") ||
    trimmed === "changeme"
  );
}

export function createCompletionAdapter(config: AppConfig): CompletionPort {
  let inner: CompletionPort;
  if (config.llmProvider === "local") {
    inner = new LocalCompletionAdapter({
      baseUrl: config.localLlmBaseUrl,
      model: config.localLlmModel,
    });
  } else if (looksLikePlaceholderKey(config.openaiApiKey)) {
    inner = new MockCompletionAdapter();
  } else {
    inner = new HostedCompletionAdapter({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      model: config.openaiChatModel,
    });
  }
  return new CappedCompletionAdapter(inner, {
    maxPromptChars: config.maxPromptChars,
    maxCompletionChars: config.maxCompletionChars,
  });
}
