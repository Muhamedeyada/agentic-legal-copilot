import type { ClauseCategory } from "../../domain/entities/clause-category.js";
import { normalizeArabic } from "../../domain/retrieval/arabic-normalize.js";

interface Cue {
  readonly category: ClauseCategory;
  readonly patterns: readonly RegExp[];
}

const CUES: readonly Cue[] = [
  {
    category: "indemnity",
    patterns: [
      /\bindemnif/i,
      /\bhold\s+harmless\b/i,
      /تعويض/,
      /يعوض/,
      /يُعوّض/,
      /يُعوض/,
    ],
  },
  {
    category: "liability",
    patterns: [/\bliabilit/i, /\bdamages\b/i, /مسؤول/, /مسئول/, /الاضرار/, /الأضرار/],
  },
  {
    category: "termination",
    patterns: [/\bterminat/i, /\bnotice\s+period\b/i, /إنهاء/, /انهاء/, /فسخ/, /إخطار/],
  },
  {
    category: "jurisdiction",
    patterns: [
      /\bgoverning\s+law\b/i,
      /\bjurisdiction\b/i,
      /\bvenue\b/i,
      /القانون\s+الحاكم/,
      /فض\s+النزاع/,
      /الاختصاص/,
    ],
  },
  {
    category: "payment",
    patterns: [/\bpayment\b/i, /\bfee\b/i, /\binvoice\b/i, /\blate\b/i, /دفع/, /رسوم/, /فاتورة/, /غرام/],
  },
  {
    category: "ip",
    patterns: [
      /\bintellectual\s+propert/i,
      /\bcopyright\b/i,
      /\blicen[sc]e\b/i,
      /ملكية\s+فكرية/,
      /الملكية\s+الفكرية/,
      /ترخيص/,
    ],
  },
  {
    category: "confidentiality",
    patterns: [/\bconfidential/i, /\bnon-?disclosure\b/i, /سرية/, /عدم\s+إفصاح/, /عدم\s+افصاح/],
  },
];

const STANDARD_HEADING =
  /\b(liability|indemnity|termination|governing\s+law|jurisdiction|payment|intellectual|confidential|بند|المادة|مسؤول|تعويض|إنهاء|القانون|دفع|ملكية|سرية)/i;

/**
 * Terms that *name* a family. Stricter than CUES: CUES only route a clause to a playbook clause,
 * while these decide whether a mandatory family is present, so loose words such as "damages",
 * "notice", "licence" or التعويض الاتفاقي (liquidated damages) are left out.
 * Patterns run on `normalizeArabic` output (lower-case, أ/إ/آ → ا, ة → ه, ى → ي).
 */
const NAMING_CUES: readonly Cue[] = [
  { category: "liability", patterns: [/\bliabilit(?:y|ies)\b/, /مسؤوليه|مسئوليه/] },
  {
    category: "indemnity",
    patterns: [/\bindemni/, /\bhold\s+harmless\b/, /تعويض(?!\S*\s+(?:ال)?اتفاقي)/],
  },
  { category: "termination", patterns: [/\bterminat/, /انهاء|فسخ/] },
  {
    category: "jurisdiction",
    patterns: [
      /\bgoverning\s+law\b|\bapplicable\s+law\b|\bchoice\s+of\s+law\b|\bjurisdiction\b|\bvenue\b/,
      /القانون\s+الحاكم|القانون\s+الواجب\s+التطبيق|الاختصاص/,
    ],
  },
  {
    category: "payment",
    patterns: [/\bpayments?\b|\bfees?\b|\binvoic|\bcharges\b/, /الدفع|المدفوعات|الرسوم|الاتعاب|السداد/],
  },
  { category: "ip", patterns: [/\bintellectual\s+property\b|\bip\b/, /الملكيه\s+الفكريه|ملكيه\s+فكريه/] },
  {
    category: "confidentiality",
    patterns: [/\bconfidential|\bnon-?disclosure\b/, /السريه|سريه|عدم\s+الافصاح/],
  },
];

