export type HighlightKind = "plain" | "risk" | "safe";

export interface HighlightSpan {
  readonly text: string;
  readonly kind: HighlightKind;
}

const RISK_PATTERN =
  /unlimited|uncapped|without(?:\s+any)?\s+cap|shall not be subject to any monetary cap|irrevocably assigns|assigns all (?:right|intellectual)|punitive|per calendar day|fifteen percent|15\s*%|one\s*\(?\s*1\s*\)?\s*calendar\s+day|one\s+day\s+written\s+notice|بلا سقف|دون سقف|غير محدودة|غير محدود|يتنازل\s+نهائيا|يتنازل\s+تنازلا|خمسة عشر\s*%|يوم\s+(?:تقويمي\s+)?واحد|إخطار\s+مدته\s+يوم|غرام(?:ة|ات)?/giu;

const SAFE_PATTERN =
  /capped at twelve|twelve \(12\) months|thirty \(30\) days|exclusive jurisdiction|england and wales|mutual, capped|non-exclusive licence|reasonable statutory rate|تُحد المسؤولية|اثني عشر \(12\)|ثلاثون \(30\) يوماً|الاختصاص الحصري|تعويض متبادلاً|ترخيص غير حصري|فائدة بمعدل نظامي/giu;

function splitByPattern(text: string, pattern: RegExp, kind: Exclude<HighlightKind, "plain">): HighlightSpan[] {
  if (text.length === 0) {
    return [];
  }
  const spans: HighlightSpan[] = [];
  let cursor = 0;
  const rx = new RegExp(pattern.source, pattern.flags);
  for (const match of text.matchAll(rx)) {
    const start = match.index ?? 0;
    const value = match[0] ?? "";
    if (value.length === 0) {
      continue;
    }
    if (start > cursor) {
      spans.push({ text: text.slice(cursor, start), kind: "plain" });
    }
    spans.push({ text: value, kind });
    cursor = start + value.length;
  }
  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), kind: "plain" });
  }
  return spans.length > 0 ? spans : [{ text, kind: "plain" }];
}

export function highlightRiskPhrases(text: string): HighlightSpan[] {
  return splitByPattern(text, RISK_PATTERN, "risk");
}

export function highlightPlaybookPhrases(text: string): HighlightSpan[] {
  return splitByPattern(text, SAFE_PATTERN, "safe");
}
