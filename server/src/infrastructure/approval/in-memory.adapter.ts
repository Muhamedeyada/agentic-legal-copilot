import type {
  ApprovalDecision,
  ApprovalPort,
  ApprovalRecord,
  CounselEditedMemo,
} from "../../domain/ports/approval.port.js";

export class InMemoryApprovalAdapter implements ApprovalPort {
  private readonly records = new Map<string, ApprovalRecord>();

  async isApproved(reviewId: string): Promise<boolean> {
    const rec = this.records.get(reviewId);
    return rec?.decision === "approved" || rec?.decision === "edited";
  }

  async recordApproval(reviewId: string, counselId: string): Promise<void> {
    this.put(reviewId, "approved", counselId);
  }

  async reject(reviewId: string, counselId: string, reason: string): Promise<void> {
    this.put(reviewId, "rejected", counselId, reason);
  }

  async editAndApprove(
    reviewId: string,
    counselId: string,
    editedMemo: CounselEditedMemo,
  ): Promise<void> {
    this.records.set(reviewId, {
      reviewId,
      decision: "edited",
      counselId,
      editedMemo,
      at: new Date().toISOString(),
    });
  }

  async getRecord(reviewId: string): Promise<ApprovalRecord | undefined> {
    return this.records.get(reviewId);
  }

  private put(
    reviewId: string,
    decision: ApprovalDecision,
    counselId: string,
    reason?: string,
  ): void {
    this.records.set(reviewId, {
      reviewId,
      decision,
      counselId,
      ...(reason !== undefined ? { reason } : {}),
      at: new Date().toISOString(),
    });
  }
}
