import { describe, expect, it } from "vitest";
import { HostedCompletionAdapter } from "../../src/infrastructure/llm/hosted.adapter.js";
import { LocalCompletionAdapter } from "../../src/infrastructure/llm/local.adapter.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import { CappedCompletionAdapter } from "../../src/infrastructure/llm/capped.adapter.js";
import { InMemoryApprovalAdapter } from "../../src/infrastructure/approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { RunEventBus } from "../../src/application/orchestration/event-bus.js";
import type { WorkflowStreamEvent } from "../../src/application/orchestration/events.js";
import { ClauseExtractorOutputZ } from "../../src/application/agents/schemas.js";
import { wrapUntrustedDocument } from "../../src/application/security/prompt-isolation.js";
import { TokenBudgetExceededError } from "../../src/application/security/token-budget.js";
import type { CompletionPort } from "../../src/domain/ports/completion.port.js";

const CONTRACT = [
  "## 1. Liability",
  "Liability is capped at twelve months of fees.",
  "## 2. Termination",
  "Either party may terminate on thirty (30) days written notice.",
  "## 3. Governing law",
  "This agreement is governed by England and Wales.",
  "## 4. Indemnity",
  "Each party shall indemnify the other, capped at the liability cap.",
].join("\n");

interface Captured {
  url: string;
  init: RequestInit;
}

function fakeFetch(responses: Array<() => Response>, calls: Captured[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) {
      throw new Error("unexpected extra request");
    }
    return next();
  }) as typeof fetch;
}

