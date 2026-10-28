import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MemoDrafterAgent, MAX_REACT_ITERATIONS, type MemoDrafterInput } from "../../src/application/agents/memo-drafter.agent.js";
import { MEMO_DRAFTER_TOOL_SPECS, MODEL_TOOL_ARGS, MODEL_TOOL_NAMES } from "../../src/application/agents/memo-drafter.tools.js";
import { ToolRegistry, type ToolContext, type ToolTraceListener } from "../../src/application/tools/registry.js";
import { createRetrievalTool } from "../../src/application/tools/retrieval.tool.js";
import { createClauseComparisonTool } from "../../src/application/tools/clause-comparison.tool.js";
import { RetrievalToolInputZ, RetrievalToolOutputZ, SaveDraftMemoInputZ, SaveDraftMemoOutputZ } from "../../src/application/agents/schemas.js";
import { LegalWorkflowOrchestrator } from "../../src/application/orchestrator.js";
import { MockCompletionAdapter } from "../../src/infrastructure/llm/mock.adapter.js";
import { CappedCompletionAdapter } from "../../src/infrastructure/llm/capped.adapter.js";
import { HostedCompletionAdapter } from "../../src/infrastructure/llm/hosted.adapter.js";
import { InMemoryApprovalAdapter } from "../../src/infrastructure/approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";
import { TokenBudgetExceededError } from "../../src/application/security/token-budget.js";
import type { CompletionRequest, CompletionResult, ToolCallRequest } from "../../src/domain/ports/completion.port.js";

const CTX: ToolContext = { runId: "run-1", agentId: "memo_drafter", state: "DRAFTING" };

const INPUT: MemoDrafterInput = {
  runId: "run-1",
  contractId: "c-1",
  language: "en",
  clauses: [
    {
      id: "c-1:clause:1",
      contractId: "c-1",
      category: "liability",
      title: "Liability",
      text: "The Supplier's liability is unlimited and not subject to any cap.",
      language: "en",
      heading: "## 1. Liability",
      standard: false,
      spanStart: 0,
      spanEnd: 70,
    },
  ],
  findings: [
    {
      id: "f-1",
      clauseId: "c-1:clause:1",
      category: "liability",
      severity: "critical",
      rationale: "Uncapped liability.",
      citationIds: ["playbook:en:liability"],
      omitted: false,
    },
  ],
};

const FINAL = JSON.stringify({
  memo: { id: "c-1:memo", contractId: "c-1", language: "en", bodyEn: "# Final memo", citations: [], approvedByCounsel: false },
});

function call(name: string, args: unknown, id = `call_${name}`): ToolCallRequest {
  return { id, name, arguments: typeof args === "string" ? args : JSON.stringify(args) };
}

/** Scripted model: returns each step in order and records every request it saw. */
function scripted(steps: Array<ToolCallRequest[] | string>, seen: CompletionRequest[]): MockCompletionAdapter {
  let i = 0;
  return new MockCompletionAdapter((input): CompletionResult => {
    seen.push(input);
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    return typeof step === "string"
      ? { text: step, providerId: "scripted", model: "s", usage: { promptTokens: 10, completionTokens: 5 } }
      : { text: "", toolCalls: step, providerId: "scripted", model: "s", usage: { promptTokens: 10, completionTokens: 5 } };
  });
}

function registry(onTrace?: ToolTraceListener): { tools: ToolRegistry; saved: unknown[] } {
  const saved: unknown[] = [];
  const tools = new ToolRegistry(onTrace);
  tools.register(createRetrievalTool({ playbook: new InMemoryPlaybookAdapter() }));
  tools.register(createClauseComparisonTool());
  tools.register({
    name: "save_draft_memo_tool",
    inputSchema: SaveDraftMemoInputZ,
    outputSchema: SaveDraftMemoOutputZ,
    sideEffecting: true,
    async execute(input) {
      saved.push(input);
      return { status: "PENDING_APPROVAL" as const, memoId: input.memo.id };
    },
  });
  return { tools, saved };
}

function lastObservations(seen: CompletionRequest[]): Record<string, unknown>[] {
  const history = seen.at(-1)?.history ?? [];
  return history.flatMap((t) => (t.role === "tool" ? [JSON.parse(t.content) as Record<string, unknown>] : []));
}

