/** Strip Arabic tashkeel and fold common letter variants for bilingual matching. */
export function normalizeArabic(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .toLowerCase();
}

const EN_STOP = new Set([
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
]);

const AR_STOP = new Set(["في", "من", "على", "الى", "إلى", "و", "أو", "ان", "أن", "ال", "هذا", "هذه", "ذلك"]);

export function tokenize(text: string): string[] {
  const folded = normalizeArabic(text);
  return folded
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !EN_STOP.has(t) && !AR_STOP.has(t));
}

export function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let inter = 0;
  for (const t of left) {
    if (right.has(t)) {
      inter += 1;
    }
  }
  return inter / Math.max(left.size, right.size);
}
