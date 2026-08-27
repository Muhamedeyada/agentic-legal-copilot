import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ExtractedClause, RiskFinding, RiskSeverity } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { highlightPlaybookPhrases, highlightRiskPhrases, type HighlightSpan } from "../lib/highlight-risk";
import { buildPlaybookInsert } from "../lib/playbook-insert";
import { playbookGuidance, playbookText, playbookTitle } from "../lib/playbook";
import { similarityPercent } from "../lib/token-overlap";

type T = (typeof copy)[UiLocale];

const severityClass: Record<RiskSeverity, string> = {
  critical: "bg-rose-600 text-white",
  high: "bg-rose-100 text-rose-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-emerald-100 text-emerald-800",
};

export function PlaybookInspector({
  t,
  locale,
  finding,
  clause,
  onClose,
  onApply,
  onCopy,
}: {
  t: T;
  locale: UiLocale;
  finding: RiskFinding;
  clause: ExtractedClause | undefined;
  onClose: () => void;
  onApply: (block: string) => "applied" | "duplicate";
  onCopy: (text: string) => Promise<void>;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [applied, setApplied] = useState(false);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const clauseLang = clause?.language === "ar" || clause?.language === "en" ? clause.language : locale;
  const golden = playbookText(finding.category, locale);
  const score =
    finding.omitted || !clause ? 0 : similarityPercent(clause.text, playbookText(finding.category, clauseLang));
  const contractText = clause?.text ?? "";
  const contractSpans = finding.omitted ? [] : highlightRiskPhrases(contractText);
  const playbookSpans = highlightPlaybookPhrases(golden);

  useEffect(() => {
    setApplied(false);
  }, [finding.id]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const root = panelRef.current;
      if (!root) {
        return;
      }
      const nodes = focusable(root);
      if (nodes.length === 0) {
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
      previous?.focus();
    };
  }, [onClose]);

  function apply(): void {
    const block = buildPlaybookInsert(t.redlineInsertHeading, t.category[finding.category], golden);
    const result = onApply(block);
    setApplied(result === "applied" || result === "duplicate");
  }

  return createPortal(
    <div className="inspector-layer print:hidden" dir={dir}>
      <button type="button" className="inspector-backdrop" aria-label={t.closeInspector} onClick={onClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="inspector-sheet"
      >
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                {t.inspectorKicker}
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                {t.category[finding.category]}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{playbookTitle(finding.category, locale)}</p>
            </div>
            <button ref={closeRef} type="button" className={ghostIcon} onClick={onClose} aria-label={t.closeInspector}>
              ×
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SimilarityMeter percent={score} label={t.similarity} hint={t.similarityHint} />
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${severityClass[finding.severity]}`}>
              {t.severity[finding.severity]}
            </span>
            {finding.omitted ? (
              <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
                {t.omission}
              </span>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="inspector-panes">
            <section className="inspector-pane" aria-label={t.contractPane}>
              <p className="inspector-pane-label">{t.contractPane}</p>
              {finding.omitted || !clause ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{t.missingClause}</p>
              ) : (
                <div className="contract-body mt-3 text-sm leading-7 text-slate-800">
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">{clause.heading}</p>
                  <p>
                    <HighlightedText spans={contractSpans} />
                  </p>
                </div>
              )}
              {finding.rationale ? (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {finding.rationale}
                </p>
              ) : null}
            </section>
            <section className="inspector-pane inspector-pane-playbook" aria-label={t.playbookPane}>
              <p className="inspector-pane-label">{t.playbookPane}</p>
              <div className="contract-body mt-3 text-sm leading-7 text-slate-800">
                <HighlightedText spans={playbookSpans} />
              </div>
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold tracking-wide text-emerald-800 uppercase">{t.fallback}</p>
                <p className="mt-1 text-sm leading-6 text-emerald-950">{golden}</p>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{t.guidance}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{playbookGuidance(finding.category, locale)}</p>
              </div>
            </section>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:border-slate-300 hover:bg-slate-50"
            onClick={() => void onCopy(golden)}
          >
            {t.copyReference}
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-indigo-950"
            onClick={apply}
          >
            {applied ? t.appliedPlaybook : t.applyPlaybook}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function SimilarityMeter({ percent, label, hint }: { percent: number; label: string; hint: string }) {
  const tone =
    percent < 20 ? "bg-rose-500" : percent < 45 ? "bg-amber-500" : "bg-emerald-500";
  const textTone = percent < 20 ? "text-rose-800" : percent < 45 ? "text-amber-800" : "text-emerald-800";
  return (
    <div className="min-w-[11rem] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" title={hint}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${textTone}`}>{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function HighlightedText({ spans }: { spans: readonly HighlightSpan[] }) {
  return (
    <>
      {spans.map((span, index) => {
        if (span.kind === "risk") {
          return (
            <mark key={index} className="risk-mark">
              {span.text}
            </mark>
          );
        }
        if (span.kind === "safe") {
          return (
            <mark key={index} className="playbook-mark">
              {span.text}
            </mark>
          );
        }
        return <span key={index}>{span.text}</span>;
      })}
    </>
  );
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, [href], textarea, input, select, [tabindex]:not([tabindex='-1'])")].filter(
    (node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true",
  );
}

const ghostIcon =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-lg leading-none text-slate-500 transition duration-150 hover:border-slate-300 hover:bg-slate-50";
