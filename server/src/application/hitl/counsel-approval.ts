import { ApprovalRequiredError, InvalidStateTransitionError, RunNotFoundError } from "../../domain/errors.js";
import type { ApprovalPort, CounselEditedMemo } from "../../domain/ports/approval.port.js";
import type { RunStorePort } from "../../domain/ports/run-store.port.js";
import type { WorkflowRun } from "../../domain/entities/workflow.js";
import { assertTransition } from "../../domain/workflow/transitions.js";
import type { ReviewMemo } from "../../domain/entities/memo.js";
import type { RunEventBus } from "../orchestration/event-bus.js";

export interface CounselGateInput {
  readonly runId: string;
  readonly counselId: string;
}

export class CounselApprovalUseCase {
  constructor(
    private readonly approval: ApprovalPort,
    private readonly runs: RunStorePort,
    private readonly events?: RunEventBus,
  ) {}

  async approveRun(runId: string, counselId: string): Promise<WorkflowRun> {
    const run = await this.requireAwaiting(runId);
    await this.approval.recordApproval(runId, counselId);
    this.move(run, "APPROVED");
    if (run.memo) {
      run.memo = { ...run.memo, approvedByCounsel: true };
    }
    this.move(run, "COMPLETED");
    await this.runs.save(run);
    this.announce(runId, "approved", run.updatedAt);
    return run;
  }

  async rejectRun(runId: string, reason: string, counselId: string): Promise<WorkflowRun> {
    const run = await this.requireAwaiting(runId);
    if (reason.trim().length === 0) {
      throw new Error("Rejection reason is required.");
    }
    await this.approval.reject(runId, counselId, reason);
    run.rejectionReason = reason;
    this.move(run, "REJECTED");
    this.move(run, "COMPLETED");
    await this.runs.save(run);
    this.announce(runId, "rejected", run.updatedAt);
    return run;
  }

  async editAndApproveRun(
    runId: string,
    editedMemo: CounselEditedMemo,
    counselId: string,
  ): Promise<WorkflowRun> {
    const run = await this.requireAwaiting(runId);
    if (!run.memo) {
      throw new ApprovalRequiredError("No memo draft to edit.");
    }
    await this.approval.editAndApprove(runId, counselId, editedMemo);
    const next: ReviewMemo = {
      ...run.memo,
      approvedByCounsel: true,
      ...(editedMemo.bodyEn !== undefined ? { bodyEn: editedMemo.bodyEn } : {}),
      ...(editedMemo.bodyAr !== undefined ? { bodyAr: editedMemo.bodyAr } : {}),
    };
    run.memo = next;
    this.move(run, "EDITED");
    this.move(run, "COMPLETED");
    await this.runs.save(run);
    this.announce(runId, "edited", run.updatedAt);
    return run;
  }

  private announce(runId: string, decision: "approved" | "rejected" | "edited", at: string): void {
    this.events?.publish({ type: "HITL_DECISION", runId, at, decision });
  }

  private async requireAwaiting(runId: string): Promise<WorkflowRun> {
    const run = await this.runs.get(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }
    if (run.state !== "AWAITING_APPROVAL") {
      throw new InvalidStateTransitionError(run.state, "APPROVED");
    }
    return run;
  }

  private move(run: WorkflowRun, to: "APPROVED" | "REJECTED" | "EDITED" | "COMPLETED"): void {
    assertTransition(run.state, to);
    run.state = to;
    run.updatedAt = new Date().toISOString();
  }
}
