import type {
  ApprovalDecision,
  ApprovalPort,
  ApprovalRecord,
  CounselEditedMemo,
} from "../../domain/ports/approval.port.js";
import type { SqliteDatabase } from "../sqlite/database.js";

interface ApprovalRow {
  review_id: string;
  decision: ApprovalDecision;
  counsel_id: string | null;
  reason: string | null;
  edited_memo: string | null;
  at: string;
}

export interface ApprovalAuditEntry extends ApprovalRecord {
  readonly id: number;
}

/**
 * Counsel decisions. `approvals` holds the current decision per review; `approval_audit` keeps
 * every decision ever recorded and is never updated or deleted.
 */
export class SqliteApprovalStoreAdapter implements ApprovalPort {
  private readonly writeTx;
  private readonly selectOne;
  private readonly selectAudit;

  constructor(db: SqliteDatabase) {
    const upsert = db.prepare(`
      INSERT INTO approvals (review_id, decision, counsel_id, reason, edited_memo, at)
      VALUES (@review_id, @decision, @counsel_id, @reason, @edited_memo, @at)
      ON CONFLICT (review_id) DO UPDATE SET
        decision = excluded.decision, counsel_id = excluded.counsel_id, reason = excluded.reason,
        edited_memo = excluded.edited_memo, at = excluded.at`);
    const audit = db.prepare(`
      INSERT INTO approval_audit (review_id, decision, counsel_id, reason, edited_memo, at)
      VALUES (@review_id, @decision, @counsel_id, @reason, @edited_memo, @at)`);
    this.writeTx = db.transaction((row: ApprovalRow) => {
      upsert.run(row);
      audit.run(row);
    });
    this.selectOne = db.prepare("SELECT * FROM approvals WHERE review_id = ?");
    this.selectAudit = db.prepare("SELECT * FROM approval_audit WHERE review_id = ? ORDER BY id");
  }

  async isApproved(reviewId: string): Promise<boolean> {
    const decision = (await this.getRecord(reviewId))?.decision;
    return decision === "approved" || decision === "edited";
  }

  async recordApproval(reviewId: string, counselId: string): Promise<void> {
    this.write(reviewId, "approved", counselId);
  }

  async reject(reviewId: string, counselId: string, reason: string): Promise<void> {
    this.write(reviewId, "rejected", counselId, reason);
  }

  async editAndApprove(reviewId: string, counselId: string, editedMemo: CounselEditedMemo): Promise<void> {
    this.write(reviewId, "edited", counselId, undefined, editedMemo);
  }

  async getRecord(reviewId: string): Promise<ApprovalRecord | undefined> {
    const row = this.selectOne.get(reviewId) as ApprovalRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  async auditTrail(reviewId: string): Promise<readonly ApprovalAuditEntry[]> {
    return (this.selectAudit.all(reviewId) as Array<ApprovalRow & { id: number }>).map((row) => ({
      id: row.id,
      ...fromRow(row),
    }));
  }

  private write(
    reviewId: string,
    decision: ApprovalDecision,
    counselId: string,
    reason?: string,
    editedMemo?: CounselEditedMemo,
  ): void {
    this.writeTx({
      review_id: reviewId,
      decision,
      counsel_id: counselId,
      reason: reason ?? null,
      edited_memo: editedMemo ? JSON.stringify(editedMemo) : null,
      at: new Date().toISOString(),
    });
  }
}

function fromRow(row: ApprovalRow): ApprovalRecord {
  return {
    reviewId: row.review_id,
    decision: row.decision,
    at: row.at,
    ...(row.counsel_id !== null ? { counselId: row.counsel_id } : {}),
    ...(row.reason !== null ? { reason: row.reason } : {}),
    ...(row.edited_memo !== null ? { editedMemo: JSON.parse(row.edited_memo) as CounselEditedMemo } : {}),
  };
}
