import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ExtractedClause, RiskFinding } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { findClauseForCategory } from "../lib/resolve-citation";
import { PlaybookInspector } from "./PlaybookInspector";
import { Toast } from "./Toast";

type T = (typeof copy)[UiLocale];

interface PlaybookInspectorApi {
  inspectFinding: (finding: RiskFinding) => void;
}

const PlaybookInspectorContext = createContext<PlaybookInspectorApi | null>(null);

export function PlaybookInspectorHost({
  t,
  locale,
  clauses,
  onApplyToMemo,
  children,
}: {
  t: T;
  locale: UiLocale;
  clauses: readonly ExtractedClause[];
  onApplyToMemo: (block: string) => "applied" | "duplicate";
  children: ReactNode;
}) {
  const [finding, setFinding] = useState<RiskFinding | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const inspectFinding = useCallback((next: RiskFinding) => {
    setFinding(next);
  }, []);

  const value = useMemo(() => ({ inspectFinding }), [inspectFinding]);

  const clause = finding
    ? (clauses.find((item) => item.id === finding.clauseId) ?? findClauseForCategory(finding.category, clauses))
    : undefined;

  async function copyReference(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.insetInlineStart = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setToast(t.copiedToast);
  }

  function apply(block: string): "applied" | "duplicate" {
    const result = onApplyToMemo(block);
    setToast(result === "duplicate" ? t.alreadyApplied : t.appliedToast);
    return result;
  }

  return (
    <PlaybookInspectorContext.Provider value={value}>
      {children}
      {finding ? (
        <PlaybookInspector
          t={t}
          locale={locale}
          finding={finding}
          clause={clause}
          onClose={() => setFinding(null)}
          onApply={apply}
          onCopy={(text) => copyReference(text)}
        />
      ) : null}
      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </PlaybookInspectorContext.Provider>
  );
}

export function usePlaybookInspector(): PlaybookInspectorApi {
  const ctx = useContext(PlaybookInspectorContext);
  if (!ctx) {
    throw new Error("usePlaybookInspector must be used within PlaybookInspectorHost");
  }
  return ctx;
}
