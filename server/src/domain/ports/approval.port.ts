export type ApprovalDecision = "pending" | "approved" | "rejected" | "edited";

export interface CounselEditedMemo {
  readonly bodyEn?: string;
  readonly bodyAr?: string;
}

export interface ApprovalRecord {
  readonly reviewId: string;
  readonly decision: ApprovalDecision;
  readonly counselId?: string;
  readonly reason?: string;
  readonly editedMemo?: CounselEditedMemo;
  readonly at: string;
}

export interface ApprovalPort {
  isApproved(reviewId: string): Promise<boolean>;
  recordApproval(reviewId: string, counselId: string): Promise<void>;
  reject(reviewId: string, counselId: string, reason: string): Promise<void>;
  editAndApprove(
    reviewId: string,
    counselId: string,
    editedMemo: CounselEditedMemo,
  ): Promise<void>;
  getRecord(reviewId: string): Promise<ApprovalRecord | undefined>;
}
