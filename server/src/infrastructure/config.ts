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
  readonly corpusDir: string;
  readonly rateLimitPerMinute: number;
  readonly maxPromptChars: number;
  readonly maxCompletionChars: number;
  readonly llmTimeoutMs: number;
  readonly maxUploadChars: number;
  readonly maxUploadBytes: number;
  readonly persistence: "sqlite" | "memory";
  readonly databaseUrl: string;
  readonly analystToken: string;
  readonly counselToken: string;
}

export const DEMO_ANALYST_TOKEN = "demo-analyst-token";
export const DEMO_COUNSEL_TOKEN = "demo-counsel-token";

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function authToken(
  name: string,
  demoFallback: string,
  nodeEnv: string,
): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length > 0) {
    return value;
  }
  if (nodeEnv === "production" && process.env.ALLOW_DEMO_TOKENS !== "true") {
    throw new Error(`${name} must be set when NODE_ENV=production.`);
  }
  return demoFallback;
}

export function loadConfig(): AppConfig {
  const provider = env("LLM_PROVIDER", "openai");
  const nodeEnv = env("NODE_ENV", "development");
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
  const analystToken = authToken("DEMO_API_TOKEN", DEMO_ANALYST_TOKEN, nodeEnv);
  const counselToken = authToken("COUNSEL_TOKEN", DEMO_COUNSEL_TOKEN, nodeEnv);
  if (analystToken === counselToken) {
    throw new Error("DEMO_API_TOKEN and COUNSEL_TOKEN must differ.");
  }
  const defaultDatabaseUrl =
    nodeEnv === "test" ? ":memory:" : isServerless ? "/tmp/app.db" : "";
  const defaultPersistence =
    isServerless && !process.env.DATABASE_URL ? "memory" : "sqlite";
  return {
    nodeEnv,
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
    corpusDir: env("CORPUS_DIR", ""),
    rateLimitPerMinute: Number(env("RATE_LIMIT_PER_MINUTE", "60")),
    maxPromptChars: Number(env("MAX_PROMPT_CHARS", "48000")),
    maxCompletionChars: Number(env("MAX_COMPLETION_CHARS", "32000")),
    llmTimeoutMs: Number(env("LLM_TIMEOUT_MS", "20000")),
    maxUploadChars: Number(env("MAX_UPLOAD_CHARS", "200000")),
    maxUploadBytes: Math.round(Number(env("MAX_UPLOAD_MB", "10")) * 1_048_576),
    persistence:
      env("PERSISTENCE", defaultPersistence) === "memory" ? "memory" : "sqlite",
    databaseUrl: env("DATABASE_URL", defaultDatabaseUrl),
    analystToken,
    counselToken,
  };
}
