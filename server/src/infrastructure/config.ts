export interface AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly host: string;
  readonly clientOrigin: string;
  readonly llmProvider: "openai" | "local";
  readonly openaiApiKey: string;
  readonly openaiBaseUrl: string;
  readonly openaiChatModel: string;
  readonly localLlmBaseUrl: string;
  readonly localLlmModel: string;
  readonly requireCounselApproval: boolean;
  readonly defaultLocale: "ar" | "en";
  readonly rateLimitPerMinute: number;
  readonly maxPromptChars: number;
  readonly maxCompletionChars: number;
  readonly maxUploadChars: number;
}

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function loadConfig(): AppConfig {
  const provider = env("LLM_PROVIDER", "openai");
  return {
    nodeEnv: env("NODE_ENV", "development"),
    port: Number(env("PORT", "3001")),
    host: env("HOST", "127.0.0.1"),
    clientOrigin: env("CLIENT_ORIGIN", "http://localhost:5173"),
    llmProvider: provider === "local" ? "local" : "openai",
    openaiApiKey: env("OPENAI_API_KEY", ""),
    openaiBaseUrl: env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    openaiChatModel: env("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
    localLlmBaseUrl: env("LOCAL_LLM_BASE_URL", "http://127.0.0.1:11434/v1"),
    localLlmModel: env("LOCAL_LLM_MODEL", "llama3.1"),
    requireCounselApproval: env("REQUIRE_COUNSEL_APPROVAL", "true") !== "false",
    defaultLocale: env("DEFAULT_LOCALE", "en") === "ar" ? "ar" : "en",
    rateLimitPerMinute: Number(env("RATE_LIMIT_PER_MINUTE", "60")),
    maxPromptChars: Number(env("MAX_PROMPT_CHARS", "12000")),
    maxCompletionChars: Number(env("MAX_COMPLETION_CHARS", "8000")),
    maxUploadChars: Number(env("MAX_UPLOAD_CHARS", "200000")),
  };
}
