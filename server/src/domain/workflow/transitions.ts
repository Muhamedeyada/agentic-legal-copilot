import { InvalidStateTransitionError } from "../errors.js";
import type { WorkflowState } from "../entities/workflow.js";

const ALLOWED: Record<WorkflowState, readonly WorkflowState[]> = {
  INIT: ["EXTRACTING", "FAILED"],
  EXTRACTING: ["ASSESSING", "FAILED"],
  ASSESSING: ["DRAFTING", "FAILED"],
  DRAFTING: ["AWAITING_APPROVAL", "FAILED"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "EDITED", "FAILED"],
  APPROVED: ["COMPLETED"],
  REJECTED: ["COMPLETED"],
  EDITED: ["COMPLETED"],
  COMPLETED: [],
  FAILED: [],
};

export function assertTransition(from: WorkflowState, to: WorkflowState): void {
  if (!ALLOWED[from].includes(to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return ALLOWED[from].includes(to);
}
