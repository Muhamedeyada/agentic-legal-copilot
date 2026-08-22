import type { WorkflowRun } from "../entities/workflow.js";

export interface RunStorePort {
  get(runId: string): Promise<WorkflowRun | undefined>;
  save(run: WorkflowRun): Promise<void>;
}