/** In a body, the governing-law sentence itself is the evidence that the family exists. */
const BODY_EVIDENCE: Partial<Record<ClauseCategory, RegExp>> = {
  jurisdiction: /\bgoverned\s+by\b|يخضع\s+هذ[اه]/,
};

/**
 * Headings that name no risk family of their own. A clause under one of them is filed as "other",
 * and its body cannot make a mandatory family "present": a Notices clause that mentions
 * "termination notices" is not a termination clause. A heading that also names a family
 * ("Interpretation and Governing Law") is classified by that family instead.
 */
const BOILERPLATE_HEADING =
  /\b(?:definitions?|interpretation|background|recitals|notices?|general|miscellaneous|entire\s+agreement|counterparts|signatures?|execution|insurance|force\s+majeure|schedules?|annex(?:es)?)\b|التعاريف|تعريفات|التفسير|التمهيد|الاخطارات|الاشعارات|احكام\s+عامه|التوقيع|القوه\s+القاهره|التامين|الملاحق/;

function matchingCues(text: string): Cue[] {
  const folded = normalizeArabic(text);
  return CUES.filter((cue) => cue.patterns.some((p) => p.test(text) || p.test(folded)));
}

function matchCue(text: string): ClauseCategory | undefined {
  return matchingCues(text)[0]?.category;
}

/** Families named in a heading, in the order they appear: "Liability and Indemnification" → liability, indemnity. */
export function headingFamilies(heading: string): ClauseCategory[] {
  const folded = normalizeArabic(heading);
  return NAMING_CUES.map((cue) => {
    const positions = cue.patterns.map((p) => folded.search(p)).filter((i) => i >= 0);
    return { category: cue.category, at: positions.length > 0 ? Math.min(...positions) : -1 };
  })
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((hit) => hit.category);
}

function isBoilerplateHeading(heading: string): boolean {
  return BOILERPLATE_HEADING.test(normalizeArabic(heading));
}

/**
 * The heading decides when it names a family ("Confidentiality", "Interpretation and Governing
 * Law"); body cues are the fallback. Body-first matching filed confidentiality clauses under
 * termination because they mention "termination", and so compared them with the wrong playbook clause.
 */
export function classifyClause(heading: string, text: string): {
  category: ClauseCategory;
  standard: boolean;
} {
  const named = headingFamilies(heading)[0];
  if (named) {
    return { category: named, standard: STANDARD_HEADING.test(heading) };
  }
  if (isBoilerplateHeading(heading)) {
    return { category: "other", standard: false };
  }
  // Routing only: a looser heading word ("Licence Grant" → ip) still beats body keywords.
  const category = matchCue(heading) ?? matchCue(`${heading}\n${text}`);
  return category
    ? { category, standard: STANDARD_HEADING.test(heading) }
    : { category: "other", standard: false };
}

/**
 * Families a clause establishes as present, for the silent-omission check. A heading that names a
 * family decides. Otherwise the body counts only under a substantive heading, and only when it
 * names the clause's own family: "Liquidated Damages" is routed to liability because of
 * "damages", but it does not stand in for a limitation-of-liability clause.
 */
export function evidencedFamilies(heading: string, text: string): ClauseCategory[] {
  const named = headingFamilies(heading);
  if (named.length > 0) {
    return named;
  }
  if (isBoilerplateHeading(heading)) {
    return [];
  }
  const { category } = classifyClause(heading, text);
  const body = normalizeArabic(text);
  const extra = BODY_EVIDENCE[category];
  const evidence = [
    ...(NAMING_CUES.find((cue) => cue.category === category)?.patterns ?? []),
    ...(extra ? [extra] : []),
  ];
  return evidence.some((p) => p.test(body)) ? [category] : [];
}

const CARVE_OUT_SCOPE =
  "(?:fraud(?:ulent)?|wil+ful|deliberate|gross(?:ly)?\\s+negligen\\w*|death|personal\\s+injury|الاحتيال|الغش|سوء\\s+النيه|العمد|الاهمال\\s+الجسيم|الوفاه)";

