import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  ApprovalRequiredError,
  MaxIterationsError,
  RunCancelledError,
  RunNotFoundError,
} from "../domain/errors.js";
import type { CompletionPort } from "../domain/ports/completion.port.js";
import type { PlaybookPort } from "../domain/ports/playbook.port.js";
import type { RunStorePort } from "../domain/ports/run-store.port.js";
import type { ApprovalPort } from "../domain/ports/approval.port.js";
import type { VectorStorePort } from "../domain/ports/vector-store.port.js";
import type { EmbeddingPort } from "../domain/ports/embedding.port.js";
import type { RunTraceEvent, TokenUsage, WorkflowRun, WorkflowState } from "../domain/entities/workflow.js";
import { assertTransition } from "../domain/workflow/transitions.js";
import type { DraftMemoInput, ExtractClausesInput, AssessRiskInput } from "./dto.js";
import type { ClauseExtractorOutput, MemoDrafterOutput, RiskAssessorOutput } from "./agents/contracts.js";
import { ClauseExtractorAgent } from "./agents/clause-extractor.agent.js";
import { RiskAssessorAgent } from "./agents/risk-assessor.agent.js";
import { MemoDrafterAgent } from "./agents/memo-drafter.agent.js";
import { ToolRegistry } from "./tools/registry.js";
import { createRetrievalTool } from "./tools/retrieval.tool.js";
import { createClauseComparisonTool } from "./tools/clause-comparison.tool.js";
import { createRiskCalculatorTool } from "./tools/risk-calculator.tool.js";
import { createSaveDraftMemoTool } from "./tools/save-draft-memo.tool.js";
import { withBackoff, withTimeout } from "./orchestration/retry.js";
import type { RunEventBus } from "./orchestration/event-bus.js";

export interface OrchestratorPorts {
  readonly completion: CompletionPort;
  readonly playbook: PlaybookPort;
  readonly approval: ApprovalPort;
  readonly runs: RunStorePort;
  readonly events?: RunEventBus;
  readonly vectors?: VectorStorePort;
  readonly embeddings?: EmbeddingPort;
  readonly requireCounselApproval: boolean;
  readonly maxIterations?: number;
  readonly stepTimeoutMs?: number;
  readonly maxRetries?: number;
}

export interface StartReviewInput {
  readonly contractId: string;
  readonly text: string;
  readonly language: "ar" | "en" | "both";
}

export interface RunControl {
  readonly signal?: AbortSignal;
}

function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0 };
}

function addUsage(into: TokenUsage, extra: TokenUsage): TokenUsage {
  return {
    promptTokens: into.promptTokens + extra.promptTokens,
    completionTokens: into.completionTokens + extra.completionTokens,
  };
}

const runAls = new AsyncLocalStorage<WorkflowRun>();

/**
 * Coordinates Clause Extractor → Risk Assessor → Memo Drafter → Counsel gate.
 * Agents talk through Zod-validated schemas. Risk scores come only from risk_calculator_tool.
 */
