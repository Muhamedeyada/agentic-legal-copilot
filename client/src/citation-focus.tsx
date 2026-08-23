import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ExtractedClause } from "./api/types";
import { resolveClauseId, type CitationTarget } from "./lib/resolve-citation";

interface CitationFocusValue {
  focusedClauseId: string | null;
  flash: number;
  focusTarget: (target: CitationTarget) => void;
  focusClauseId: (clauseId: string) => void;
}

const CitationFocusContext = createContext<CitationFocusValue | null>(null);

export function CitationFocusProvider({
  clauses,
  children,
}: {
  clauses: readonly ExtractedClause[];
  children: ReactNode;
}) {
  const [focusedClauseId, setFocusedClauseId] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);

  const focusClauseId = useCallback((clauseId: string) => {
    setFocusedClauseId(clauseId);
    setFlash((n) => n + 1);
  }, []);

  const focusTarget = useCallback(
    (target: CitationTarget) => {
      const id = resolveClauseId(target, clauses);
      if (id) {
        focusClauseId(id);
      }
    },
    [clauses, focusClauseId],
  );

  const value = useMemo(
    () => ({ focusedClauseId, flash, focusTarget, focusClauseId }),
    [focusedClauseId, flash, focusTarget, focusClauseId],
  );

  return <CitationFocusContext.Provider value={value}>{children}</CitationFocusContext.Provider>;
}

export function useCitationFocus(): CitationFocusValue {
  const ctx = useContext(CitationFocusContext);
  if (!ctx) {
    throw new Error("useCitationFocus must be used within CitationFocusProvider");
  }
  return ctx;
}
