export interface RedactionHit {
  readonly kind: string;
  readonly count: number;
}

export interface RedactionResult {
  readonly text: string;
  readonly hits: readonly RedactionHit[];
}

const PATTERNS: ReadonlyArray<{ kind: string; re: RegExp; token: string }> = [
  { kind: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, token: "[REDACTED_EMAIL]" },
  {
    kind: "iban",
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
    token: "[REDACTED_IBAN]",
  },
  { kind: "card", re: /\b(?:\d[ -]*?){13,19}\b/g, token: "[REDACTED_CARD]" },
  {
    kind: "phone",
    re: /\+?\d[\d\s().-]{8,}\d/g,
    token: "[REDACTED_PHONE]",
  },
  { kind: "national_id", re: /\b(?:NIN|SSN|National ID)[:\s-]*[A-Z0-9-]{6,}\b/gi, token: "[REDACTED_ID]" },
];

/**
 * Strip common personal identifiers from contract text before any LLM call.
 * Synthetic corpus is already PII-free; this guards uploads and eval fixtures.
 */
export function redactPii(input: string): RedactionResult {
  let text = input;
  const hits: RedactionHit[] = [];
  for (const p of PATTERNS) {
    const matches = text.match(p.re);
    if (!matches || matches.length === 0) {
      continue;
    }
    text = text.replace(p.re, p.token);
    hits.push({ kind: p.kind, count: matches.length });
  }
  return { text, hits };
}
