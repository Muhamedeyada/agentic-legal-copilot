import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReviewMemo, RiskFinding, WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { buildMemoMarkdown, downloadTextFile } from "../lib/export-memo";
import { CopyButton } from "./CopyButton";
import { PrintMemo } from "./PrintMemo";
import { CitationBadge } from "./CitationBadge";
import { Skeleton } from "./Skeleton";
import { Card, PaneTitle, fieldClass, ghostBtn } from "./ui";

type T = (typeof copy)[UiLocale];

interface Props {
  t: T;
  locale: UiLocale;
  snapshot: WorkflowSnapshot | null;
  contractTitle: string;
  findings: RiskFinding[];
  busy: boolean;
  drafting: boolean;
  onApprove: (counselId: string) => void;
  onReject: (counselId: string, reason: string) => void;
  onEditApprove: (counselId: string, body: string) => void;
}

export function CounselGate({
  t,
  locale,
  snapshot,
  contractTitle,
  findings,
  busy,
  drafting,
  onApprove,
  onReject,
  onEditApprove,
}: Props) {
  const [counselId, setCounselId] = useState("counsel-1");
  const [reason, setReason] = useState("");
  const [edited, setEdited] = useState("");
  const awaiting = snapshot?.state === "AWAITING_APPROVAL";
  const memo = snapshot?.memo;
  const approved = Boolean(snapshot?.state === "COMPLETED" && memo?.approvedByCounsel);

  useEffect(() => {
    if (!memo) {
      return;
    }
    const next = locale === "ar" ? (memo.bodyAr ?? memo.bodyEn ?? "") : (memo.bodyEn ?? memo.bodyAr ?? "");
    setEdited((prev) => (prev.trim().length === 0 ? next : prev));
  }, [memo, locale]);

  function exportMemo(): void {
    if (!snapshot || !memo || !memo.approvedByCounsel) {
      return;
    }
    const exportedAt = new Date().toISOString();
    const markdown = buildMemoMarkdown({
      snapshot,
      memo,
      contractTitle,
      counselId,
      exportedAt,
    });
    const safeId = snapshot.contractId.replace(/[^\w.-]+/g, "_");
    downloadTextFile(`${safeId}-approved-memo.md`, markdown);
  }

  return (
    <>
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PaneTitle>{t.memoTitle}</PaneTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <CopyButton text={edited} label={t.copyMemo} copiedLabel={t.copied} />
          <button type="button" disabled={!memo} className={ghostBtn} onClick={() => window.print()}>
            {t.printPdf}
          </button>
          <button type="button" disabled={!approved} className={ghostBtn} onClick={exportMemo}>
            {t.exportMemo}
          </button>
        </div>
      </div>
      {drafting && !memo ? (
        <div className="skeleton-bar mt-3" aria-hidden="true">
          <span className="skeleton-bar-fill" />
        </div>
      ) : null}
      {awaiting ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{t.awaitingHelp}</p>
      ) : approved ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{t.completed}</p>
      ) : snapshot?.rejectionReason ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {t.rejected}: {snapshot.rejectionReason}
        </p>
      ) : null}
      {drafting && !memo ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <MemoBody memo={memo} />
      )}
      <label className="mt-3 block text-[11px] font-semibold text-slate-600">
        {t.editBody}
        <textarea
          className={`${fieldClass} max-h-48 min-h-32 font-sans leading-relaxed`}
          rows={7}
          dir={locale === "ar" ? "rtl" : "ltr"}
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          placeholder={memo?.bodyEn ?? memo?.bodyAr ?? ""}
        />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-semibold text-slate-600">
          {t.counselId}
          <input className={fieldClass} value={counselId} onChange={(e) => setCounselId(e.target.value)} />
        </label>
        <label className="text-[11px] font-semibold text-slate-600">
          {t.rejectReason}
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!awaiting || busy}
          className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-emerald-700 disabled:opacity-40"
          onClick={() => onApprove(counselId)}
        >
          {t.approve}
        </button>
        <button
          type="button"
          disabled={!awaiting || busy || reason.trim().length === 0}
          className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-rose-700 disabled:opacity-40"
          onClick={() => onReject(counselId, reason)}
        >
          {t.reject}
        </button>
        <button
          type="button"
          disabled={!awaiting || busy || edited.trim().length === 0}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-indigo-950 disabled:opacity-40"
          onClick={() => onEditApprove(counselId, edited)}
        >
          {t.editApprove}
        </button>
      </div>
    </Card>
    {typeof document !== "undefined"
      ? createPortal(
          <PrintMemo
            t={t}
            locale={locale}
            snapshot={snapshot}
            contractTitle={contractTitle}
            counselId={counselId}
            findings={findings}
          />,
          document.body,
        )
      : null}
    </>
  );
}

function MemoBody({ memo }: { memo?: ReviewMemo }) {
  if (!memo || memo.citations.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {memo.citations.map((c, i) => (
        <CitationBadge
          key={c.id}
          index={i + 1}
          label={c.locator || c.id}
          hint={c.excerpt.slice(0, 120)}
          target={{ id: c.id, locator: c.locator, excerpt: c.excerpt, source: c.source }}
        />
      ))}
    </div>
  );
}
