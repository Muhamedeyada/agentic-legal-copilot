import type { RiskFinding } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

const badge: Record<RiskFinding["severity"], string> = {
  critical: "bg-(--color-accent) text-white",
  high: "bg-orange-800 text-white",
  medium: "bg-amber-200 text-stone-900",
  low: "bg-stone-200 text-stone-800",
};

export function RiskPanel({ t, findings }: { t: T; findings: RiskFinding[] }) {
  const omissions = findings.filter((f) => f.omitted);
  const ranked = [...findings].sort((a, b) => rank(b.severity) - rank(a.severity));

  return (
    <section className="border border-(--color-rule) bg-white p-4">
      <h2 className="text-sm font-semibold">{t.risks}</h2>
      {omissions.length > 0 ? (
        <div className="mt-3 border border-(--color-accent) bg-(--color-paper) p-3" role="alert">
          <p className="text-sm font-semibold text-(--color-accent)">{t.omission}</p>
          <p className="mt-1 text-xs text-stone-700">{t.omissionHint}</p>
          <ul className="mt-2 list-disc ps-5 text-sm">
            {omissions.map((f) => (
              <li key={f.id}>{t.category[f.category]}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="mt-4 space-y-2">
        {ranked.map((f) => (
          <li key={f.id} className="flex flex-col gap-1 border border-(--color-rule) p-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">{t.category[f.category]}</p>
              <p className="mt-1 text-sm text-stone-700">{f.rationale}</p>
            </div>
            <span className={`mt-2 inline-flex h-fit shrink-0 rounded px-2 py-1 text-xs font-semibold sm:mt-0 ${badge[f.severity]}`}>
              {t.severity[f.severity]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function rank(s: RiskFinding["severity"]): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "medium") return 1;
  return 0;
}
