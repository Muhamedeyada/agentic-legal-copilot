import type { ClauseCategory, ExtractedClause, RiskFinding } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { playbookText } from "../lib/playbook";
import { findClauseForCategory } from "../lib/resolve-citation";
import { diffWords, isStackedRedline } from "../lib/word-diff";
import { useCitationFocus } from "../citation-focus";
import { Card, PaneTitle } from "./ui";

type T = (typeof copy)[UiLocale];

export function RedlineViewer({
  t,
  locale,
  findings,
  clauses,
}: {
  t: T;
  locale: UiLocale;
  findings: RiskFinding[];
  clauses: ExtractedClause[];
}) {
  const { focusClauseId } = useCitationFocus();
  const ranked = pickDemoRedlines(findings);
  if (ranked.length === 0) {
    return null;
  }

  return (
    <Card>
      <PaneTitle>
        {t.redlines}
      </PaneTitle>
      <p className="mt-2 text-[11px] text-slate-500">
        <span className="redline-del mx-0.5">{t.diffDel}</span>
        <span className="redline-ins mx-0.5">{t.diffIns}</span>
      </p>
      <ul className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto">
        {ranked.map((finding) => {
          const clause =
            findClauseForCategory(finding.category, clauses) ??
            clauses.find((c) => c.id === finding.clauseId);
          const proposed = playbookText(finding.category, locale);
          const current = clause?.text ?? "";
          const tokens = current.trim().length === 0 ? [{ type: "ins" as const, text: proposed }] : diffWords(current, proposed);
          return (
            <li key={finding.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-indigo-900 uppercase">
                  {t.category[finding.category]}
                </p>
                {clause ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-indigo-900 underline-offset-2 hover:underline"
                    onClick={() => focusClauseId(clause.id)}
                  >
                    {t.jumpToClause}
                  </button>
                ) : null}
              </div>
              {isStackedRedline(tokens) ? (
                <div className="mt-2 space-y-2" dir={locale === "ar" ? "rtl" : "ltr"}>
                  <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{t.diffDel}</p>
                  <p className="text-sm leading-7">
                    <del className="redline-del">{tokens[0]?.text}</del>
                  </p>
                  <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{t.diffIns}</p>
                  <p className="text-sm leading-7">
                    <ins className="redline-ins">{tokens[1]?.text}</ins>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-7" dir={locale === "ar" ? "rtl" : "ltr"}>
                  {tokens.map((tok, i) => {
                    if (tok.type === "del") {
                      return (
                        <del key={i} className="redline-del">
                          {tok.text}
                        </del>
                      );
                    }
                    if (tok.type === "ins") {
                      return (
                        <ins key={i} className="redline-ins">
                          {tok.text}
                        </ins>
                      );
                    }
                    return <span key={i}>{tok.text}</span>;
                  })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const MATERIAL: ReadonlySet<ClauseCategory> = new Set([
  "liability",
  "indemnity",
  "termination",
  "jurisdiction",
  "confidentiality",
  "ip",
  "payment",
]);

function pickDemoRedlines(findings: readonly RiskFinding[]): RiskFinding[] {
  const material = findings.filter(
    (f) => !f.omitted && (MATERIAL.has(f.category) || f.severity === "critical"),
  );
  const byCategory = new Map<ClauseCategory, RiskFinding>();
  for (const finding of material) {
    const prev = byCategory.get(finding.category);
    if (!prev || rank(finding.severity) > rank(prev.severity)) {
      byCategory.set(finding.category, finding);
    }
  }
  return [...byCategory.values()].sort((a, b) => rank(b.severity) - rank(a.severity)).slice(0, 6);
}

function rank(s: RiskFinding["severity"]): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "medium") return 1;
  return 0;
}
