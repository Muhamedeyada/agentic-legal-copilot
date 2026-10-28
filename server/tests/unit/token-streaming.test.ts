import { describe, expect, it } from "vitest";
import { JsonStringFieldStream } from "../../src/application/agents/json-field-stream.js";
import { MemoDrafterAgent, type MemoDrafterInput } from "../../src/application/agents/memo-drafter.agent.js";
import { ToolRegistry, type ToolContext } from "../../src/application/tools/registry.js";
import { createRetrievalTool } from "../../src/application/tools/retrieval.tool.js";
import { createClauseComparisonTool } from "../../src/application/tools/clause-comparison.tool.js";
import { SaveDraftMemoInputZ, SaveDraftMemoOutputZ } from "../../src/application/agents/schemas.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { RunEventBus } from "../../src/application/orchestration/event-bus.js";
import type { WorkflowStreamEvent } from "../../src/application/orchestration/events.js";
import { HostedCompletionAdapter } from "../../src/infrastructure/llm/hosted.adapter.js";
import { CappedCompletionAdapter } from "../../src/infrastructure/llm/capped.adapter.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import { InMemoryApprovalAdapter } from "../../src/infrastructure/approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";
import type { CompletionRequest, CompletionResult } from "../../src/domain/ports/completion.port.js";

type TokenChunk = Extract<WorkflowStreamEvent, { type: "TOKEN_CHUNK" }>;

function collect(fields: readonly ("bodyEn" | "bodyAr")[], chunks: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const parser = new JsonStringFieldStream(fields, (field, text) => {
    out[field] = (out[field] ?? "") + text;
  });
  for (const chunk of chunks) parser.push(chunk);
  return out;
}

describe("JsonStringFieldStream", () => {
  const memo = {
    memo: {
      id: "c:memo",
      citations: [{ id: "bodyEn", excerpt: "not a key \"bodyEn\": \"nope\"" }],
      bodyEn: '# Memo\n\n- "Cap" liability\t\\ 12 months 😀 / done',
      bodyAr: "# مذكرة\nسقف المسؤولية — ١٢ شهراً",
    },
  };
  const json = JSON.stringify(memo);
  const escaped = JSON.stringify(memo, null, 0).replace(/😀/g, "\\ud83d\\ude00").replace(/—/g, "\\u2014");

  it.each([
    ["whole document", [json]],
    ["one character at a time", [...json]],
    ["unicode escapes split mid-sequence", escaped.match(/[\s\S]{1,3}/g) ?? []],
  ])("emits only the selected decoded values (%s)", (_label, chunks) => {
    expect(collect(["bodyEn", "bodyAr"], chunks)).toEqual({ bodyEn: memo.memo.bodyEn, bodyAr: memo.memo.bodyAr });
  });

  it("ignores fields it was not asked for and prose around the JSON", () => {
    expect(collect(["bodyAr"], [`Here you go:\n${json}`])).toEqual({ bodyAr: memo.memo.bodyAr });
  });
});

