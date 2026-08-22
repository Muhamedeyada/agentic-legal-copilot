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

export function classifyClause(heading: string, text: string): {
  category: ClauseCategory;
  standard: boolean;
} {
  const blob = `${heading}\n${text}`;
  const folded = normalizeArabic(blob);
  for (const cue of CUES) {
    if (cue.patterns.some((p) => p.test(blob) || p.test(folded))) {
      return { category: cue.category, standard: STANDARD_HEADING.test(heading) };
    }
  }
  return { category: "other", standard: false };
}

export function detectRiskFlags(text: string): {
  unlimitedLiability: boolean;
  uncappedIndemnity: boolean;
  oneDayTermination: boolean;
  unilateralIp: boolean;
  punitiveLateFee: boolean;
} {
  const folded = normalizeArabic(text);
  const unlimitedLiability =
    /shall not be subject to any monetary cap/i.test(text) ||
    /unlimited/i.test(text) ||
    /without (any )?cap/i.test(text) ||
    /بلا سقف/.test(folded) ||
    /دون سقف/.test(folded) ||
    /غير محدودة/.test(folded);

  const uncappedIndemnity =
    (/indemnif/i.test(text) || /تعويض/.test(folded)) &&
    (/uncapped/i.test(text) || /without (any )?cap/i.test(text) || /بلا سقف/.test(folded) || /غير محدود/.test(folded));

  const oneDayTermination =
    /one\s*\(?\s*1\s*\)?\s*calendar\s+day/i.test(text) ||
    /one\s+day\s+written\s+notice/i.test(text) ||
    /يوم\s+(تقويمي\s+)?واحد/.test(folded) ||
    /إخطار\s+مدته\s+يوم/.test(folded);

  const unilateralIp =
    /irrevocably assigns/i.test(text) ||
    /assigns all (right|intellectual)/i.test(text) ||
    /يتنازل\s+نهائيا/.test(folded) ||
    /يتنازل\s+تنازلا/.test(folded);

  const punitiveLateFee =
    /fifteen percent/i.test(text) ||
    /15\s*%/.test(text) ||
    /per calendar day/i.test(text) ||
    /خمسة عشر\s*%/.test(folded) ||
    /15\s*%/.test(text) && /يوم/.test(folded);

  return {
    unlimitedLiability,
    uncappedIndemnity,
    oneDayTermination,
    unilateralIp,
    punitiveLateFee,
  };
}
