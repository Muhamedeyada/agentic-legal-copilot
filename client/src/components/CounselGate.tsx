import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { LiveMemo, ReviewMemo, RiskFinding, WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { buildMemoMarkdown, downloadTextFile } from "../lib/export-memo";
import { mergeMemoWithInserts } from "../lib/playbook-insert";
import { CopyButton } from "./CopyButton";
import { PrintMemo } from "./PrintMemo";
import { CitationBadge } from "./CitationBadge";
import { Skeleton } from "./Skeleton";
import { Card, PaneTitle, fieldClass, ghostBtn, tone } from "./ui";

type T = (typeof copy)[UiLocale];

interface Props {
  t: T;
  locale: UiLocale;
  snapshot: WorkflowSnapshot | null;
  contractTitle: string;
  findings: RiskFinding[];
  drafting: boolean;
  liveMemo: LiveMemo;
  draft: string;
  onDraftChange: Dispatch<SetStateAction<string>>;
  draftPulse: number;
  counselId: string;
  onCounselIdChange: (value: string) => void;
}

export function CounselGate({
  t,
  locale,
  snapshot,
  contractTitle,
  findings,
  drafting,
  liveMemo,
  draft,
  onDraftChange,
  draftPulse,
  counselId,
  onCounselIdChange,
}: Props) {
  const [draftFlash, setDraftFlash] = useState(false);
  const awaiting = snapshot?.state === "AWAITING_APPROVAL";
  const memo = snapshot?.memo;
  const approved = Boolean(snapshot?.state === "COMPLETED" && memo?.approvedByCounsel);

  useEffect(() => {
    if (!memo) {
      return;
    }
    const next = locale === "ar" ? (memo.bodyAr ?? memo.bodyEn ?? "") : (memo.bodyEn ?? memo.bodyAr ?? "");
    onDraftChange((prev) => mergeMemoWithInserts(next, prev, t.redlineInsertHeading));
  }, [memo, locale, onDraftChange, t.redlineInsertHeading]);

  useEffect(() => {
    if (draftPulse === 0) {
      return;
    }
    setDraftFlash(true);
    const id = window.setTimeout(() => setDraftFlash(false), 1100);
    return () => window.clearTimeout(id);
  }, [draftPulse]);

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
          <CopyButton text={draft} label={t.copyMemo} copiedLabel={t.copied} />
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
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${tone.warning.box} ${tone.warning.text}`}>{t.awaitingHelp}</p>
      ) : approved ? (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${tone.success.box} ${tone.success.text}`}>{t.completed}</p>
      ) : snapshot?.rejectionReason ? (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${tone.danger.box} ${tone.danger.text}`}>
          {t.rejected}: {snapshot.rejectionReason}
        </p>
      ) : null}
      {drafting && !memo ? (
        <LiveDraft t={t} locale={locale} liveMemo={liveMemo} />
      ) : (
        <MemoBody memo={memo} />
      )}
      <label className="mt-3 block text-[11px] font-semibold text-body">
        {t.editBody}
        <textarea
          id="counsel-memo-draft"
          className={`${fieldClass} max-h-48 min-h-32 font-sans leading-relaxed ${draftFlash ? "clause-flash" : ""}`}
          rows={7}
          dir={locale === "ar" ? "rtl" : "ltr"}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={memo?.bodyEn ?? memo?.bodyAr ?? ""}
        />
      </label>
      <label className="mt-3 block text-[11px] font-semibold text-body">
        {t.counselId}
        <input className={fieldClass} value={counselId} onChange={(e) => onCounselIdChange(e.target.value)} />
      </label>
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

function LiveDraft({ t, locale, liveMemo }: { t: T; locale: UiLocale; liveMemo: LiveMemo }) {
  const scroller = useRef<HTMLDivElement>(null);
  const preferAr = locale === "ar" ? liveMemo.bodyAr.length > 0 : liveMemo.bodyEn.length === 0;
  const text = preferAr ? liveMemo.bodyAr : liveMemo.bodyEn;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  if (text.length === 0) {
    return (
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3" aria-busy="true">
      <p role="status" className="text-[10px] font-bold tracking-widest text-muted uppercase">
        {t.memoStreaming}
      </p>
      <div
        ref={scroller}
        dir={preferAr ? "rtl" : "ltr"}
        className="mt-1.5 max-h-72 overflow-y-auto font-sans text-xs leading-relaxed whitespace-pre-wrap text-ink"
      >
        {text}
        <span className="typing-caret" aria-hidden="true" />
      </div>
    </div>
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