describe("OpenAI-compatible streaming", () => {
  function sseResponse(parts: string[]): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }

  function adapter(responses: Array<() => Response>, bodies: Record<string, unknown>[]): HostedCompletionAdapter {
    return new HostedCompletionAdapter({
      apiKey: "sk-test",
      baseUrl: "https://llm.example/v1",
      model: "gpt-test",
      timeoutMs: 1_000,
      fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        const next = responses.shift();
        if (!next) throw new Error("unexpected extra request");
        return next();
      }) as typeof fetch,
    });
  }

  const chunk = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}): string =>
    `data: ${JSON.stringify({ model: "gpt-test", choices: [{ index: 0, delta }], ...extra })}\n\n`;

  it("requests a stream, forwards content deltas, and stitches tool-call fragments", async () => {
    const bodies: Record<string, unknown>[] = [];
    const deltas: string[] = [];
    const lines = [
      chunk({ role: "assistant", content: "" }),
      chunk({ content: '{"memo":' }),
      chunk({ content: '{"bodyEn":"Hi"}}' }),
      chunk({ tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "retrieval_tool", arguments: "" } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '"cap"}' } }] }),
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7 } })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");
    // Split mid-line and mid-JSON to exercise buffering.
    const parts = lines.match(/[\s\S]{1,17}/g) ?? [];

    const result = await adapter([() => sseResponse(parts)], bodies).complete({
      system: "s",
      user: "u",
      onTextDelta: (d) => deltas.push(d),
    });

    expect(bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(deltas).toEqual(['{"memo":', '{"bodyEn":"Hi"}}']);
    expect(result).toMatchObject({
      text: '{"memo":{"bodyEn":"Hi"}}',
      toolCalls: [{ id: "call_1", name: "retrieval_tool", arguments: '{"query":"cap"}' }],
      usage: { promptTokens: 11, completionTokens: 7 },
    });
  });

  it("does not stream unless the caller asks for it", async () => {
    const bodies: Record<string, unknown>[] = [];
    const json = () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    await adapter([json], bodies).complete({ system: "s", user: "u" });
    expect(bodies[0]?.stream).toBeUndefined();
  });

  it("still reports text once when the server ignores stream: true", async () => {
    const deltas: string[] = [];
    const json = () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const result = await adapter([json], []).complete({ system: "s", user: "u", onTextDelta: (d) => deltas.push(d) });
    expect(deltas).toEqual(['{"a":1}']);
    expect(result.text).toBe('{"a":1}');
  });

  it("fails without retrying when the stream breaks after text was forwarded", async () => {
    const bodies: Record<string, unknown>[] = [];
    const broken = () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(chunk({ content: "partial" })));
          controller.error(new Error("socket hang up"));
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };
    await expect(
      adapter([broken, broken], bodies).complete({ system: "s", user: "u", onTextDelta: () => undefined }),
    ).rejects.toThrow(/stream interrupted/);
    expect(bodies).toHaveLength(1);
  });

  it("surfaces provider error chunks", async () => {
    const errored = () => sseResponse([`data: ${JSON.stringify({ error: { message: "overloaded" } })}\n\n`]);
    await expect(adapter([errored], []).complete({ system: "s", user: "u", onTextDelta: () => undefined })).rejects.toThrow(
      /stream error — overloaded/,
    );
  });

  it("stops streamed text at the completion cap", async () => {
    const deltas: string[] = [];
    const inner = new MockCompletionAdapter(async (input): Promise<CompletionResult> => {
      for (const piece of ["abcd", "efgh", "ijkl"]) input.onTextDelta?.(piece);
      return { text: "abcdefghijkl", providerId: "x", model: "x" };
    });
    const capped = new CappedCompletionAdapter(inner, { maxPromptChars: 1_000, maxCompletionChars: 6 });
    await capped.complete({ system: "s", user: "u", onTextDelta: (d) => deltas.push(d) });
    expect(deltas.join("")).toBe("abcdef");
  });
});

