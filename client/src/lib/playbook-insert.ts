export function buildPlaybookInsert(heading: string, category: string, clause: string): string {
  return `## ${heading} — ${category}\n\n${clause.trim()}`;
}

export function collectPlaybookInserts(draft: string, heading: string): string[] {
  const marker = `## ${heading} —`;
  if (!draft.includes(marker)) {
    return [];
  }
  return draft
    .split(new RegExp(`(?=${escapeRegExp(marker)})`, "u"))
    .map((part) => part.trim())
    .filter((part) => part.startsWith(marker));
}

export function mergeMemoWithInserts(memoBody: string, draft: string, heading: string): string {
  const inserts = collectPlaybookInserts(draft, heading);
  const marker = `## ${heading} —`;
  const preamble = draft.includes(marker) ? (draft.split(marker)[0] ?? "").trim() : draft.trim();
  if (draft.trim().length === 0) {
    return memoBody;
  }
  if (preamble.length === 0 && inserts.length > 0) {
    const unique = inserts.filter((block) => !memoBody.includes(block));
    return [memoBody.trim(), ...unique].filter((part) => part.length > 0).join("\n\n");
  }
  return draft;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