function okCompletion(content: string, usage?: { prompt_tokens: number; completion_tokens: number }): Response {
  return new Response(
    JSON.stringify({ model: "gpt-test", choices: [{ message: { content } }], ...(usage ? { usage } : {}) }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const REQUEST = { system: "Return JSON.", user: "{}", jsonSchemaName: "clause_extractor_output" };

describe("HostedCompletionAdapter", () => {
  it("posts an OpenAI chat completion in JSON mode and reports provider usage", async () => {
    const calls: Captured[] = [];
    const adapter = new HostedCompletionAdapter({
      apiKey: "sk-test",
      baseUrl: "https://llm.example/v1/",
      model: "gpt-test",
      timeoutMs: 1_000,
      maxTokens: 500,
      fetchImpl: fakeFetch([() => okCompletion('{"clauses":[]}', { prompt_tokens: 42, completion_tokens: 7 })], calls),
    });

    const result = await adapter.complete(REQUEST);

    expect(calls[0]?.url).toBe("https://llm.example/v1/chat/completions");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBe(500);
    expect(result).toMatchObject({
      text: '{"clauses":[]}',
      providerId: "openai",
      model: "gpt-test",
      usage: { promptTokens: 42, completionTokens: 7 },
    });
  });

  it("retries once on 503 and honours Retry-After", async () => {
    const calls: Captured[] = [];
    const adapter = new HostedCompletionAdapter({
      apiKey: "sk-test",
      baseUrl: "https://llm.example/v1",
      model: "gpt-test",
      timeoutMs: 1_000,
      fetchImpl: fakeFetch(
        [
          () => new Response("overloaded", { status: 503, headers: { "Retry-After": "0" } }),
          () => okCompletion("{}", { prompt_tokens: 1, completion_tokens: 1 }),
        ],
        calls,
      ),
    });
    await expect(adapter.complete(REQUEST)).resolves.toMatchObject({ text: "{}" });
    expect(calls).toHaveLength(2);
  });

  it("fails fast on 401 without echoing the key", async () => {
    const calls: Captured[] = [];
    const adapter = new HostedCompletionAdapter({
      apiKey: "sk-secret-value",
      baseUrl: "https://llm.example/v1",
      model: "gpt-test",
      timeoutMs: 1_000,
      fetchImpl: fakeFetch([() => new Response("bad key", { status: 401 })], calls),
    });
    const err = await adapter.complete(REQUEST).catch((e: unknown) => e as Error);
    expect(err.message).toContain("HTTP 401");
    expect(err.message).not.toContain("sk-secret-value");
    expect(calls).toHaveLength(1);
  });

  it("estimates usage when the provider omits it", async () => {
    const adapter = new HostedCompletionAdapter({
      apiKey: "sk-test",
      baseUrl: "https://llm.example/v1",
      model: "gpt-test",
      timeoutMs: 1_000,
      fetchImpl: fakeFetch([() => okCompletion('{"ok":true}')], []),
    });
    const result = await adapter.complete(REQUEST);
    expect(result.usage?.promptTokens).toBeGreaterThan(0);
    expect(result.usage?.completionTokens).toBeGreaterThan(0);
  });
});

describe("LocalCompletionAdapter", () => {
  it("calls the local endpoint without an Authorization header", async () => {
    const calls: Captured[] = [];
    const adapter = new LocalCompletionAdapter({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama3.1",
      timeoutMs: 1_000,
      fetchImpl: fakeFetch([() => okCompletion("{}", { prompt_tokens: 3, completion_tokens: 2 })], calls),
    });
    const result = await adapter.complete(REQUEST);
    expect(calls[0]?.url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(result.providerId).toBe("local");
  });
});

describe("MockCompletionAdapter", () => {
  it("answers the extractor schema with valid clauses and non-zero usage", async () => {
    const result = await new MockCompletionAdapter().complete({
      system: "Extract clauses.",
      jsonSchemaName: "clause_extractor_output",
      user: wrapUntrustedDocument("c-1", JSON.stringify({ contractId: "c-1", text: CONTRACT, hint: [] })),
    });
    const parsed = ClauseExtractorOutputZ.parse(JSON.parse(result.text));
    expect(parsed.clauses.map((c) => c.category)).toEqual(["liability", "termination", "jurisdiction", "indemnity"]);
    expect(result.usage?.promptTokens).toBeGreaterThan(0);
    expect(result.usage?.completionTokens).toBeGreaterThan(0);
  });
});

describe("CappedCompletionAdapter", () => {
  const silent: CompletionPort = {
    async complete() {
      return { text: '{"a":1}', providerId: "x", model: "x" };
    },
  };

  it("refuses an oversize prompt before calling the provider", async () => {
    let called = false;
    const capped = new CappedCompletionAdapter(
      {
        async complete() {
          called = true;
          return { text: "{}", providerId: "x", model: "x" };
        },
      },
      { maxPromptChars: 10, maxCompletionChars: 100 },
    );
    await expect(capped.complete({ system: "s", user: "x".repeat(50) })).rejects.toBeInstanceOf(
      TokenBudgetExceededError,
    );
    expect(called).toBe(false);
  });

  it("fills in estimated usage when the inner adapter reports none", async () => {
    const capped = new CappedCompletionAdapter(silent, { maxPromptChars: 1_000, maxCompletionChars: 100 });
    const result = await capped.complete({ system: "system", user: "user text" });
    expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 2 });
  });
});

describe("token accounting through the orchestrator", () => {
  it("records per-agent usage on traces, the run total, and AGENT_DONE events", async () => {
    const events = new RunEventBus();
    const seen: WorkflowStreamEvent[] = [];
    const orchestrator = new LegalWorkflowOrchestrator({
      completion: new MockCompletionAdapter(),
      playbook: new InMemoryPlaybookAdapter(),
      approval: new InMemoryApprovalAdapter(),
      runs: new InMemoryRunStoreAdapter(),
      events,
      requireCounselApproval: true,
      maxRetries: 0,
    });
    const original = events.publish.bind(events);
    events.publish = (event) => {
      seen.push(event);
      original(event);
    };

    const run = await orchestrator.start({ contractId: "tok", text: CONTRACT, language: "en" });

    const agentTraces = run.traces.filter((t) => t.agentId && !t.toolName);
    expect(agentTraces.map((t) => t.agentId)).toEqual(["clause_extractor", "risk_assessor", "memo_drafter"]);
    for (const trace of agentTraces) {
      expect((trace.tokenUsage?.promptTokens ?? 0) + (trace.tokenUsage?.completionTokens ?? 0)).toBeGreaterThan(0);
    }
    const sum = agentTraces.reduce(
      (acc, t) => acc + (t.tokenUsage?.promptTokens ?? 0) + (t.tokenUsage?.completionTokens ?? 0),
      0,
    );
    expect(run.tokenUsage.promptTokens + run.tokenUsage.completionTokens).toBe(sum);
    expect(agentTraces[0]?.output).toMatchObject({ usedLlm: true, provider: "mock" });

    const done = seen.filter((e) => e.type === "AGENT_DONE");
    expect(done).toHaveLength(3);
    const last = done.at(-1);
    expect(last?.type === "AGENT_DONE" ? last.totalTokenUsage : undefined).toEqual(run.tokenUsage);
  });
});
