import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractRecord, ContractSummary, ExtractedClause, RiskFinding } from "../api/types";
import type { copy } from "../copy";
import type { UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { clauseDomId } from "../lib/resolve-citation";
import { ClauseSkeleton } from "./Skeleton";
import { CopyButton } from "./CopyButton";
import { ExpandableText } from "./ExpandableText";
import { Card, fieldClass } from "./ui";

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
  t,
  locale,
  items,
  selected,
  clauses,
  findings,
  loadingClauses,
  loadingList,
  onSelect,
  onUpload,
}: Props) {
  const corpus = items.filter((i) => i.source === "corpus");
  const uploads = items.filter((i) => i.source === "upload");
  const { focusedClauseId, flash } = useCitationFocus();
  const sourceRef = useRef<HTMLPreElement>(null);
  const focused = clauses.find((c) => c.id === focusedClauseId) ?? null;
  const [tab, setTab] = useState<"source" | "clauses">("source");
  const [filter, setFilter] = useState<ClauseFilter>("all");

  const criticalIds = useMemo(() => {
    return new Set(
      findings.filter((f) => !f.omitted && f.severity === "critical").map((f) => f.clauseId),
    );
  }, [findings]);
  const omissions = useMemo(() => findings.filter((f) => f.omitted), [findings]);
  const visibleClauses = useMemo(() => {
    if (filter === "critical") {
      return clauses.filter((c) => criticalIds.has(c.id));
    }
    if (filter === "missing") {
      return [];
    }
    return clauses;
  }, [clauses, criticalIds, filter]);

  useEffect(() => {
    if (!focusedClauseId) {
      return;
    }
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
    <Card padded={false} className="flex min-h-[420px] flex-col overflow-hidden lg:min-h-0 lg:h-full">
      <header className="shrink-0 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold tracking-tight text-slate-900">{t.explorer}</h2>
          {selected?.highRisk ? (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              {t.highRisk}
            </span>
          ) : null}
        </div>
        {loadingList ? (
          <div className="mt-3 h-10 skeleton" />
        ) : (
          <label className="mt-3 block">
            <span className="sr-only">{t.selectContract}</span>
            <select
              className={`${fieldClass} bg-slate-50`}
              value={selected?.id ?? ""}
              onChange={(e) => {
                if (e.target.value) {
                  onSelect(e.target.value);
                }
              }}
            >
              <option value="">{t.noContract}</option>
              <optgroup label={t.corpus}>
                {corpus.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.highRisk ? `⚠ ${c.title}` : c.title} ({c.language})
                  </option>
                ))}
              </optgroup>
              {uploads.length > 0 ? (
                <optgroup label={t.uploaded}>
                  {uploads.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 transition duration-150 ${tab === "source" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              onClick={() => setTab("source")}
            >
              {t.original}
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 transition duration-150 ${tab === "clauses" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              onClick={() => setTab("clauses")}
            >
              {t.clauses}
            </button>
          </div>
          <label className="cursor-pointer text-[11px] font-semibold text-indigo-900 underline-offset-2 hover:underline">
            {t.upload}
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUpload(file);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>
      {tab === "source" ? (
        <article className="min-h-0 flex-1 overflow-y-auto p-4">
          <pre
            ref={sourceRef}
            className="contract-body whitespace-pre-wrap text-sm leading-7 text-slate-800"
            dir={selected?.language === "ar" || locale === "ar" ? "rtl" : "ltr"}
          >
            {selected ? <HighlightedSource text={selected.text} focused={focused ?? null} /> : t.noContract}
          </pre>
        </article>
      ) : (
        <article className="min-h-0 flex-1 overflow-y-auto p-4" aria-busy={loadingClauses}>
          <div className="mb-3 flex flex-wrap gap-1.5" role="toolbar" aria-label={t.clauses}>
            <FilterChip
              pressed={filter === "all"}
              count={clauses.length}
              onClick={() => setFilter("all")}
              label={t.filterAll}
            />
            <FilterChip
              pressed={filter === "critical"}
              count={criticalIds.size}
              onClick={() => setFilter("critical")}
              label={t.filterCritical}
            />
            <FilterChip
              pressed={filter === "missing"}
              count={omissions.length}
              onClick={() => setFilter("missing")}
              label={t.filterMissing}
            />
          </div>
          {loadingClauses ? (
            <ClauseSkeleton />
          ) : filter === "missing" ? (
            omissions.length === 0 ? (
              <p className="text-sm text-slate-500">{t.noFilterMatches}</p>
            ) : (
              <ul className="space-y-2.5">
                {omissions.map((f) => (
                  <li key={f.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-[10px] font-semibold tracking-wide text-rose-800 uppercase">{t.omission}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{t.category[f.category]}</p>
                    <p className="mt-2 text-sm leading-relaxed text-rose-800">{t.omissionHint}</p>
                  </li>
                ))}
              </ul>
            )
          ) : loadingClauses ? null : visibleClauses.length === 0 ? (
            <p className="text-sm text-slate-500">{clauses.length === 0 ? t.noContract : t.noFilterMatches}</p>
          ) : (
            <ul className="space-y-2.5">
              {visibleClauses.map((c) => (
                <li
                  key={c.id}
                  id={clauseDomId(c.id)}
                  data-focused={focusedClauseId === c.id ? "true" : undefined}
                  className={`rounded-lg border p-3 transition duration-150 ${
                    focusedClauseId === c.id
                      ? "border-indigo-900 bg-indigo-50/60"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-wide text-indigo-900 uppercase">{c.category}</p>
                    <CopyButton text={c.text} label={t.copyClause} copiedLabel={t.copied} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{c.heading || c.title}</p>
                  <div className="mt-2">
                    <ExpandableText
                      text={c.text}
                      more={t.expand}
                      less={t.collapse}
                      expanded={focusedClauseId === c.id}
                      className="text-sm leading-relaxed text-slate-600"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </Card>
  );
}

function FilterChip({
  label,
  count,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
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
