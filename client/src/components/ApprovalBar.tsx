import type { WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { approveTone, approvedBadge, btnSm, fieldClass, primaryTone, rejectTone, tone } from "./ui";

type T = (typeof copy)[UiLocale];

export function ApprovalBar({
  t,
  snapshot,
  busy,
  draft,
  reason,
  onReasonChange,
  onApprove,
  onReject,
  onEditApprove,
}: {
  t: T;
  snapshot: WorkflowSnapshot | null;
  busy: boolean;
  draft: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onEditApprove: () => void;
}) {
  const awaiting = snapshot?.state === "AWAITING_APPROVAL";
  const approved = snapshot?.state === "COMPLETED" && Boolean(snapshot.memo?.approvedByCounsel);
  const rejected = snapshot?.state === "COMPLETED" && Boolean(snapshot.rejectionReason);
  const failed = snapshot?.state === "FAILED";

  return (
    <div className="ws-action-bar space-y-2.5" aria-label={t.gate}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-widest text-muted uppercase">{t.gate}</span>
        {approved ? (
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${approvedBadge}`}>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
            {t.completed}
          </span>
        ) : rejected ? (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${tone.danger.box} ${tone.danger.text}`}>{t.rejected}</span>
        ) : failed ? (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${tone.danger.box} ${tone.danger.text}`}>{t.failed}</span>
        ) : awaiting ? (
          <span className={`gate-glow inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${tone.warning.box} ${tone.warning.text}`}>
            <span className="status-pulse inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.waiting}
          </span>
        ) : null}
      </div>

      {awaiting ? (
        <label className="block">
          <span className="sr-only">{t.rejectReason}</span>
          <input
            className={`${fieldClass} mt-0 py-1.5 text-xs`}
            value={reason}
            placeholder={t.rejectReason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </label>
      ) : (
        <p className="text-[11px] leading-snug text-muted">{approved || rejected || failed ? "" : t.gateLocked}</p>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" disabled={!awaiting || busy} className={`${approveTone} ${btnSm}`} onClick={onApprove}>
          {t.approve}
        </button>
        <button
          type="button"
          disabled={!awaiting || busy || reason.trim().length === 0}
          title={awaiting && reason.trim().length === 0 ? t.rejectReason : undefined}
          className={`${rejectTone} ${btnSm}`}
          onClick={onReject}
        >
          {t.reject}
        </button>
        <button
          type="button"
          disabled={!awaiting || busy || draft.trim().length === 0}
          className={`${primaryTone} ${btnSm}`}
          onClick={onEditApprove}
        >
          {t.editApprove}
        </button>
      </div>
    </div>
  );
}
