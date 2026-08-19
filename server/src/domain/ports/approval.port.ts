export interface ApprovalPort {
  isApproved(reviewId: string): Promise<boolean>;
  recordApproval(reviewId: string, counselId: string): Promise<void>;
}
