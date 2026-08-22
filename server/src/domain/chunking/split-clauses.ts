import type { Locale } from "../entities/contract.js";

export interface SplitClause {
  readonly heading: string;
  readonly title: string;
  readonly text: string;
  readonly language: Locale;
  readonly spanStart: number;
  readonly spanEnd: number;
}

const HEADING =
  /(?:^|\n)[ \t]*(?:#{1,3}[ \t]+)?(?:(?:\d{1,2}[.)])|(?:Article|ARTICLE|Clause|CLAUSE|بند|المادة|الماده)[ \t]*\d*)[^\n]*/g;

function detectLanguage(text: string): Locale {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > 0 && latin > 0) {
    return "mixed";
  }
  if (arabic > latin) {
    return "ar";
  }
  return "en";
}

/** Split on numbered Article / بند headings (AR + EN). Falls back to whole document. */
export function splitClauses(text: string): SplitClause[] {
  const matches = [...text.matchAll(HEADING)];
  if (matches.length === 0) {
    const trimmed = text.trim();
    return trimmed.length === 0
      ? []
      : [
          {
            heading: "",
            title: "body",
            text: trimmed,
            language: detectLanguage(trimmed),
            spanStart: 0,
            spanEnd: text.length,
          },
        ];
  }

  const out: SplitClause[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match || match.index === undefined) {
      continue;
    }
    const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
    const next = matches[i + 1];
    const end = next?.index !== undefined ? next.index : text.length;
    const block = text.slice(start, end).trim();
    const heading = match[0].trim();
    const body = block.slice(heading.length).trim();
    out.push({
      heading,
      title: heading.replace(/^#+\s*/, "").trim(),
      text: body.length > 0 ? body : block,
      language: detectLanguage(block),
      spanStart: start,
      spanEnd: end,
    });
  }
  return out;
}
