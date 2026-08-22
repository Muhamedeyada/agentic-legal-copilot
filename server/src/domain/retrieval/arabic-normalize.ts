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

function stemArabic(token: string): string {
  if (!/[\u0600-\u06FF]/.test(token)) {
    return token;
  }
  return token.replace(/(ها|هم|هن|ات|ون|ين|ان|وا)$/u, "").replace(/[هة]$/u, "");
}

function stemEnglish(token: string): string {
  if (/ing$/.test(token) && token.length > 6) {
    return token.slice(0, -3);
  }
  if (/ed$/.test(token) && token.length > 5) {
    return token.slice(0, -2);
  }
  if (/s$/.test(token) && token.length > 4 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  const folded = normalizeArabic(text);
  const parts = folded
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !EN_STOP.has(t) && !AR_STOP.has(t));
  const out: string[] = [];
  for (const t of parts) {
    out.push(t);
    const ar = stemArabic(t);
    if (ar !== t && ar.length > 2) {
      out.push(ar);
    }
    const en = stemEnglish(t);
    if (en !== t && en.length > 2) {
      out.push(en);
    }
  }
  return out;
}

export function queryCoverage(query: string, document: string): number {
  const q = new Set(tokenize(query));
  const d = new Set(tokenize(document));
  if (q.size === 0) {
    return 0;
  }
  let inter = 0;
  for (const t of q) {
    if (d.has(t)) {
      inter += 1;
    }
  }
  return inter / q.size;
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
