import { useMemo, useState, type DragEvent } from "react";
import type { ContractRecord, ContractSummary, ExtractedClause, RiskFinding, RiskSeverity } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { useCitationFocus } from "../citation-focus";
import { fieldClass, focusRing, severityBadge, severityRank, tone } from "./ui";

type T = (typeof copy)[UiLocale];

const ACCEPTED = /\.(txt|md|markdown)$/i;

const dotClass: Record<RiskSeverity, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-slate-300 dark:bg-slate-600",
};

export function worstSeverity(findings: readonly RiskFinding[]): RiskSeverity | null {
  return findings.reduce<RiskSeverity | null>(
    (worst, f) => (worst === null || severityRank[f.severity] > severityRank[worst] ? f.severity : worst),
    null,
  );
}

export function DocumentNavigator({
  t,
  items,
  selected,
  clauses,
  findings,
  loadingList,
  loadingClauses,
  onSelect,
  onUpload,
}: {
  t: T;
  items: ContractSummary[];
  selected: ContractRecord | null;
  clauses: readonly ExtractedClause[];
  findings: readonly RiskFinding[];
  loadingList: boolean;
  loadingClauses: boolean;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
}) {
  const { focusedClauseId, focusClauseId } = useCitationFocus();
  const corpus = items.filter((i) => i.source === "corpus");
  const uploads = items.filter((i) => i.source === "upload");
  const omissions = findings.filter((f) => f.omitted);
  const worst = worstSeverity(findings);

  const severityByClause = useMemo(() => {
    const map = new Map<string, RiskSeverity>();
    for (const f of findings) {
      const prev = map.get(f.clauseId);
      if (!f.omitted && (!prev || severityRank[f.severity] > severityRank[prev])) {
        map.set(f.clauseId, f.severity);
      }
    }
    return map;
  }, [findings]);

  return (
    <>
      <div className="shrink-0 space-y-2.5 border-b border-divider p-3">
        <h2 className="text-[11px] font-bold tracking-widest text-muted uppercase">{t.explorer}</h2>
        {loadingList ? (
          <div className="skeleton h-9 w-full" />
        ) : (
          <label className="block">
            <span className="sr-only">{t.selectContract}</span>
            <select
              className={`${fieldClass} mt-0 text-xs`}
              value={selected?.id ?? ""}
              onChange={(e) => {
                if (e.target.value) onSelect(e.target.value);
              }}
            >
              <option value="">{t.noContract}</option>
              <optgroup label={t.corpus}>
                {corpus.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.highRisk ? "⚠ " : ""}
                    {c.title} ({c.language.toUpperCase()})
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

        {selected ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.contractType ? <span className="meta-chip">{selected.contractType}</span> : null}
            <span className="meta-chip">{selected.language === "ar" ? "AR · RTL" : "EN · LTR"}</span>
            {worst ? (
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadge[worst]}`}>
                {t.severity[worst]}
                <span className="tabular-nums opacity-80">
                  · {findings.filter((f) => f.severity === worst).length}
                </span>
              </span>
            ) : selected.highRisk ? (
              <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${tone.danger.box} ${tone.danger.text}`}>
                {t.highRisk}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="ws-pane-scroll">
        <nav aria-label={t.clauseIndex} className="py-2">
          <p className="flex items-center justify-between px-3.5 pb-1.5 text-[10px] font-bold tracking-widest text-muted uppercase">
            <span>{t.clauseIndex}</span>
            {clauses.length > 0 ? (
              <span className="tabular-nums">
                {clauses.length} {t.clausesUnit}
              </span>
            ) : null}
          </p>
          {loadingClauses ? (
            <div className="space-y-1.5 px-3.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-6 w-full" />
              ))}
            </div>
          ) : clauses.length === 0 ? (
            <p className="px-3.5 text-xs leading-relaxed text-muted">{selected ? t.emptyRisks : t.noContract}</p>
          ) : (
            <ol>
              {clauses.map((c, index) => {
                const severity = severityByClause.get(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`clause-nav-item w-full text-start ${focusRing} focus-visible:ring-inset`}
                      data-active={focusedClauseId === c.id}
                      dir={c.language === "ar" ? "rtl" : "ltr"}
                      onClick={() => focusClauseId(c.id)}
                    >
                      <span className="w-5 shrink-0 text-[10px] font-semibold tabular-nums text-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink">{c.heading.replace(/^#+\s*/, "") || c.title}</span>
                      {severity && severity !== "low" ? (
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[severity]}`} title={t.severity[severity]} />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </nav>

        {omissions.length > 0 ? (
          <div className="px-3 pb-3">
            <div className={`rounded-lg p-2.5 ${tone.danger.box}`} role="note">
              <p className={`text-[10px] font-bold tracking-widest uppercase ${tone.danger.text}`}>{t.filterMissing}</p>
              <ul className="mt-1.5 space-y-0.5">
                {omissions.map((f) => (
                  <li key={f.id} className={`text-xs font-semibold ${tone.danger.text}`}>
                    {t.category[f.category]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-divider p-3">
        <UploadDropzone t={t} onUpload={onUpload} />
      </div>
    </>
  );
}

function UploadDropzone({ t, onUpload }: { t: T; onUpload: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | undefined): void {
    if (!file) return;
    if (!ACCEPTED.test(file.name)) {
      setError(t.dropInvalid);
      return;
    }
    setError(null);
    onUpload(file);
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  return (
    <>
      <label
        className="dropzone block has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500/70"
        data-drag={dragging}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <svg className="mx-auto mb-1.5 h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-xs font-semibold text-ink">{t.upload}</p>
        <p className="mt-0.5 text-[11px] text-muted">{t.dropHint}</p>
        <input
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          className="sr-only"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}
