import type { ClauseCategory, ExtractedClause } from "../api/types";

export interface CitationTarget {
  readonly id?: string;
  readonly chunkId?: string;
  readonly documentId?: string;
  readonly locator?: string;
  readonly excerpt?: string;
  readonly source?: string;
}

const CATEGORY_FROM_PLAYBOOK: Record<string, ClauseCategory> = {
  liability: "liability",
  indemnity: "indemnity",
  termination: "termination",
  jurisdiction: "jurisdiction",
  ip: "ip",
  payment: "payment",
  confidentiality: "confidentiality",
};

const CLAUSE_REF = /[A-Za-z0-9._-]+:clause:\d+/;

export function resolveClauseId(
  target: CitationTarget,
  clauses: readonly ExtractedClause[],
): string | null {
  const direct = target.id ?? target.chunkId;
  if (direct) {
    const exact = clauses.find((c) => c.id === direct);
    if (exact) {
      return exact.id;
    }
    const playbookCat = categoryFromPlaybookId(direct);
    if (playbookCat) {
      return findClauseForCategory(playbookCat, clauses)?.id
        ?? findByClauseRef(target.excerpt, clauses);
    }
    const fromDirect = findByClauseRef(direct, clauses);
    if (fromDirect) {
      return fromDirect;
    }
  }
  const fromLinked = findByClauseRef(target.excerpt, clauses) ?? findByClauseRef(target.locator, clauses);
  if (fromLinked) {
    return fromLinked;
  }
  const locator = (target.locator ?? "").toLowerCase();
  if (locator.length > 2) {
    const byHeading = clauses.find(
      (c) =>
        c.heading.toLowerCase().includes(locator) ||
        locator.includes(c.heading.toLowerCase()) ||
        c.title.toLowerCase().includes(locator),
    );
    if (byHeading) {
      return byHeading.id;
    }
  }
  const excerpt = (target.excerpt ?? "").replace(/\s+/g, " ").trim();
  if (excerpt.length > 24) {
    const needle = excerpt.slice(0, 48).toLowerCase();
    const byExcerpt = clauses.find((c) => c.text.toLowerCase().includes(needle));
    if (byExcerpt) {
      return byExcerpt.id;
    }
  }
  return null;
}

function findByClauseRef(value: string | undefined, clauses: readonly ExtractedClause[]): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(CLAUSE_REF);
  if (!match) {
    return null;
  }
  const ref = match[0];
  const exact = clauses.find((c) => c.id === ref);
  if (exact) {
    return exact.id;
  }
  const suffix = ref.slice(ref.indexOf(":clause:"));
  return clauses.find((c) => c.id.endsWith(suffix))?.id ?? null;
}

const HEADING_HINTS: Record<ClauseCategory, RegExp> = {
  liability: /liability|مسؤولي/i,
  indemnity: /indemnit|تعويض/i,
  termination: /terminat|إنهاء|انهاء/i,
  jurisdiction: /governing|jurisdiction|قانون|اختصاص/i,
  confidentiality: /confidential|سري/i,
  ip: /intellectual|ملكية فكر/i,
  payment: /payment|invoice|دفع/i,
  other: /.^/,
};

export function findClauseForCategory(
  category: ClauseCategory,
  clauses: readonly ExtractedClause[],
): ExtractedClause | undefined {
  return (
    clauses.find((c) => HEADING_HINTS[category].test(`${c.heading} ${c.title}`)) ??
    clauses.find((c) => c.category === category)
  );
}

function categoryFromPlaybookId(id: string): ClauseCategory | undefined {
  const part = id.split(":").at(-1);
  return part ? CATEGORY_FROM_PLAYBOOK[part] : undefined;
}

export function clauseDomId(clauseId: string): string {
  return `clause-${clauseId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}
