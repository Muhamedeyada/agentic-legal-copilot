import type { WorkflowRun } from "../../domain/entities/workflow.js";

export function runSnapshot(run: WorkflowRun) {
  return {
    runId: run.runId,
    contractId: run.contractId,
    language: run.language,
    state: run.state,
    clauses: run.clauses,
    findings: run.findings,
    memo: run.memo,
    rejectionReason: run.rejectionReason,
    tokenUsage: run.tokenUsage,
    traces: run.traces,
    iteration: run.iteration,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
