import type { RiskFinding } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { FindingSkeleton } from "./Skeleton";
import { Card, PaneTitle } from "./ui";

type T = (typeof copy)[UiLocale];

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
  const omissions = findings.filter((f) => f.omitted);
  const ranked = [...findings].sort((a, b) => rank(b.severity) - rank(a.severity));

  return (
    <Card>
      <PaneTitle>{t.risks}</PaneTitle>
      {omissions.length > 0 ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5" role="alert">
          <p className="text-sm font-semibold text-rose-800">{t.omission}</p>
          <p className="mt-1 text-xs text-rose-700">{t.omissionHint}</p>
          <ul className="mt-2 list-disc ps-5 text-sm text-rose-900">
            {omissions.map((f) => (
              <li key={f.id}>{t.category[f.category]}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {loading && findings.length === 0 ? (
        <FindingSkeleton />
      ) : (
        <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
          {ranked.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 transition duration-150 hover:border-slate-300 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.category[f.category]}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.rationale}</p>
                {!f.omitted ? (
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-semibold text-indigo-900 underline-offset-2 hover:underline"
                    onClick={() => focusClauseId(f.clauseId)}
                  >
                    {t.jumpToClause}
                  </button>
                ) : null}
              </div>
              <span
                className={`inline-flex h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge[f.severity]}`}
              >
                {t.severity[f.severity]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function rank(s: RiskFinding["severity"]): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "medium") return 1;
  return 0;
}
