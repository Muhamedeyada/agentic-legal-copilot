import type { RunStorePort } from "../../domain/ports/run-store.port.js";
import type { RunTraceEvent, WorkflowRun, WorkflowState } from "../../domain/entities/workflow.js";
import type { SqliteDatabase } from "../sqlite/database.js";

interface RunRow {
  run_id: string;
  contract_id: string;
  language: WorkflowRun["language"];
  state: WorkflowState;
  contract_text: string;
  clauses: string;
  findings: string;
  memo: string | null;
  rejection_reason: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  iteration: number;
  created_at: string;
  updated_at: string;
}

interface TraceRow {
  at: string;
  step: WorkflowState;
  agent_id: RunTraceEvent["agentId"] | null;
  tool_name: RunTraceEvent["toolName"] | null;
  latency_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  error: string | null;
  input: string;
  output: string;
}

const IN_FLIGHT: readonly WorkflowState[] = ["INIT", "EXTRACTING", "ASSESSING", "DRAFTING"];

/**
 * Runs and their traces in SQLite. Traces are append-only, so each save inserts only the
 * events the stored copy does not have yet.
 */
export class SqliteRunStoreAdapter implements RunStorePort {
  private readonly upsertRun;
  private readonly insertTrace;
  private readonly countTraces;
  private readonly selectRun;
  private readonly selectTraces;
  private readonly selectInFlight;
  private readonly saveTx;

  constructor(private readonly db: SqliteDatabase) {
    this.upsertRun = db.prepare(`
      INSERT INTO runs (run_id, contract_id, language, state, contract_text, clauses, findings, memo,
                        rejection_reason, prompt_tokens, completion_tokens, iteration, created_at, updated_at)
      VALUES (@run_id, @contract_id, @language, @state, @contract_text, @clauses, @findings, @memo,
              @rejection_reason, @prompt_tokens, @completion_tokens, @iteration, @created_at, @updated_at)
      ON CONFLICT (run_id) DO UPDATE SET
        state = excluded.state, clauses = excluded.clauses, findings = excluded.findings,
        memo = excluded.memo, rejection_reason = excluded.rejection_reason,
        prompt_tokens = excluded.prompt_tokens, completion_tokens = excluded.completion_tokens,
        iteration = excluded.iteration, updated_at = excluded.updated_at`);
    this.insertTrace = db.prepare(`
      INSERT INTO run_traces (run_id, seq, at, step, agent_id, tool_name, latency_ms,
                              prompt_tokens, completion_tokens, error, input, output)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.countTraces = db.prepare("SELECT COUNT(*) AS n FROM run_traces WHERE run_id = ?").pluck();
    this.selectRun = db.prepare("SELECT * FROM runs WHERE run_id = ?");
    this.selectTraces = db.prepare("SELECT * FROM run_traces WHERE run_id = ? ORDER BY seq");
    this.selectInFlight = db
      .prepare(`SELECT run_id FROM runs WHERE state IN (${IN_FLIGHT.map(() => "?").join(", ")})`)
      .pluck();
    this.saveTx = db.transaction((run: WorkflowRun) => {
      this.upsertRun.run(toRow(run));
      const stored = this.countTraces.get(run.runId) as number;
      run.traces.slice(stored).forEach((trace, i) => {
        this.insertTrace.run(...traceParams(run.runId, stored + i, trace));
      });
    });
  }

  async get(runId: string): Promise<WorkflowRun | undefined> {
    const row = this.selectRun.get(runId) as RunRow | undefined;
    return row ? fromRow(row, this.selectTraces.all(runId) as TraceRow[]) : undefined;
  }

  async save(run: WorkflowRun): Promise<void> {
    this.saveTx(run);
  }

  /**
   * Agent work runs in process memory, so a run that was mid-pipeline when the process stopped
   * can never finish. Mark those FAILED on startup. Runs waiting for Counsel are kept.
   */
  async failInterruptedRuns(message: string): Promise<number> {
    const ids = this.selectInFlight.all(...IN_FLIGHT) as string[];
    for (const id of ids) {
      const run = await this.get(id);
      if (!run) continue;
      const at = new Date().toISOString();
      run.state = "FAILED";
      run.updatedAt = at;
      run.traces.push({ at, step: "FAILED", latencyMs: 0, input: {}, output: {}, error: message });
      await this.save(run);
    }
    return ids.length;
  }
}

function toRow(run: WorkflowRun): RunRow {
  return {
    run_id: run.runId,
    contract_id: run.contractId,
    language: run.language,
    state: run.state,
    contract_text: run.contractText,
    clauses: JSON.stringify(run.clauses),
    findings: JSON.stringify(run.findings),
    memo: run.memo ? JSON.stringify(run.memo) : null,
    rejection_reason: run.rejectionReason ?? null,
    prompt_tokens: run.tokenUsage.promptTokens,
    completion_tokens: run.tokenUsage.completionTokens,
    iteration: run.iteration,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  };
}

function traceParams(runId: string, seq: number, t: RunTraceEvent): unknown[] {
  return [
    runId,
    seq,
    t.at,
    t.step,
    t.agentId ?? null,
    t.toolName ?? null,
    Math.round(t.latencyMs),
    t.tokenUsage?.promptTokens ?? null,
    t.tokenUsage?.completionTokens ?? null,
    t.error ?? null,
    JSON.stringify(t.input ?? null),
    JSON.stringify(t.output ?? null),
  ];
}

function fromRow(row: RunRow, traces: TraceRow[]): WorkflowRun {
  return {
    runId: row.run_id,
    contractId: row.contract_id,
    language: row.language,
    contractText: row.contract_text,
    state: row.state,
    clauses: JSON.parse(row.clauses) as WorkflowRun["clauses"],
    findings: JSON.parse(row.findings) as WorkflowRun["findings"],
    memo: row.memo ? (JSON.parse(row.memo) as NonNullable<WorkflowRun["memo"]>) : undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    traces: traces.map(fromTraceRow),
    tokenUsage: { promptTokens: row.prompt_tokens, completionTokens: row.completion_tokens },
    iteration: row.iteration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type MutableTraceEvent = { -readonly [K in keyof RunTraceEvent]?: RunTraceEvent[K] };

function fromTraceRow(row: TraceRow): RunTraceEvent {
  const event: MutableTraceEvent = {
    at: row.at,
    step: row.step,
    latencyMs: row.latency_ms,
    input: JSON.parse(row.input) as unknown,
    output: JSON.parse(row.output) as unknown,
  };
  if (row.agent_id) event.agentId = row.agent_id;
  if (row.tool_name) event.toolName = row.tool_name;
  if (row.prompt_tokens !== null && row.completion_tokens !== null) {
    event.tokenUsage = { promptTokens: row.prompt_tokens, completionTokens: row.completion_tokens };
  }
  if (row.error) event.error = row.error;
  return event as RunTraceEvent;
}
