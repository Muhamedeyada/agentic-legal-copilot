import { useEffect, useMemo, useState } from "react";
import type { ContractRecord, ExtractedClause, RiskFinding } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { clauseDomId } from "../lib/resolve-citation";
import { highlightRiskPhrases } from "../lib/highlight-risk";
import { usePlaybookInspector } from "./PlaybookInspectorHost";
import { RedlineViewer } from "./RedlineViewer";
import { pressable, severityBadge, severityRail, severityRank } from "./ui";

type T = (typeof copy)[UiLocale];
type Mode = "document" | "redlines";

export function DocumentCanvas({
  t,
  locale,
  selected,
  clauses,
  findings,
  streaming,
}: {
  t: T;
  locale: UiLocale;
  selected: ContractRecord | null;
  clauses: ExtractedClause[];
  findings: RiskFinding[];
  streaming: boolean;
}) {
  const [mode, setMode] = useState<Mode>("document");
  const { focusedClauseId, flash } = useCitationFocus();
  const { inspectFinding } = usePlaybookInspector();

  const findingsByClause = useMemo(() => {
    const map = new Map<string, RiskFinding[]>();
    for (const f of findings) {
      if (f.omitted || f.severity === "low") continue;
      map.set(f.clauseId, [...(map.get(f.clauseId) ?? []), f]);
    }
    for (const list of map.values()) list.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
    return map;
  }, [findings]);

  useEffect(() => {
    if (!focusedClauseId) return;
    setMode("document");
    const timer = window.setTimeout(() => {
      const node = document.getElementById(clauseDomId(focusedClauseId));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      node?.classList.remove("clause-flash");
      void node?.offsetWidth;
      node?.classList.add("clause-flash");
    }, 30);
    return () => window.clearTimeout(timer);
  }, [focusedClauseId, flash]);

  const documentDir = selected?.language === "ar" ? "rtl" : "ltr";

  return (
    <>
      <div className="ws-section-header">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-ink">{selected?.title ?? t.noContract}</span>
          {streaming ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
              <span className="status-pulse inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {t.active}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 rounded-lg bg-surface-sunken p-0.5 text-[11px] font-semibold" role="tablist">
          {(["document", "redlines"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              disabled={m === "redlines" && findings.length === 0}
              className={`rounded-md px-2.5 py-1 ${pressable} ${
                mode === m ? "bg-surface text-ink shadow-sm" : "text-body enabled:hover:text-ink"
              }`}
              onClick={() => setMode(m)}
            >
              {m === "document" ? t.documentView : t.redlineView}
            </button>
          ))}
        </div>
      </div>

      <div className="ws-pane-scroll">
        {mode === "redlines" ? (
          <div className="mx-auto max-w-3xl p-4">
            <RedlineViewer t={t} locale={locale} findings={findings} clauses={clauses} />
          </div>
        ) : !selected ? (
          <p className="p-8 text-center text-sm text-muted">{t.noContract}</p>
        ) : (
          <article className="doc-canvas contract-body mx-auto max-w-3xl" dir={documentDir} lang={selected.language}>
            <h1 className="mb-6 text-lg font-semibold tracking-tight text-ink">{selected.title}</h1>
            {clauses.length === 0 ? (
              <pre className="whitespace-pre-wrap font-[inherit] text-[15px] leading-8 text-ink">{selected.text}</pre>
            ) : (
              <div className="space-y-1">
                {clauses.map((c) => (
                  <ClauseBlock
                    key={c.id}
                    t={t}
                    clause={c}
                    findings={findingsByClause.get(c.id) ?? []}
                    focused={focusedClauseId === c.id}
                    onInspect={inspectFinding}
                  />
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </>
  );
}

function ClauseBlock({
  t,
  clause,
  findings,
  focused,
  onInspect,
}: {
  t: T;
  clause: ExtractedClause;
  findings: RiskFinding[];
  focused: boolean;
  onInspect: (finding: RiskFinding) => void;
}) {
  const top = findings[0];
  const rail = top ? severityRail[top.severity] : "border-s-transparent";
  const heading = clause.heading.replace(/^#+\s*/, "") || clause.title;
  return (
    <section
      id={clauseDomId(clause.id)}
      dir={clause.language === "ar" ? "rtl" : clause.language === "en" ? "ltr" : undefined}
      lang={clause.language === "mixed" ? undefined : clause.language}
      aria-label={heading}
      className={`scroll-mt-14 rounded-e-lg border-s-4 py-2.5 ps-4 pe-2 transition-colors duration-150 ${rail} ${
        focused ? "bg-indigo-50/70 dark:bg-indigo-950/30" : top ? "hover:bg-surface-muted" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <h2 className="font-sans text-sm font-semibold text-ink">{heading}</h2>
        {findings.length > 0 ? (
          <div className="flex flex-wrap gap-1 font-sans">
            {findings.map((f) => (
              <button
                key={f.id}
                type="button"
                title={t.inspectPlaybook}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${pressable} ${severityBadge[f.severity]}`}
                onClick={() => onInspect(f)}
              >
                {t.severity[f.severity]} · {t.category[f.category]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-8 text-ink">
        {top ? <HighlightedClause text={clause.text} /> : clause.text}
      </p>
    </section>
  );
}

function HighlightedClause({ text }: { text: string }) {
  return (
    <>
      {highlightRiskPhrases(text).map((span, i) =>
        span.kind === "risk" ? (
          <mark key={i} className="risk-mark">
            {span.text}
          </mark>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}
