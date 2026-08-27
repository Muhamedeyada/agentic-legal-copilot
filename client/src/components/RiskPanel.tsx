import { useMemo, useState } from "react";
import type { RiskFinding } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { CopyButton } from "./CopyButton";
import { ExpandableText } from "./ExpandableText";
import { FindingSkeleton } from "./Skeleton";
import { Card, PaneTitle } from "./ui";
import { usePlaybookInspector } from "./PlaybookInspectorHost";

type T = (typeof copy)[UiLocale];
type RiskFilter = "all" | "critical" | "high" | "medium" | "omitted";

const badge: Record<RiskFinding["severity"], string> = {
  critical: "bg-rose-600 text-white",
  high: "bg-rose-100 text-rose-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-emerald-100 text-emerald-800",
};

export function RiskPanel({
  t,
  findings,
  loading,
}: {
  t: T;
  findings: RiskFinding[];
  loading: boolean;
}) {
  const { focusClauseId } = useCitationFocus();
  const { inspectFinding } = usePlaybookInspector();
  const [filter, setFilter] = useState<RiskFilter>("all");
  const counts = useMemo(
    () => ({
      all: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      omitted: findings.filter((f) => f.omitted).length,
    }),
    [findings],
  );
  const ranked = useMemo(() => {
    const list = [...findings].sort((a, b) => rank(b.severity) - rank(a.severity));
    if (filter === "omitted") {
      return list.filter((f) => f.omitted);
    }
    if (filter === "all") {
      return list;
    }
    return list.filter((f) => f.severity === filter);
  }, [findings, filter]);

  return (
    <Card aria-busy={loading}>
      <PaneTitle>{t.risks}</PaneTitle>
      {loading ? (
        <div className="skeleton-bar mt-3" aria-hidden="true">
          <span className="skeleton-bar-fill" />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5" role="toolbar" aria-label={t.risks}>
        <FilterChip label={t.filterAll} count={counts.all} pressed={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip
          label={t.severity.critical}
          count={counts.critical}
          pressed={filter === "critical"}
          onClick={() => setFilter("critical")}
        />
        <FilterChip
          label={t.severity.high}
          count={counts.high}
          pressed={filter === "high"}
          onClick={() => setFilter("high")}
        />
        <FilterChip
          label={t.severity.medium}
          count={counts.medium}
          pressed={filter === "medium"}
          onClick={() => setFilter("medium")}
        />
        <FilterChip
          label={t.filterMissing}
          count={counts.omitted}
          pressed={filter === "omitted"}
          onClick={() => setFilter("omitted")}
        />
      </div>
      {counts.omitted > 0 && filter !== "omitted" ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5" role="alert">
          <p className="text-sm font-semibold text-rose-800">{t.omission}</p>
          <p className="mt-1 text-xs text-rose-700">{t.omissionHint}</p>
        </div>
      ) : null}
      {loading && findings.length === 0 ? (
        <FindingSkeleton />
      ) : (
        <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
          {ranked.length === 0 ? (
            <li className="text-sm text-slate-500">
              {findings.length === 0 ? t.emptyRisks : t.noFilterMatches}
            </li>
          ) : (
            ranked.map((f) => (
              <li
                key={f.id}
                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-slate-200 p-3 transition duration-150 hover:border-indigo-300 hover:bg-slate-50/80 sm:flex-row sm:items-start sm:justify-between"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) {
                    return;
                  }
                  inspectFinding(f);
                }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{t.category[f.category]}</p>
                    <CopyButton
                      text={`${t.category[f.category]}\n${t.severity[f.severity]}\n${f.rationale}`}
                      label={t.copy}
                      copiedLabel={t.copied}
                    />
                  </div>
                  <div className="mt-1">
                    <ExpandableText
                      text={f.rationale}
                      more={t.expand}
                      less={t.collapse}
                      className="text-sm leading-relaxed text-slate-600"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-indigo-900 underline-offset-2 hover:underline"
                      onClick={() => inspectFinding(f)}
                    >
                      {t.inspectPlaybook}
                    </button>
                    {!f.omitted ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-indigo-900 underline-offset-2 hover:underline"
                        onClick={() => focusClauseId(f.clauseId)}
                      >
                        {t.jumpToClause}
                      </button>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`inline-flex h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge[f.severity]}`}
                >
                  {t.severity[f.severity]}
                </span>
              </li>
            ))
          )}
        </ul>
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

function rank(s: RiskFinding["severity"]): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "medium") return 1;
  return 0;
}
