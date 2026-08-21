/**
 * Arabic lexical normalisation for hybrid search (T1).
 * Strips tashkeel, tatweel, and unifies alef / ya / ta marbuta variants.
 */
const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;

export function normalizeArabic(input: string): string {
  return input
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "of",
  "to",
  "in",
  "on",
  "is",
  "are",
  "was",
  "be",
  "or",
  "an",
  "as",
  "by",
  "at",
  "it",
  "this",
  "that",
  "with",
  "from",
  "what",
  "which",
  "في",
  "من",
  "علي",
  "الى",
  "إلى",
  "هذا",
  "هذه",
  "ان",
  "أن",
  "أو",
  "او",
  "عن",
  "مع",
]);

export function tokenize(input: string): string[] {
  const normalized = normalizeArabic(input).toLowerCase();
  return normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t));
}
