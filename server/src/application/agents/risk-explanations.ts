import type { ClauseCategory } from "../../domain/entities/clause-category.js";
import { normalizeArabic } from "../../domain/retrieval/arabic-normalize.js";
import { detectRiskFlags } from "./classify.js";

export interface DeviationInput {
  readonly category: ClauseCategory;
  readonly clauseText: string;
  readonly policyText: string;
}

const DEFAULT_MIN_NOTICE_DAYS = 30;

export function explainDeviation(input: DeviationInput): string {
  const text = input.clauseText;
  const hasPolicy = input.policyText.trim().length > 0;
  switch (input.category) {
    case "liability":
      return explainLiability(text);
    case "indemnity":
      return explainIndemnity(text);
    case "termination":
      return explainTermination(text, input.policyText);
    case "jurisdiction":
      return explainJurisdiction(text, input.policyText);
    case "confidentiality":
      return explainConfidentiality(text, hasPolicy);
    case "ip":
      return hasPolicy ? "IP terms deviate from the cited playbook clause." : noStandard("IP");
    case "payment":
      return hasPolicy ? "Payment terms deviate from the cited playbook clause." : noStandard("payment");
    case "other":
      return hasPolicy ? "Clause deviates from the cited playbook clause." : noStandard("this clause type");
  }
}

function noStandard(what: string): string {
  return `The playbook has no standard for ${what}; review manually.`;
}

