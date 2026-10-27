import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractRecord, ContractSummary, ExtractedClause, RiskFinding } from "../api/types";
import type { copy } from "../copy";
import type { UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { clauseDomId } from "../lib/resolve-citation";
import { ClauseSkeleton } from "./Skeleton";
import { CopyButton } from "./CopyButton";
import { ExpandableText } from "./ExpandableText";
import { fieldClass, linkBtn, pressable, tone } from "./ui";

type T = (typeof copy)[UiLocale];
type ClauseFilter = "all" | "critical" | "missing";

interface Props {
  t: T;
  locale: UiLocale;
  items: ContractSummary[];
  selected: ContractRecord | null;
  clauses: ExtractedClause[];
  findings: RiskFinding[];
  loadingClauses: boolean;
  loadingList: boolean;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
}

export function ContractPane({
  t, locale, items, selected, clauses, findings,
  loadingClauses, loadingList, onSelect, onUpload,
}: Props) {
  const corpus = items.filter((i) => i.source === "corpus");
  const uploads = items.filter((i) => i.source === "upload");
  const { focusedClauseId, flash } = useCitationFocus();
  const sourceRef = useRef<HTMLPreElement>(null);
  const focused = clauses.find((c) => c.id === focusedClauseId) ?? null;
  const [tab, setTab] = useState<"source" | "clauses">("source");
  const [filter, setFilter] = useState<ClauseFilter>("all");
  const [isDragging, setIsDragging] = useState(false);

  const criticalIds = useMemo(() => {
    return new Set(
      findings.filter((f) => !f.omitted && f.severity === "critical").map((f) => f.clauseId),
    );
  }, [findings]);
  const omissions = useMemo(() => findings.filter((f) => f.omitted), [findings]);
  const visibleClauses = useMemo(() => {
    if (filter === "critical") return clauses.filter((c) => criticalIds.has(c.id));
    if (filter === "missing") return [];
    return clauses;
  }, [clauses, criticalIds, filter]);

  useEffect(() => {
    if (!focusedClauseId) return;
    setTab("clauses");
    setFilter("all");
    const node = document.getElementById(clauseDomId(focusedClauseId));
    const motion = prefersReducedMotion() ? "auto" : "smooth";
    window.setTimeout(() => {
      node?.scrollIntoView({ behavior: motion, block: "center" });
      node?.classList.remove("clause-flash");
      void node?.offsetWidth;
      node?.classList.add("clause-flash");
    }, 30);
    const sourcePane = sourceRef.current?.parentElement;
    const mark = sourceRef.current?.querySelector("mark");
    if (sourcePane && mark) {
      const paneBox = sourcePane.getBoundingClientRect();
      const markBox = mark.getBoundingClientRect();
      sourcePane.scrollTop += markBox.top - paneBox.top - paneBox.height / 2 + markBox.height / 2;
    }
  }, [focusedClauseId, flash, focused]);

  return (
    <>
      {/* Pane header: contract selector */}
      <div className="ws-section-header shrink-0 flex-col items-stretch h-auto py-2.5 gap-2">
        <div className="flex items-center justify-between gap-2 w-full">
          <h2 className="text-[12px] font-semibold tracking-tight text-ink">{t.explorer}</h2>
          {selected?.highRisk ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.danger.box} ${tone.danger.text}`}>
              {t.highRisk}
            </span>
          ) : null}
        </div>

        {loadingList ? (
          <div className="h-8 w-full skeleton" />
        ) : (
          <label className="block w-full">
            <span className="sr-only">{t.selectContract}</span>
            <select
              className={`${fieldClass} mt-0 text-xs`}
              value={selected?.id ?? ""}
              onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
            >
              <option value="">{t.noContract}</option>
              <optgroup label={t.corpus}>
                {corpus.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.highRisk ? `risk ${c.title}` : c.title} ({c.language})
                  </option>
                ))}
              </optgroup>
              {uploads.length > 0 ? (
                <optgroup label={t.uploaded}>
                  {uploads.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        )}
      </div>

      {/* Metadata chips for selected contract */}
      {selected ? (
        <div className="flex flex-wrap gap-1.5 border-b border-divider px-3 py-2">
          <span className="meta-chip">{selected.language.toUpperCase()}</span>
          {selected.contractType ? <span className="meta-chip">{selected.contractType}</span> : null}
          {clauses.length > 0 ? <span className="meta-chip">{clauses.length} clauses</span> : null}
          {findings.length > 0 ? (
            <span className="meta-chip" style={{ borderColor: "#fca5a5", color: "#be123c", background: "#fff1f2" }}>
              {findings.filter(f => f.severity === "critical").length} critical
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Source / Clause tab bar */}
      <div className="pane-tabs shrink-0">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "source"}
          className="pane-tab"
          onClick={() => setTab("source")}
        >
          {t.original}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "clauses"}
          className="pane-tab"
          onClick={() => setTab("clauses")}
        >
          {t.clauses}
          {clauses.length > 0 ? (
            <span className="ms-1.5 rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {clauses.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* Tab content: scrollable */}
      <div className="ws-pane-scroll">
        {tab === "source" ? (
          <article className="p-3">
            <pre
              ref={sourceRef}
              className="contract-body whitespace-pre-wrap text-sm leading-7 text-ink"
              dir={selected?.language === "ar" || locale === "ar" ? "rtl" : "ltr"}
            >
              {selected ? (
                <HighlightedSource text={selected.text} focused={focused ?? null} />
              ) : (
                <span className="text-muted">{t.noContract}</span>
              )}
            </pre>
          </article>
        ) : (
          <article className="p-3" aria-busy={loadingClauses}>
            {/* Clause filter chips */}
            <div className="mb-3 flex flex-wrap gap-1.5" role="toolbar" aria-label={t.clauses}>
              <FilterChip pressed={filter === "all"} count={clauses.length} onClick={() => setFilter("all")} label={t.filterAll} />
              <FilterChip pressed={filter === "critical"} count={criticalIds.size} onClick={() => setFilter("critical")} label={t.filterCritical} />
              <FilterChip pressed={filter === "missing"} count={omissions.length} onClick={() => setFilter("missing")} label={t.filterMissing} />
            </div>

            {loadingClauses ? (
              <ClauseSkeleton />
            ) : filter === "missing" ? (
              omissions.length === 0 ? (
                <p className="text-sm text-muted">{t.noFilterMatches}</p>
              ) : (
                <ul className="space-y-2.5">
                  {omissions.map((f) => (
                    <li key={f.id} className={`rounded-lg p-3 ${tone.danger.box}`}>
                      <p className={`text-[10px] font-semibold tracking-wide uppercase ${tone.danger.text}`}>{t.omission}</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{t.category[f.category]}</p>
                      <p className={`mt-2 text-sm leading-relaxed ${tone.danger.text}`}>{t.omissionHint}</p>
                    </li>
                  ))}
                </ul>
              )
            ) : visibleClauses.length === 0 ? (
              <p className="text-sm text-muted">{clauses.length === 0 ? t.noContract : t.noFilterMatches}</p>
            ) : (
              <ul className="space-y-2">
                {visibleClauses.map((c) => (
                  <li
                    key={c.id}
                    id={clauseDomId(c.id)}
                    data-focused={focusedClauseId === c.id ? "true" : undefined}
                    className={`rounded-lg border p-2.5 transition duration-150 cursor-pointer ${
                      focusedClauseId === c.id
                        ? "border-accent bg-indigo-50/60 dark:bg-indigo-950/40"
                        : "border-line hover:border-line-strong hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <p className="text-[10px] font-semibold tracking-wide text-accent uppercase">{c.category}</p>
                      <CopyButton text={c.text} label={t.copyClause} copiedLabel={t.copied} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-ink">{c.heading || c.title}</p>
                    <div className="mt-1.5">
                      <ExpandableText
                        text={c.text}
                        more={t.expand}
                        less={t.collapse}
                        expanded={focusedClauseId === c.id}
                        className="text-xs leading-relaxed text-body"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )}

        {/* Upload dropzone */}
        <div className="border-t border-divider p-3">
          <label
            className={`dropzone block ${isDragging ? "border-accent bg-accent-subtle" : ""}`}
            data-drag={isDragging}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDrop={() => setIsDragging(false)}
          >
            <svg className="mx-auto mb-2 h-6 w-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[12px] font-semibold text-ink">{t.upload}</p>
            <p className="mt-1 text-[11px] text-muted">.txt or .md</p>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </>
  );
}

function FilterChip({ label, count, pressed, onClick }: { label: string; count: number; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className="filter-chip" aria-pressed={pressed} onClick={onClick}>
      {label}
      <span className="filter-count">{count}</span>
    </button>
  );
}

function HighlightedSource({ text, focused }: { text: string; focused: ExtractedClause | null }) {
  if (!focused || focused.spanEnd <= focused.spanStart || focused.spanEnd > text.length) {
    return text;
  }
  return (
    <>
      {text.slice(0, focused.spanStart)}
      <mark className="source-mark">{text.slice(focused.spanStart, focused.spanEnd)}</mark>
      {text.slice(focused.spanEnd)}
    </>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}