describe("TOKEN_CHUNK events", () => {
  it("stream the memo body through the event bus and match the final memo", async () => {
    const events = new RunEventBus();
    const live: TokenChunk[] = [];
    const original = events.publish.bind(events);
    events.publish = (event) => {
      if (event.type === "TOKEN_CHUNK") live.push(event);
      original(event);
    };
    const orchestrator = new LegalWorkflowOrchestrator({
      completion: new MockCompletionAdapter(),
      playbook: new InMemoryPlaybookAdapter(),
      approval: new InMemoryApprovalAdapter(),
      runs: new InMemoryRunStoreAdapter(),
      events,
      requireCounselApproval: true,
      maxRetries: 0,
    });

    const run = await orchestrator.start({
      contractId: "stream",
      text: "## 1. Liability\nThe Supplier's liability is unlimited and not subject to any cap.",
      language: "en",
    });

    expect(live.length).toBeGreaterThan(10);
    expect(live.every((e) => e.runId === run.runId && e.agentId === "memo_drafter" && e.field === "bodyEn")).toBe(true);
    expect(live.map((e) => e.deltaText).join("")).toBe(run.memo?.bodyEn);

    const history = events.historyFor(run.runId);
    const chunks = history.filter((e): e is TokenChunk => e.type === "TOKEN_CHUNK");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.deltaText).toBe(run.memo?.bodyEn);
    const order = history.map((e) => e.type);
    expect(order.indexOf("TOKEN_CHUNK")).toBeLessThan(order.indexOf("AWAITING_APPROVAL"));
    expect(order.filter((t) => t === "CLAUSE_EXTRACTED").length).toBeGreaterThan(0);
  });
});

describe("live memo resets", () => {
  const CTX: ToolContext = { runId: "r", agentId: "memo_drafter", state: "DRAFTING" };
  const INPUT: MemoDrafterInput = { runId: "r", contractId: "c", language: "en", clauses: [], findings: [] };

  function tools(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(createRetrievalTool({ playbook: new InMemoryPlaybookAdapter() }));
    registry.register(createClauseComparisonTool());
    registry.register({
      name: "save_draft_memo_tool",
      inputSchema: SaveDraftMemoInputZ,
      outputSchema: SaveDraftMemoOutputZ,
      sideEffecting: true,
      execute: async (input) => ({ status: "PENDING_APPROVAL" as const, memoId: input.memo.id }),
    });
    return registry;
  }

  function streaming(turns: Array<{ text: string; tools?: boolean }>): MockCompletionAdapter {
    let i = 0;
    return new MockCompletionAdapter(async (input: CompletionRequest): Promise<CompletionResult> => {
      const turn = turns[Math.min(i, turns.length - 1)]!;
      i += 1;
      for (const piece of turn.text.match(/[\s\S]{1,5}/g) ?? []) input.onTextDelta?.(piece);
      return {
        text: turn.text,
        providerId: "s",
        model: "s",
        ...(turn.tools ? { toolCalls: [{ id: `t${i}`, name: "retrieval_tool", arguments: '{"query":"cap"}' }] } : {}),
      };
    });
  }

  const final = (body: string) =>
    JSON.stringify({ memo: { id: "c:memo", contractId: "c", language: "en", bodyEn: body, citations: [], approvedByCounsel: false } });

  it("resets when a streamed turn turns out to be a tool-calling turn", async () => {
    const seen: string[] = [];
    const agent = new MemoDrafterAgent(
      streaming([{ text: '{"memo":{"bodyEn":"thinking draft"}}', tools: true }, { text: final("Final body") }]),
      tools(),
      new InMemoryPlaybookAdapter(),
    );
    const result = await agent.run(INPUT, CTX, {
      onMemoDelta: (_f, d) => seen.push(d),
      onMemoReset: () => seen.push("<reset>"),
    });
    const afterReset = seen.slice(seen.lastIndexOf("<reset>") + 1).join("");
    expect(seen).toContain("<reset>");
    expect(afterReset).toBe("Final body");
    expect(result.output.memo.bodyEn).toBe("Final body");
  });

  it("resets when the streamed answer is rejected and the deterministic memo is used", async () => {
    const seen: string[] = [];
    const agent = new MemoDrafterAgent(
      streaming([{ text: '{"memo":{"bodyEn":"half a memo' }]),
      tools(),
      new InMemoryPlaybookAdapter(),
    );
    const result = await agent.run(INPUT, CTX, {
      onMemoDelta: (_f, d) => seen.push(d),
      onMemoReset: () => seen.push("<reset>"),
    });
    expect(result.usedLlm).toBe(false);
    expect(seen.at(-1)).toBe("<reset>");
  });
});
