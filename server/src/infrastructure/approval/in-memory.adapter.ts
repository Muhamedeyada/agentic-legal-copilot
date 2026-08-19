import type { ApprovalPort } from "../../domain/ports/approval.port.js";

export class InMemoryApprovalAdapter implements ApprovalPort {
  private readonly approved = new Set<string>();

  async isApproved(reviewId: string): Promise<boolean> {
    return this.approved.has(reviewId);
  }

  async recordApproval(reviewId: string, _counselId: string): Promise<void> {
    this.approved.add(reviewId);
  }
}