// `(?:cap|limit)\b` so "without limiting any other remedy" is not read as "without limit".
const UNLIMITED =
  /\bunlimited\b|\buncapped\b|without\s+(?:any\s+)?(?:monetary\s+)?(?:cap|limit)\b|not\s+(?:be\s+)?subject\s+to\s+any\s+(?:monetary\s+)?(?:cap|limit)\b|بلا\s+سقف|دون\s+سقف|دون\s+حد\s+اقصي|غير\s+محدود/;

/**
 * "Unlimited" scoped to a standard carve-out: "capped at fees, but unlimited for fraud",
 * "liability for wilful misconduct is uncapped", "غير محدودة في حالات الاحتيال". Broadening wording
 * such as "unlimited, including for fraud" is not a carve-out.
 */
const CARVE_OUT: readonly RegExp[] = [
  new RegExp(
    `(?:unlimited|uncapped|not\\s+(?:be\\s+)?(?:capped|limited))\\s+(?:in\\s+(?:respect|the\\s+case)\\s+of|in\\s+cases?\\s+of|for|where)\\s+(?:\\S+\\s+){0,3}?${CARVE_OUT_SCOPE}`,
  ),
  new RegExp(
    `liabilit(?:y|ies)\\s+(?:for|arising\\s+from|in\\s+respect\\s+of|caused\\s+by)\\s+(?:\\S+\\s+){0,3}?${CARVE_OUT_SCOPE}[^.;]{0,40}(?:unlimited|uncapped|not\\s+(?:be\\s+)?(?:capped|limited))`,
  ),
  new RegExp(`(?:غير\\s+محدود\\S*|بلا\\s+سقف|دون\\s+سقف)\\s+(?:في|عن)\\s+(?:حال\\S*\\s+)?${CARVE_OUT_SCOPE}`),
  new RegExp(`(?:عن|في\\s+حال\\S*)\\s+${CARVE_OUT_SCOPE}[^.،]{0,40}(?:غير\\s+محدود|بلا\\s+سقف|دون\\s+سقف)`),
];

function foldedSentences(text: string): string[] {
  return normalizeArabic(text)
    .split(/(?<=[.!?؟;])\s+|\n+/u)
    .filter((s) => s.trim().length > 0);
}

/** The sentence removes the cap in general, not only for a standard carve-out. */
function removesCap(sentence: string): boolean {
  return UNLIMITED.test(sentence) && !CARVE_OUT.some((re) => re.test(sentence));
}

export function detectRiskFlags(text: string): {
  unlimitedLiability: boolean;
  uncappedIndemnity: boolean;
  oneDayTermination: boolean;
  unilateralIp: boolean;
  punitiveLateFee: boolean;
} {
  const folded = normalizeArabic(text);
  const sentences = foldedSentences(text);
  const unlimitedLiability = sentences.some(removesCap);

  const uncappedIndemnity = sentences.some((s) => /indemnif|تعويض/.test(s) && removesCap(s));

  const oneDayTermination =
    /one\s*\(?\s*1\s*\)?\s*calendar\s+day/i.test(text) ||
    /one\s+day\s+written\s+notice/i.test(text) ||
    /يوم\s+(تقويمي\s+)?واحد/.test(folded) ||
    /اخطار\s+مدته\s+يوم(?=[\s.،]|$)/.test(folded);

  const unilateralIp =
    /irrevocably assigns/i.test(text) ||
    /assigns all (right|intellectual)/i.test(text) ||
    /يتنازل\s+نهائيا/.test(folded) ||
    /يتنازل\s+تنازلا/.test(folded);

  const punitiveLateFee =
    /fifteen percent/i.test(text) ||
    /15\s*%/.test(text) ||
    /per calendar day/i.test(text) ||
    /خمسه عشر\s*%/.test(folded) ||
    /15\s*%/.test(text) && /يوم/.test(folded);

  return {
    unlimitedLiability,
    uncappedIndemnity,
    oneDayTermination,
    unilateralIp,
    punitiveLateFee,
  };
}