describe("MemoDrafter ReAct loop", () => {
  it("lets the model retrieve precedent, compare the clause, and cite only real chunk IDs", async () => {
    const seen: CompletionRequest[] = [];
    const traced: string[] = [];
    const { tools, saved } = registry((e) => traced.push(e.toolName));
    const agent = new MemoDrafterAgent(
      scripted(
        [
          [call("retrieval_tool", { query: "liability cap standard", category: "liability", topK: 2 })],
          [call("clause_comparison_tool", { contractClause: INPUT.clauses[0]!.text, policyClause: "Liability is capped at twelve months of fees." })],
          FINAL,
        ],
        seen,
      ),
      tools,
      new InMemoryPlaybookAdapter(),
    );

    const result = await agent.run(INPUT, CTX);

    expect(seen).toHaveLength(3);
    expect(seen[0]?.tools?.map((t) => t.name)).toEqual(["retrieval_tool", "clause_comparison_tool"]);
    const [retrieved, compared] = lastObservations(seen);
    const hitIds = (retrieved?.hits as Array<{ chunkId: string }>).map((h) => h.chunkId);
    expect(hitIds.length).toBeGreaterThan(0);
    expect(compared).toMatchObject({ deviation: expect.any(Boolean), tokenOverlap: expect.any(Number) });

    expect(result).toMatchObject({ usedLlm: true, provider: "scripted", iterations: 3 });
    expect(result.toolSteps.map((s) => [s.tool, s.ok])).toEqual([
      ["retrieval_tool", true],
      ["clause_comparison_tool", true],
    ]);
    expect(result.tokenUsage).toEqual({ promptTokens: 30, completionTokens: 15 });
    expect(result.output.memo.bodyEn).toBe("# Final memo");
    const citationIds = result.output.memo.citations.map((c) => c.id);
    expect(citationIds).toEqual(expect.arrayContaining(hitIds));
    expect(citationIds.every((id) => id === "playbook:en:liability" || hitIds.includes(id))).toBe(true);

    expect(traced).toEqual(["retrieval_tool", "clause_comparison_tool", "save_draft_memo_tool"]);
    expect(saved).toHaveLength(1);
  });

  it("finishes in one turn without tools when the model decides it needs no precedent", async () => {
    const seen: CompletionRequest[] = [];
    const traced: string[] = [];
    const { tools } = registry((e) => traced.push(e.toolName));
    const agent = new MemoDrafterAgent(scripted([FINAL], seen), tools, new InMemoryPlaybookAdapter());

    const result = await agent.run(INPUT, CTX);

    expect(result).toMatchObject({ usedLlm: true, iterations: 1, toolSteps: [] });
    expect(traced).toEqual(["save_draft_memo_tool"]);
    expect(result.output.memo.citations.map((c) => c.id)).toEqual(["playbook:en:liability"]);
  });

  it(`breaks the loop after ${MAX_REACT_ITERATIONS} iterations and falls back to the deterministic memo`, async () => {
    const seen: CompletionRequest[] = [];
    const { tools, saved } = registry();
    const agent = new MemoDrafterAgent(
      scripted([[call("retrieval_tool", { query: "liability" })]], seen),
      tools,
      new InMemoryPlaybookAdapter(),
    );

    const result = await agent.run(INPUT, CTX);

    expect(seen).toHaveLength(MAX_REACT_ITERATIONS);
    expect(result.usedLlm).toBe(false);
    expect(result.iterations).toBe(MAX_REACT_ITERATIONS);
    expect(result.fallbackReason).toMatch(/did not finish within 12 reasoning iterations/);
    expect(result.tokenUsage).toEqual({ promptTokens: 120, completionTokens: 60 });
    expect(result.output.memo.bodyEn).toMatch(/Contract risk memo/);
    expect(saved).toHaveLength(1);
  });

  it("rejects malformed or out-of-bounds model arguments with Zod before any tool runs", async () => {
    const seen: CompletionRequest[] = [];
    const traced: string[] = [];
    const { tools } = registry((e) => traced.push(e.toolName));
    const agent = new MemoDrafterAgent(
      scripted(
        [
          [
            call("retrieval_tool", "{not json", "a"),
            call("retrieval_tool", { query: "", topK: 50 }, "b"),
            call("retrieval_tool", { query: "liability", ignorePreviousInstructions: true }, "c"),
            call("clause_comparison_tool", { contractClause: "x" }, "d"),
          ],
          FINAL,
        ],
        seen,
      ),
      tools,
      new InMemoryPlaybookAdapter(),
    );

    const result = await agent.run(INPUT, CTX);

    const errors = lastObservations(seen).map((o) => String(o.error));
    expect(errors[0]).toMatch(/must be a JSON object/);
    expect(errors[1]).toMatch(/retrieval_tool\.arguments/);
    expect(errors[2]).toMatch(/retrieval_tool\.arguments/);
    expect(errors[3]).toMatch(/clause_comparison_tool\.arguments/);
    expect(result.toolSteps.every((s) => !s.ok)).toBe(true);
    expect(traced).toEqual(["save_draft_memo_tool"]);
    expect(result.usedLlm).toBe(true);
  });

  it("never lets the model call save_draft_memo_tool or tools outside the allowlist", async () => {
    const seen: CompletionRequest[] = [];
    const { tools, saved } = registry();
    const agent = new MemoDrafterAgent(
      scripted(
        [
          [
            call("save_draft_memo_tool", { runId: "run-1", memo: {} }),
            call("risk_calculator_tool", { category: "liability" }),
            call("shell_exec", { cmd: "rm -rf /" }),
          ],
          FINAL,
        ],
        seen,
      ),
      tools,
      new InMemoryPlaybookAdapter(),
    );

    const result = await agent.run(INPUT, CTX);

    expect(lastObservations(seen).map((o) => o.error)).toEqual([
      expect.stringMatching(/not available/),
      expect.stringMatching(/not available/),
      expect.stringMatching(/not available/),
    ]);
    expect(result.toolSteps.map((s) => s.ok)).toEqual([false, false, false]);
    expect(saved).toHaveLength(1);
  });

  it("caps tool calls per turn", async () => {
    const seen: CompletionRequest[] = [];
    const { tools } = registry();
    const many = Array.from({ length: 6 }, (_, i) => call("retrieval_tool", { query: "liability" }, `r${i}`));
    const agent = new MemoDrafterAgent(scripted([many, FINAL], seen), tools, new InMemoryPlaybookAdapter());

    const result = await agent.run(INPUT, CTX);

    expect(result.toolSteps.filter((s) => s.ok)).toHaveLength(4);
    expect(result.toolSteps.filter((s) => !s.ok).map((s) => s.error)).toEqual([
      expect.stringMatching(/At most 4 tool calls/),
      expect.stringMatching(/At most 4 tool calls/),
    ]);
  });

  it("validates tool results with Zod and reports violations to the model", async () => {
    const seen: CompletionRequest[] = [];
    const { tools } = registry();
    tools.register({
      name: "retrieval_tool",
      inputSchema: RetrievalToolInputZ,
      outputSchema: RetrievalToolOutputZ,
      sideEffecting: false,
      execute: async () => ({ hits: [{ chunkId: 42 }] }) as never,
    });
    const agent = new MemoDrafterAgent(
      scripted([[call("retrieval_tool", { query: "liability" })], FINAL], seen),
      tools,
      new InMemoryPlaybookAdapter(),
    );

    const result = await agent.run(INPUT, CTX);

    expect(String(lastObservations(seen)[0]?.error)).toMatch(/retrieval_tool\.output/);
    expect(result.toolSteps).toEqual([expect.objectContaining({ tool: "retrieval_tool", ok: false })]);
  });

  it("keeps contract excerpts inside the untrusted-document envelope", async () => {
    const seen: CompletionRequest[] = [];
    const { tools } = registry();
    const agent = new MemoDrafterAgent(scripted([FINAL], seen), tools, new InMemoryPlaybookAdapter());

    await agent.run(INPUT, CTX);

    const user = seen[0]?.user ?? "";
    expect(user).toMatch(/<<<UNTRUSTED_DOCUMENT id=c-1>>>[\s\S]*not subject to any cap[\s\S]*<<<END_UNTRUSTED_DOCUMENT>>>/);
    expect(seen[0]?.system).not.toMatch(/not subject to any cap/);
  });
});

