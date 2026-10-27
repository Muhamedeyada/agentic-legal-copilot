import { useState } from "react";
import type { RiskFinding, RiskSeverity } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { usePlaybookInspector } from "./PlaybookInspectorHost";
import { CopyButton } from "./CopyButton";
import { FindingSkeleton } from "./Skeleton";
import { focusRing, linkBtn, severityBadge, severityRail, tone } from "./ui";

type T = (typeof copy)[UiLocale];

const GROUPS: readonly RiskSeverity[] = ["critical", "high", "medium", "low"];

export function RiskBoard({ t, findings, loading }: { t: T; findings: RiskFinding[]; loading: boolean }) {
  const omissions = findings.filter((f) => f.omitted);
  const present = findings.filter((f) => !f.omitted);

  if (loading && findings.length === 0) {
    return (
      <div className="p-3">
        <FindingSkeleton />
      </div>
    );
  }
  if (findings.length === 0) {
    return <p className="p-4 text-sm text-muted">{t.emptyRisks}</p>;
  }

  return (
    <div className="space-y-4 p-3" aria-busy={loading}>
      {omissions.length > 0 ? (
        <section aria-label={t.filterMissing}>
          <GroupHeading label={t.filterMissing} count={omissions.length} className={tone.danger.text} />
          <ul className="space-y-1.5">
            {omissions.map((f) => (
              <RiskCard key={f.id} t={t} finding={f} />
            ))}
          </ul>
        </section>
      ) : null}
      {GROUPS.map((severity) => {
        const group = present.filter((f) => f.severity === severity);
        if (group.length === 0) return null;
        return (
          <section key={severity} aria-label={t.severity[severity]}>
            <GroupHeading label={t.severity[severity]} count={group.length} />
            <ul className="space-y-1.5">
              {group.map((f) => (
                <RiskCard key={f.id} t={t} finding={f} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function GroupHeading({ label, count, className = "text-muted" }: { label: string; count: number; className?: string }) {
  return (
    <h3 className={`mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase ${className}`}>
      {label}
      <span className="rounded-full bg-surface-sunken px-1.5 py-px text-[10px] tabular-nums text-muted">{count}</span>
    </h3>
  );
}

function RiskCard({ t, finding }: { t: T; finding: RiskFinding }) {
  const [open, setOpen] = useState(finding.severity === "critical" || finding.omitted);
  const { focusClauseId } = useCitationFocus();
  const { inspectFinding } = usePlaybookInspector();
  const badge = finding.omitted ? `${tone.danger.box} ${tone.danger.text}` : severityBadge[finding.severity];
  const label = finding.omitted ? t.omission : t.severity[finding.severity];

  return (
    <li
      className={`rounded-[0.6rem] border border-s-4 border-line bg-surface transition duration-150 hover:border-line-strong hover:shadow-sm dark:hover:shadow-black/30 ${severityRail[finding.omitted ? "critical" : finding.severity]}`}
    >
      <button
        type="button"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-e-[0.6rem] px-3 py-2.5 text-start select-none ${focusRing} focus-visible:ring-inset`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{t.category[finding.category]}</span>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${badge}`}>{label}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open ? (
        <div className="border-t border-divider px-3 pt-2 pb-2.5">
          <p className="text-[13px] leading-relaxed text-body">{finding.omitted ? t.omissionHint : finding.rationale}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" className={linkBtn} onClick={() => inspectFinding(finding)}>
              {t.inspectPlaybook}
            </button>
            {!finding.omitted ? (
              <button type="button" className={linkBtn} onClick={() => focusClauseId(finding.clauseId)}>
                {t.jumpToClause}
              </button>
            ) : null}
            <span className="ms-auto">
              <CopyButton
                text={`${t.category[finding.category]}\n${label}\n${finding.rationale}`}
                label={t.copy}
                copiedLabel={t.copied}
              />
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