export class LegalWorkflowOrchestrator {
  private readonly extractor: ClauseExtractorAgent;
  private readonly assessor: RiskAssessorAgent;
  private readonly drafter: MemoDrafterAgent;
  private readonly tools: ToolRegistry;
  private readonly maxIterations: number;
  private readonly stepTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly abortControllers = new Map<string, AbortController>();
  private readonly cancelTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly ports: OrchestratorPorts) {
    this.maxIterations = ports.maxIterations ?? 12;
    this.stepTimeoutMs = ports.stepTimeoutMs ?? 30_000;
    this.maxRetries = ports.maxRetries ?? 2;

    this.tools = new ToolRegistry((event) => {
      const run = runAls.getStore();
      if (!run) {
        return;
      }
      run.traces.push({
        at: new Date().toISOString(),
        step: event.state,
        agentId: event.agentId,
        toolName: event.toolName,
        latencyMs: event.latencyMs,
        input: event.input,
        output: event.output,
        ...(event.error ? { error: event.error } : {}),
      });
      this.ports.events?.publish({
        type: "TOOL_EXEC",
        runId: run.runId,
        at: new Date().toISOString(),
        agentId: event.agentId,
        step: event.state,
        toolName: event.toolName,
        latencyMs: event.latencyMs,
        ...(event.error ? { error: event.error } : {}),
      });
    });
    this.tools.register(
      createRetrievalTool({
        playbook: ports.playbook,
        ...(ports.vectors ? { vectors: ports.vectors } : {}),
        ...(ports.embeddings ? { embeddings: ports.embeddings } : {}),
      }),
    );
    this.tools.register(createClauseComparisonTool());
    this.tools.register(createRiskCalculatorTool());
    this.tools.register(createSaveDraftMemoTool({ runs: ports.runs }));

    this.extractor = new ClauseExtractorAgent(ports.completion, this.tools);
    this.assessor = new RiskAssessorAgent(this.tools, ports.playbook);
    this.drafter = new MemoDrafterAgent(ports.completion, this.tools);
  }

  /** Create the run and execute in-process (tests / blocking API). */
  async start(input: StartReviewInput, control: RunControl = {}): Promise<WorkflowRun> {
    const run = this.newRun(input);
    await this.ports.runs.save(run);
    await this.execute(run, control.signal);
    return (await this.ports.runs.get(run.runId)) ?? run;
  }

  /** HTTP path: return runId immediately, execute on the next tick. */
  async enqueue(input: StartReviewInput): Promise<{ runId: string }> {
    const run = this.newRun(input);
    await this.ports.runs.save(run);
    const ac = new AbortController();
    this.abortControllers.set(run.runId, ac);
    setImmediate(() => {
      void this.execute(run, ac.signal)
        .catch(() => undefined)
        .finally(() => {
          this.abortControllers.delete(run.runId);
        });
    });
    return { runId: run.runId };
  }

  cancel(runId: string): void {
    this.abortControllers.get(runId)?.abort();
  }

  /** Debounced cancel so React StrictMode SSE reconnects do not kill the run. */
  scheduleCancel(runId: string, delayMs = 1500): void {
    this.clearScheduledCancel(runId);
    const timer = setTimeout(() => {
      this.cancel(runId);
      this.cancelTimers.delete(runId);
    }, delayMs);
    this.cancelTimers.set(runId, timer);
  }

  clearScheduledCancel(runId: string): void {
    const timer = this.cancelTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
    }
    this.cancelTimers.delete(runId);
  }

  async getRun(runId: string): Promise<WorkflowRun> {
    const run = await this.ports.runs.get(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }
    return run;
  }

  /** Legacy extract entry — used by older routes. */
  async extractClauses(input: ExtractClausesInput): Promise<ClauseExtractorOutput> {
    const run = await this.start({
      contractId: input.contractId,
      text: input.text,
      language: input.languageHint === "ar" ? "ar" : "en",
    });
    return { clauses: run.clauses };
  }

  async assessRisk(input: AssessRiskInput): Promise<RiskAssessorOutput> {
    const run = await this.ports.runs.get(input.contractId);
    if (!run) {
      throw new RunNotFoundError(input.contractId);
    }
    return { findings: run.findings };
  }

  async draftMemo(input: DraftMemoInput): Promise<MemoDrafterOutput> {
    const run = await this.ports.runs.get(input.reviewId);
    if (!run) {
      throw new RunNotFoundError(input.reviewId);
    }
    if (this.ports.requireCounselApproval && run.state === "AWAITING_APPROVAL") {
      throw new ApprovalRequiredError();
    }
    if (!run.memo) {
      throw new ApprovalRequiredError("Memo draft is not available.");
    }
    return { memo: run.memo };
  }

  private newRun(input: StartReviewInput): WorkflowRun {
    const now = new Date().toISOString();
    return {
      runId: randomUUID(),
      contractId: input.contractId,
      language: input.language,
      contractText: input.text,
      state: "INIT",
      clauses: [],
      findings: [],
      memo: undefined,
      rejectionReason: undefined,
      traces: [],
      tokenUsage: emptyUsage(),
      iteration: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async execute(run: WorkflowRun, signal?: AbortSignal): Promise<void> {
    await runAls.run(run, async () => {
      try {
        this.throwIfAborted(run, signal);
        await this.transition(run, "EXTRACTING");
        this.emit({
          type: "AGENT_START",
          runId: run.runId,
          at: new Date().toISOString(),
          agentId: "clause_extractor",
          step: "EXTRACTING",
        });
        await this.step(run, "EXTRACTING", "clause_extractor", signal, async () => {
          const { output, tokenUsage, usedLlm } = await this.extractor.run(
            { contractId: run.contractId, text: run.contractText },
            { runId: run.runId, agentId: "clause_extractor", state: "EXTRACTING" },
          );
          run.clauses = [...output.clauses];
          run.tokenUsage = addUsage(run.tokenUsage, tokenUsage);
          for (const clause of output.clauses) {
            this.emit({
              type: "CLAUSE_EXTRACTED",
              runId: run.runId,
              at: new Date().toISOString(),
              clause,
            });
          }
          return { clauses: output.clauses.length, usedLlm };
        });

        this.throwIfAborted(run, signal);
        await this.transition(run, "ASSESSING");
        this.emit({
          type: "AGENT_START",
          runId: run.runId,
          at: new Date().toISOString(),
          agentId: "risk_assessor",
          step: "ASSESSING",
        });
        await this.step(run, "ASSESSING", "risk_assessor", signal, async () => {
          const { output, tokenUsage } = await this.assessor.run(
            { contractId: run.contractId, language: run.language, clauses: run.clauses },
            { runId: run.runId, agentId: "risk_assessor", state: "ASSESSING" },
          );
          run.findings = [...output.findings];
          run.tokenUsage = addUsage(run.tokenUsage, tokenUsage);
          for (const finding of output.findings) {
            this.emit({
              type: "RISK_FOUND",
              runId: run.runId,
              at: new Date().toISOString(),
              finding,
            });
          }
          return {
            findings: output.findings.length,
            omissions: output.findings.filter((f) => f.omitted).map((f) => f.category),
          };
        });

        this.throwIfAborted(run, signal);
        await this.transition(run, "DRAFTING");
        this.emit({
          type: "AGENT_START",
          runId: run.runId,
          at: new Date().toISOString(),
          agentId: "memo_drafter",
          step: "DRAFTING",
        });
        await this.step(run, "DRAFTING", "memo_drafter", signal, async () => {
          const { output, tokenUsage, usedLlm } = await this.drafter.run(
            {
              runId: run.runId,
              contractId: run.contractId,
              language: run.language,
              clauses: run.clauses,
              findings: run.findings,
            },
            { runId: run.runId, agentId: "memo_drafter", state: "DRAFTING" },
          );
          run.memo = output.memo;
          run.tokenUsage = addUsage(run.tokenUsage, tokenUsage);
          return { memoId: output.memo.id, usedLlm, citations: output.memo.citations.map((c) => c.id) };
        });

        this.throwIfAborted(run, signal);
        await this.transition(run, "AWAITING_APPROVAL");
        this.emit({
          type: "AWAITING_APPROVAL",
          runId: run.runId,
          at: new Date().toISOString(),
          tokenUsage: run.tokenUsage,
        });

        if (!this.ports.requireCounselApproval) {
          await this.transition(run, "APPROVED");
          if (run.memo) {
            run.memo = { ...run.memo, approvedByCounsel: true };
          }
          await this.transition(run, "COMPLETED");
        }

        await this.ports.runs.save(run);
      } catch (err) {
        if (err instanceof RunCancelledError) {
          run.state = "FAILED";
          run.updatedAt = new Date().toISOString();
          this.emit({ type: "RUN_CANCELLED", runId: run.runId, at: run.updatedAt });
          await this.ports.runs.save(run);
          throw err;
        }
        run.state = "FAILED";
        run.updatedAt = new Date().toISOString();
        run.traces.push({
          at: run.updatedAt,
          step: "FAILED",
          latencyMs: 0,
          input: {},
          output: {},
          error: err instanceof Error ? err.message : String(err),
        });
        this.emit({
          type: "RUN_FAILED",
          runId: run.runId,
          at: run.updatedAt,
          message: err instanceof Error ? err.message : String(err),
        });
        await this.ports.runs.save(run);
        throw err;
      }
    });
  }

  private throwIfAborted(run: WorkflowRun, signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new RunCancelledError(run.runId);
    }
  }

  private emit(event: Parameters<RunEventBus["publish"]>[0]): void {
    this.ports.events?.publish(event);
  }

  private async transition(run: WorkflowRun, to: WorkflowState): Promise<void> {
    this.bump(run);
    assertTransition(run.state, to);
    run.state = to;
    run.updatedAt = new Date().toISOString();
    await this.ports.runs.save(run);
  }

  private bump(run: WorkflowRun): void {
    run.iteration += 1;
    if (run.iteration > this.maxIterations) {
      throw new MaxIterationsError(this.maxIterations);
    }
  }

  private async step(
    run: WorkflowRun,
    step: WorkflowState,
    agentId: "clause_extractor" | "risk_assessor" | "memo_drafter",
    signal: AbortSignal | undefined,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    this.throwIfAborted(run, signal);
    const started = Date.now();
    const input = { state: step, iteration: run.iteration };
    try {
      const output = await withBackoff(
        () => withTimeout(step, this.stepTimeoutMs, fn),
        { retries: this.maxRetries, baseDelayMs: 50 },
      );
      this.trace(run, {
        at: new Date().toISOString(),
        step,
        agentId,
        latencyMs: Date.now() - started,
        input,
        output,
      });
    } catch (err) {
      this.trace(run, {
        at: new Date().toISOString(),
        step,
        agentId,
        latencyMs: Date.now() - started,
        input,
        output: {},
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private trace(run: WorkflowRun, event: RunTraceEvent): void {
    run.traces.push(event);
  }
}

/** Back-compat name used by presentation until routes are fully switched. */
export { LegalWorkflowOrchestrator as ReviewOrchestrator };