function sentences(text: string): string[] {
  return normalizeArabic(text)
    .split(/(?<=[.!?؟;])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function excludesConsequentialLoss(text: string): boolean {
  return sentences(text).some((s) => {
    const mentionsLoss = /indirect|consequential|غير المباشر|التبعي/.test(s);
    const excludes =
      /not (?:be )?liable|no liability|neither party (?:is|shall be) liable|exclud|exclusion/.test(s) ||
      /لا يسال|لا يكون[^.]*مسؤول|يستثنى|استثناء/.test(s);
    const disapplied = /disappl|does not apply|shall not apply|not be subject to any monetary cap|لا يطبق|لا يسري/.test(s);
    return mentionsLoss && excludes && !disapplied;
  });
}

function explainLiability(text: string): string {
  const uncapped = detectRiskFlags(text).unlimitedLiability;
  const excluded = excludesConsequentialLoss(text);
  if (uncapped && !excluded) {
    return "Uncapped liability structure lacking aggregate maximum and consequential damage exclusion.";
  }
  if (uncapped) {
    return "Uncapped liability structure lacking aggregate maximum.";
  }
  if (!excluded) {
    return "Liability terms deviate from the playbook cap and include no consequential damage exclusion.";
  }
  return "Liability terms deviate from the playbook cap; confirm the aggregate maximum.";
}

function explainIndemnity(text: string): string {
  const s = normalizeArabic(text);
  const grossNegligenceCarveOut = /gross(?:ly)? negligen|اهمال جسيم|الاهمال الجسيم/.test(s);
  const flags = detectRiskFlags(text);
  const capped = /\bcap(?:ped)?\b|limited to|سقف|بحد اقصي/.test(s);
  const broad = flags.uncappedIndemnity || flags.unlimitedLiability || !capped;
  if (!grossNegligenceCarveOut && broad) {
    return "Broad indemnification obligation missing standard gross negligence exemptions.";
  }
  if (!grossNegligenceCarveOut) {
    return "Indemnification obligation missing standard gross negligence exemptions.";
  }
  return "Indemnity terms deviate from the cited playbook clause.";
}

const EN_NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  five: 5,
  seven: 7,
  ten: 10,
  fourteen: 14,
  fifteen: 15,
  thirty: 30,
  sixty: 60,
  ninety: 90,
};
const EN_COUNT = `(?:\\(?(\\d{1,3})\\)?|(${Object.keys(EN_NUMBER_WORDS).join("|")})(?:\\s*\\(\\d{1,3}\\))?)`;
const EN_DAYS = `(?:calendar\\s+|business\\s+|working\\s+)?days?`;

const EN_NOTICE_PERIOD: readonly RegExp[] = [
  new RegExp(`${EN_COUNT}\\s*${EN_DAYS}(?:['’]s?)?\\s+(?:prior\\s+|advance\\s+)?(?:written\\s+)?notice\\b`, "g"),
  new RegExp(
    `\\bnotice(?:\\s+period)?\\s+of\\s+(?:at\\s+least\\s+|not\\s+less\\s+than\\s+)?${EN_COUNT}\\s*${EN_DAYS}`,
    "g",
  ),
];

const AR_NOTICE_PERIOD = /(?:اخطار|اشعار)(?:\s+(?!(?:من|بعد|خلال)(?=\s|$))\S+){0,4}?\s+\(?(\d{1,3})\)?\s*(?:يوم|ايام)/g;
const AR_ONE_DAY_NOTICE = /(?:اخطار|اشعار)(?:\s+\S+){0,3}?\s+(?:مدته\s+)?يوم(?:\s+(?:تقويمي|عمل))?(?:\s+واحد)?(?=[\s.،(]|$)/;

export function shortestNoticeDays(text: string): number | undefined {
  const days: number[] = [];
  for (const s of sentences(text)) {
    for (const re of EN_NOTICE_PERIOD) {
      for (const m of s.matchAll(re)) {
        const n = m[1] !== undefined ? Number(m[1]) : EN_NUMBER_WORDS[m[2] ?? ""];
        if (n !== undefined) {
          days.push(n);
        }
      }
    }
    for (const m of s.matchAll(AR_NOTICE_PERIOD)) {
      days.push(Number(m[1]));
    }
    if (AR_ONE_DAY_NOTICE.test(s)) {
      days.push(1);
    }
  }
  return days.length > 0 ? Math.min(...days) : undefined;
}

const EN_GRANT =
  /([^,;:]*?)\b(?:may|can|is\s+entitled\s+to|shall\s+be\s+entitled\s+to|has\s+the\s+right\s+to|shall\s+have\s+the\s+right\s+to|reserves\s+the\s+right\s+to)\s+terminate\b/g;
const EN_MUTUAL = /\b(?:either|each|any|both)\s+(?:of\s+the\s+)?part(?:y|ies)\b|\bthe\s+parties\b|\b(?:or|and)\b/;
const EN_NOT_A_PARTY = /\b(?:agreement|contract|order|statement\s+of\s+work|it|which)\s*$/;
const AR_GRANT = /(?:يجوز|يحق)\s+(ل\S+(?:\s+\S+){0,3}?)\s+(?:انهاء|الانهاء|انهاوه|انهاءه|فسخ)/g;
// Arabic word-boundary lookahead.
const AR_MUTUAL = /^(?:لاي|لكل|للطرفين|لكلا)(?=\s|$)|\s(?:او\s+|و)ل/;

function singlePartyGrants(text: string): Set<string> {
  const parties = new Set<string>();
  for (const s of sentences(text)) {
    for (const m of s.matchAll(EN_GRANT)) {
      const subject = (m[1] ?? "").replace(/^(?:however|then|thereafter|in\s+addition|additionally)\s+/, "").trim();
      if (subject.length === 0 || EN_MUTUAL.test(subject) || EN_NOT_A_PARTY.test(subject)) {
        continue;
      }
      parties.add(subject.replace(/^the\s+/, "").split(/\s+/).slice(-3).join(" "));
    }
    for (const m of s.matchAll(AR_GRANT)) {
      const subject = (m[1] ?? "").trim();
      if (!AR_MUTUAL.test(subject)) {
        parties.add(subject.split(/\s+/)[0] ?? subject);
      }
    }
  }
  return parties;
}

export function isOneSidedTermination(text: string): boolean {
  return singlePartyGrants(text).size === 1;
}

function explainTermination(text: string, policyText: string): string {
  const minimum = shortestNoticeDays(policyText) ?? DEFAULT_MIN_NOTICE_DAYS;
  const notice = shortestNoticeDays(text);
  const short = notice !== undefined && notice < minimum;
  const oneSided = isOneSidedTermination(text);
  if (short && oneSided) {
    return "Asymmetric termination notice timeline violating minimum grace period standards.";
  }
  if (short) {
    return `Termination notice of ${notice} day${notice === 1 ? "" : "s"} is below the ${minimum}-day minimum grace period.`;
  }
  if (oneSided) {
    return "Asymmetric termination right: only one named party is granted a termination right.";
  }
  return "Termination terms deviate from the cited playbook clause.";
}

const EN_LAW =
  /\b(?:governed\s+by|construed\s+(?:in\s+accordance\s+with|under))\s+(?:and\s+(?:construed|interpreted)\s+(?:in\s+accordance\s+with|under)\s+)?(?:the\s+)?(?:(?:substantive\s+)?laws?\s+(?:in\s+force\s+in|of)\s+)?(?:the\s+)?([^,.;\n]+)/gi;
const EN_LAW_SHALL_GOVERN = /\blaws?\s+of\s+(?:the\s+)?([^,.;\n]+?)\s+(?:shall|will)\s+govern\b/i;
const EN_LAW_TAIL =
  /\s+(?:and\s+(?:construed|interpreted)|without\s+(?:regard|reference)|excluding|exclusive\s+of|save\s+that|and\s+(?:the|each|any)\s)[\s\S]*$/i;
const NOT_A_LAW = /^(?:clause|section|article|paragraph|schedule|annex|exhibit|appendix|this|these|that|such|its|their|the\s+(?:terms|provisions|order))\b|^\d/i;
const AR_LAW =
  /(?:يخضع|تخضع)\s+(?:هذا|هذه)\s+(?:العقد|الاتفاق|الاتفاقية)(?:\s+و(?:يفسر|تفسر))?(?:\s+وفقا)?\s+(?:لـ\s*|ل)([^.،\n]+?)(?=\s+دون|[.،\n]|$)/u;

export function governingLaw(text: string): string | undefined {
  const plain = text.replace(/[ً-ٰٟ]/g, "");
  for (const m of plain.matchAll(EN_LAW)) {
    const law = (m[1] ?? "").replace(EN_LAW_TAIL, "").trim();
    if (law.length > 0 && !NOT_A_LAW.test(law)) {
      return law;
    }
  }
  const shall = EN_LAW_SHALL_GOVERN.exec(plain)?.[1]?.trim();
  if (shall && !NOT_A_LAW.test(shall)) {
    return shall;
  }
  return AR_LAW.exec(plain)?.[1]?.trim();
}

function lawKey(law: string): string {
  return normalizeArabic(law)
    .replace(/\benglish\b/g, "england")
    .replace(/\b(?:the|laws?|of|state|federal republic|republic)\b/g, " ")
    .replace(/قوانين|قانون|انظمه|امارة|اماره|جمهوريه/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameLaw(a: string, b: string): boolean {
  const x = lawKey(a);
  const y = lawKey(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

function explainJurisdiction(text: string, policyText: string): string {
  const law = governingLaw(text);
  const standard = governingLaw(policyText);
  if (!law) {
    return standard
      ? `No governing law identified in the clause; the playbook default is ${standard}.`
      : "No governing law identified in the clause.";
  }
  if (standard && !sameLaw(law, standard)) {
    return `Designated foreign governing law (${law}) deviates from default domestic venue (${standard}).`;
  }
  return standard
    ? `Governing law matches the playbook (${standard}); the remaining wording differs from the cited playbook clause.`
    : `Governing law: ${law}.`;
}

const SURVIVAL_SENTENCE =
  /surviv|continue[sd]?\s+(?:in\s+(?:force|effect)|to\s+apply)|remain\s+in\s+(?:force|effect)|تسري|تظل|تبقي|تستمر|يستمر|يظل/;
const INDEFINITE = /indefinite|perpetu|without\s+(?:time\s+)?limit|بصفه\s+دائمه|الي\s+اجل\s+غير\s+مسمي|غير\s+محدد\s+المده/;

function survivalYears(sentence: string): number | undefined {
  const n = /\(?(\d{1,2})\)?\s*years?\b/.exec(sentence)?.[1] ?? /\(?(\d{1,2})\)?\s*(?:سنوات|سنه|سنين|اعوام|عام)/.exec(sentence)?.[1];
  if (n !== undefined) {
    return Number(n);
  }
  return /سنتين|سنتان|عامين|عامان/.test(sentence) ? 2 : undefined;
}

function explainConfidentiality(text: string, hasPolicy: boolean): string {
  const survival = sentences(text).filter(
    (s) => SURVIVAL_SENTENCE.test(s) || (INDEFINITE.test(s) && /obligation|dut(?:y|ies)|confidential|التزام|السريه/.test(s)),
  );
  const years = survival.map(survivalYears).find((n) => n !== undefined);
  const indefinite = survival.some((s) => INDEFINITE.test(s));
  const review = hasPolicy
    ? "compare it with the cited playbook clause."
    : "the playbook has no confidentiality standard yet, so review it manually.";
  if (indefinite && years === undefined) {
    return "Indefinite survival term exceeding standard duration guidelines.";
  }
  if (years !== undefined) {
    const tradeSecrets = indefinite && survival.some((s) => /trade secret|اسرار التجاريه/.test(s)) ? " (trade secrets indefinitely)" : "";
    return `Confidentiality survives ${years} year${years === 1 ? "" : "s"}${tradeSecrets}; ${review}`;
  }
  return `This clause states no confidentiality survival term; ${review}`;
}
