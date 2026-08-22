import { randomUUID } from "node:crypto";
import { ApprovalRequiredError, MaxIterationsError, RunNotFoundError } from "../domain/errors.js";
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

export interface OrchestratorPorts {
  readonly completion: CompletionPort;
  readonly playbook: PlaybookPort;
  readonly approval: ApprovalPort;
  readonly runs: RunStorePort;
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

function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0 };
}

function addUsage(into: TokenUsage, extra: TokenUsage): TokenUsage {
  return {
    promptTokens: into.promptTokens + extra.promptTokens,
    completionTokens: into.completionTokens + extra.completionTokens,
  };
}

/**
 * Coordinates Clause Extractor → Risk Assessor → Memo Drafter → Counsel gate.
 * Agents talk through Zod-validated schemas. Risk scores come only from risk_calculator_tool.
 */
export class LegalWorkflowOrchestrator {
  private activeRun: WorkflowRun | undefined;
  private readonly extractor: ClauseExtractorAgent;
  private readonly assessor: RiskAssessorAgent;
  private readonly drafter: MemoDrafterAgent;
  private readonly tools: ToolRegistry;
  private readonly maxIterations: number;
  private readonly stepTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly ports: OrchestratorPorts) {
    this.maxIterations = ports.maxIterations ?? 12;
    this.stepTimeoutMs = ports.stepTimeoutMs ?? 30_000;
    this.maxRetries = ports.maxRetries ?? 2;

    this.tools = new ToolRegistry((event) => {
      this.activeRun?.traces.push({
        at: new Date().toISOString(),
        step: event.state,
        agentId: event.agentId,
        toolName: event.toolName,
        latencyMs: event.latencyMs,
        input: event.input,
        output: event.output,
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

  async start(input: StartReviewInput): Promise<WorkflowRun> {
    const now = new Date().toISOString();
    const run: WorkflowRun = {
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
    await this.ports.runs.save(run);
    this.activeRun = run;

    try {
      await this.transition(run, "EXTRACTING");
      await this.step(run, "EXTRACTING", "clause_extractor", async () => {
        const { output, tokenUsage, usedLlm } = await this.extractor.run(
          { contractId: input.contractId, text: input.text },
          { runId: run.runId, agentId: "clause_extractor", state: "EXTRACTING" },
        );
        run.clauses = [...output.clauses];
        run.tokenUsage = addUsage(run.tokenUsage, tokenUsage);
        return { clauses: output.clauses.length, usedLlm };
      });

      await this.transition(run, "ASSESSING");
      await this.step(run, "ASSESSING", "risk_assessor", async () => {
        const { output, tokenUsage } = await this.assessor.run(
          { contractId: input.contractId, language: input.language, clauses: run.clauses },
          { runId: run.runId, agentId: "risk_assessor", state: "ASSESSING" },
        );
        run.findings = [...output.findings];
        run.tokenUsage = addUsage(run.tokenUsage, tokenUsage);
        return {
          findings: output.findings.length,
          omissions: output.findings.filter((f) => f.omitted).map((f) => f.category),
        };
      });

      await this.transition(run, "DRAFTING");
      await this.step(run, "DRAFTING", "memo_drafter", async () => {
        const { output, tokenUsage, usedLlm } = await this.drafter.run(
          {
            runId: run.runId,
            contractId: input.contractId,
            language: input.language,
            clauses: run.clauses,
            findings: run.findings,
          },
          { runId: run.runId, agentId: "memo_drafter", state: "DRAFTING" },
        );
        run.memo = output.memo;
        run.tokenUsage = addUsage(run.tokenUsage, tokenUsage);
        return { memoId: output.memo.id, usedLlm, citations: output.memo.citations.map((c) => c.id) };
      });

      await this.transition(run, "AWAITING_APPROVAL");

      if (!this.ports.requireCounselApproval) {
        await this.transition(run, "APPROVED");
        if (run.memo) {
          run.memo = { ...run.memo, approvedByCounsel: true };
        }
        await this.transition(run, "COMPLETED");
      }

      await this.ports.runs.save(run);
      return run;
    } catch (err) {
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
      await this.ports.runs.save(run);
      throw err;
    } finally {
      this.activeRun = undefined;
    }
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
    fn: () => Promise<unknown>,
  ): Promise<void> {
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
