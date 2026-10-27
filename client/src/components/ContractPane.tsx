import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractRecord, ContractSummary, ExtractedClause, RiskFinding } from "../api/types";
import type { copy } from "../copy";
import type { UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { clauseDomId } from "../lib/resolve-citation";
import { ClauseSkeleton } from "./Skeleton";
import { CopyButton } from "./CopyButton";
import { ExpandableText } from "./ExpandableText";
import { Card, fieldClass, linkBtn, pressable, tone } from "./ui";

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
      <header className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">{t.explorer}</h2>
          {selected?.highRisk ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.danger.box} ${tone.danger.text}`}>
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
              className={`${fieldClass} bg-surface-muted`}
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
          <div className="flex rounded-lg bg-surface-sunken p-0.5 text-[11px] font-medium">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 ${pressable} ${tab === "source" ? "bg-surface text-ink shadow-sm" : "text-body hover:bg-surface/60 hover:text-ink"}`}
              onClick={() => setTab("source")}
            >
              {t.original}
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 ${pressable} ${tab === "clauses" ? "bg-surface text-ink shadow-sm" : "text-body hover:bg-surface/60 hover:text-ink"}`}
              onClick={() => setTab("clauses")}
            >
              {t.clauses}
            </button>
          </div>
          <label className={`cursor-pointer ${linkBtn} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500/70`}>
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
            className="contract-body whitespace-pre-wrap text-sm leading-7 text-ink"
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
          ) : loadingClauses ? null : visibleClauses.length === 0 ? (
            <p className="text-sm text-muted">{clauses.length === 0 ? t.noContract : t.noFilterMatches}</p>
          ) : (
            <ul className="space-y-2.5">
              {visibleClauses.map((c) => (
                <li
                  key={c.id}
                  id={clauseDomId(c.id)}
                  data-focused={focusedClauseId === c.id ? "true" : undefined}
                  className={`rounded-lg border p-3 transition duration-150 ${
                    focusedClauseId === c.id
                      ? "border-accent bg-indigo-50/60 dark:bg-indigo-950/40"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-wide text-accent uppercase">{c.category}</p>
                    <CopyButton text={c.text} label={t.copyClause} copiedLabel={t.copied} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">{c.heading || c.title}</p>
                  <div className="mt-2">
                    <ExpandableText
                      text={c.text}
                      more={t.expand}
                      less={t.collapse}
                      expanded={focusedClauseId === c.id}
                      className="text-sm leading-relaxed text-body"
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
