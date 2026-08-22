import type { RunStorePort } from "../../domain/ports/run-store.port.js";
import type { WorkflowRun } from "../../domain/entities/workflow.js";

export class InMemoryRunStoreAdapter implements RunStorePort {
  private readonly runs = new Map<string, WorkflowRun>();

  async get(runId: string): Promise<WorkflowRun | undefined> {
    return this.runs.get(runId);
  }

  async save(run: WorkflowRun): Promise<void> {
    this.runs.set(run.runId, run);
  }
}
