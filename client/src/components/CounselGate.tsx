import { useState } from "react";
import type { ReviewMemo, WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

interface Props {
  t: T;
  locale: UiLocale;
  snapshot: WorkflowSnapshot | null;
  busy: boolean;
  onApprove: (counselId: string) => void;
  onReject: (counselId: string, reason: string) => void;
  onEditApprove: (counselId: string, body: string) => void;
}

export function CounselGate({ t, locale, snapshot, busy, onApprove, onReject, onEditApprove }: Props) {
  const [counselId, setCounselId] = useState("counsel-1");
  const [reason, setReason] = useState("");
  const [edited, setEdited] = useState("");
  const awaiting = snapshot?.state === "AWAITING_APPROVAL";
  const memo = snapshot?.memo;

  return (
    <section className="border border-(--color-rule) bg-white p-4">
      <h2 className="text-sm font-semibold">{t.memoTitle}</h2>
      {awaiting ? (
        <p className="mt-2 text-sm text-stone-700">{t.awaitingHelp}</p>
      ) : snapshot?.state === "COMPLETED" && snapshot.memo?.approvedByCounsel ? (
        <p className="mt-2 text-sm font-medium">{t.completed}</p>
      ) : snapshot?.rejectionReason ? (
        <p className="mt-2 text-sm">{t.rejected}: {snapshot.rejectionReason}</p>
      ) : null}
      <MemoBody memo={memo} locale={locale} />
      <div className="mt-4 grid gap-3">
        <label className="text-xs font-medium">
          {t.counselId}
          <input
            className="mt-1 w-full rounded border border-(--color-rule) px-3 py-2 text-sm"
            value={counselId}
            onChange={(e) => setCounselId(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          {t.rejectReason}
          <textarea
            className="mt-1 w-full rounded border border-(--color-rule) px-3 py-2 text-sm"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          {t.editBody}
          <textarea
            className="mt-1 w-full rounded border border-(--color-rule) px-3 py-2 text-sm"
            rows={5}
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            placeholder={memo?.bodyEn ?? memo?.bodyAr ?? ""}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!awaiting || busy}
            className="rounded bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper) disabled:opacity-40"
            onClick={() => onApprove(counselId)}
          >
            {t.approve}
          </button>
          <button
            type="button"
            disabled={!awaiting || busy || reason.trim().length === 0}
            className="rounded border border-(--color-ink) px-4 py-2 text-sm disabled:opacity-40"
            onClick={() => onReject(counselId, reason)}
          >
            {t.reject}
          </button>
          <button
            type="button"
            disabled={!awaiting || busy || edited.trim().length === 0}
            className="rounded border border-(--color-accent) px-4 py-2 text-sm text-(--color-accent) disabled:opacity-40"
            onClick={() => onEditApprove(counselId, edited)}
          >
            {t.editApprove}
          </button>
        </div>
      </div>
    </section>
  );
}

function MemoBody({ memo, locale }: { memo?: ReviewMemo; locale: UiLocale }) {
  if (!memo) {
    return null;
  }
  const text = locale === "ar" ? (memo.bodyAr ?? memo.bodyEn) : (memo.bodyEn ?? memo.bodyAr);
  if (!text) {
    return null;
  }
  return (
    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap border border-(--color-rule) bg-(--color-paper) p-3 font-sans text-sm leading-relaxed">
      {text}
    </pre>
  );
}