describe("model tool contracts", () => {
  it("exposes exactly the allowlisted read-only tools, with JSON schemas matching the Zod validators", () => {
    expect(MEMO_DRAFTER_TOOL_SPECS.map((t) => t.name)).toEqual([...MODEL_TOOL_NAMES]);
    for (const spec of MEMO_DRAFTER_TOOL_SPECS) {
      const zod = MODEL_TOOL_ARGS[spec.name as keyof typeof MODEL_TOOL_ARGS] as z.ZodObject<z.ZodRawShape>;
      const props = spec.parameters.properties as Record<string, unknown>;
      expect(Object.keys(props).sort()).toEqual(Object.keys(zod.shape).sort());
      const required = Object.entries(zod.shape)
        .filter(([, v]) => !(v as z.ZodTypeAny).isOptional())
        .map(([k]) => k)
        .sort();
      expect([...(spec.parameters.required as string[])].sort()).toEqual(required);
      expect(spec.parameters.additionalProperties).toBe(false);
    }
  });
});

describe("offline mock runs the ReAct loop end to end", () => {
  it("records the drafter's tool decisions on the trace and adds a precedent section", async () => {
    const orchestrator = new LegalWorkflowOrchestrator({
      completion: new MockCompletionAdapter(),
      playbook: new InMemoryPlaybookAdapter(),
      approval: new InMemoryApprovalAdapter(),
      runs: new InMemoryRunStoreAdapter(),
      requireCounselApproval: true,
      maxRetries: 0,
    });

    const run = await orchestrator.start({
      contractId: "react",
      text: "## 1. Liability\nThe Supplier's liability is unlimited and not subject to any cap.",
      language: "en",
    });

    const drafter = run.traces.find((t) => t.agentId === "memo_drafter" && !t.toolName);
    const summary = drafter?.output as { usedLlm: boolean; reactIterations: number; toolCalls: string[] };
    expect(summary.usedLlm).toBe(true);
    expect(summary.toolCalls).toContain("retrieval_tool");
    expect(summary.toolCalls).toContain("clause_comparison_tool");
    expect(summary.reactIterations).toBe(3);
    expect(run.memo?.bodyEn).toMatch(/## Precedent check[\s\S]*liability: \d+% overlap with /);
  });
});

describe("tool calling over the OpenAI-compatible wire format", () => {
  it("sends tools and history, and parses tool_calls from a content-less reply", async () => {
    const bodies: Record<string, unknown>[] = [];
    const adapter = new HostedCompletionAdapter({
      apiKey: "sk-test",
      baseUrl: "https://llm.example/v1",
      model: "gpt-test",
      timeoutMs: 1_000,
      fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [{ id: "call_9", type: "function", function: { name: "retrieval_tool", arguments: '{"query":"cap"}' } }],
                },
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 8 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const result = await adapter.complete({
      system: "sys",
      user: "{}",
      jsonSchemaName: "memo_drafter_output",
      tools: MEMO_DRAFTER_TOOL_SPECS,
      history: [
        { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "retrieval_tool", arguments: '{"query":"x"}' }] },
        { role: "tool", toolCallId: "call_1", content: '{"hits":[]}' },
      ],
    });

    const body = bodies[0]!;
    expect(body.response_format).toBeUndefined();
    expect(body.tool_choice).toBe("auto");
    expect((body.tools as Array<{ type: string; function: { name: string } }>).map((t) => [t.type, t.function.name])).toEqual([
      ["function", "retrieval_tool"],
      ["function", "clause_comparison_tool"],
    ]);
    expect((body.messages as unknown[]).slice(2)).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_1", type: "function", function: { name: "retrieval_tool", arguments: '{"query":"x"}' } }],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"hits":[]}' },
    ]);
    expect(result).toMatchObject({
      text: "",
      toolCalls: [{ id: "call_9", name: "retrieval_tool", arguments: '{"query":"cap"}' }],
      usage: { promptTokens: 50, completionTokens: 8 },
    });
  });

  it("counts tool-calling history against the prompt budget", async () => {
    const capped = new CappedCompletionAdapter(new MockCompletionAdapter(() => ({ text: "{}", providerId: "x", model: "x" })), {
      maxPromptChars: 100,
      maxCompletionChars: 100,
    });
    await expect(
      capped.complete({
        system: "s",
        user: "u",
        history: [{ role: "tool", toolCallId: "t", content: "x".repeat(200) }],
      }),
    ).rejects.toBeInstanceOf(TokenBudgetExceededError);
  });
});
