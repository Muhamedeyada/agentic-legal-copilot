/** Client-side bilingual token overlap. Mirrors the assessor metric without importing server code. */

function fold(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .toLowerCase();
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "on",
  "by",
  "with",
  "as",
  "at",
  "from",
  "that",
  "this",
  "be",
  "is",
  "are",
  "was",
  "were",
  "shall",
  "will",
  "may",
  "not",
  "في",
  "من",
  "على",
  "الى",
  "إلى",
  "و",
  "أو",
  "ان",
  "أن",
  "ال",
  "هذا",
  "هذه",
  "ذلك",
]);

function tokens(text: string): Set<string> {
  const parts = fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOP.has(part));
  return new Set(parts);
}

export function tokenOverlap(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) {
      inter += 1;
    }
  }
  return inter / Math.max(a.size, b.size);
}

export function similarityPercent(left: string, right: string): number {
  return Math.round(tokenOverlap(left, right) * 100);
}
