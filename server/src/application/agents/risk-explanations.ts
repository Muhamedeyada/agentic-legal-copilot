import type { ClauseCategory } from "../../domain/entities/clause-category.js";
import { normalizeArabic } from "../../domain/retrieval/arabic-normalize.js";
import { detectRiskFlags } from "./classify.js";

export interface DeviationInput {
  readonly category: ClauseCategory;
  /** Contract clause (heading + body). */
  readonly clauseText: string;
  /** Playbook clause it was compared against; empty when the playbook has no standard. */
  readonly policyText: string;
}

/** Used only when the playbook clause states no notice period of its own. */
const DEFAULT_MIN_NOTICE_DAYS = 30;

/**
 * Category-specific wording for a playbook deviation. Each specific defect is named only when a
 * deterministic check (EN + AR) finds it in the clause; otherwise the note says what is known,
 * so Counsel never reads a defect the system did not detect.
 */
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
  return text
    .split(/(?<=[.!?؟])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function fold(text: string): string {
  return normalizeArabic(text);
}

// --- Liability -------------------------------------------------------------------------------

/** A sentence that excludes indirect / consequential loss, and is not itself disapplied. */
export function excludesConsequentialLoss(text: string): boolean {
  return sentences(text).some((sentence) => {
    const s = fold(sentence);
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

// --- Indemnity -------------------------------------------------------------------------------

function explainIndemnity(text: string): string {
  const s = fold(text);
  const grossNegligenceCarveOut = /gross(?:ly)? negligen|اهمال جسيم|الاهمال الجسيم/.test(s);
  // "shall not be subject to any monetary cap" mentions a cap without imposing one.
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

// --- Termination -----------------------------------------------------------------------------

/** Shortest notice period (in days) stated in sentences about notice. */
export function shortestNoticeDays(text: string): number | undefined {
  const days: number[] = [];
  for (const sentence of sentences(text)) {
    const s = fold(sentence);
    if (!/notice|اخطار|مهله/.test(s)) {
      continue;
    }
    if (detectRiskFlags(sentence).oneDayTermination) {
      days.push(1);
    }
    for (const m of s.matchAll(/\(?(\d{1,3})\)?\s*(?:calendar\s+|business\s+)?days?\b/g)) {
      days.push(Number(m[1]));
    }
    for (const m of s.matchAll(/\(?(\d{1,3})\)?\s*(?:يوم|ايام)/g)) {
      days.push(Number(m[1]));
    }
  }
  return days.length > 0 ? Math.min(...days) : undefined;
}

/** A termination right granted to one named party rather than to either party. */
export function isOneSidedTermination(text: string): boolean {
  return sentences(text).some((sentence) => {
    const s = fold(sentence);
    const en = /^(.*?)\b(?:may|can|is entitled to|shall have the right to)\s+terminate\b/.exec(s);
    if (en) {
      return !/\b(?:either|each|any|both)\s+part(?:y|ies)\b|\bthe parties\b/.test(en[1] ?? "");
    }
    // "يجوز لمقدم الخدمة إنهاء" is one-sided; "يجوز لأي طرف" / "لكل طرف" is not.
    const ar = /(?:يجوز|يحق)\s+ل(\S+)[^.]*?(?:انهاء|الانهاء)/.exec(s);
    return ar ? !/^(?:اي|كل|لطرفين|طرفين)$/.test(ar[1] ?? "") && !/الطرفين/.test(s) : false;
  });
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
    return "Asymmetric termination right: only one named party may terminate.";
  }
  return "Termination terms deviate from the cited playbook clause.";
}

// --- Jurisdiction ----------------------------------------------------------------------------

/** The law named in a "governed by …" / "يخضع هذا العقد لـ …" sentence. */
export function governingLaw(text: string): string | undefined {
  const en = /governed by\s+(?:the\s+)?(?:laws?\s+of\s+)?(?:the\s+)?([^,.;\n]+)/i.exec(text);
  if (en?.[1]) {
    return en[1].trim();
  }
  const ar = /(?:يخضع|تخضع)\s+هذ[اه]\s+(?:العقد|الاتفاق|الاتفاقية)\s+(?:لـ\s*|ل)([^.،\n]+?)(?=\s+دون|[.،\n]|$)/u.exec(text);
  return ar?.[1]?.trim();
}

function lawKey(law: string): string {
  return fold(law)
    .replace(/\b(?:the|laws?|of|state|federal republic)\b/g, " ")
    .replace(/قوانين|قانون|انظمه|امارة|اماره/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function explainJurisdiction(text: string, policyText: string): string {
  const law = governingLaw(text);
  const standard = governingLaw(policyText);
  if (!law) {
    return standard
      ? `No governing law identified in the clause; the playbook default is ${standard}.`
      : "No governing law identified in the clause.";
  }
  if (standard && lawKey(law) !== lawKey(standard)) {
    return `Designated foreign governing law (${law}) deviates from default domestic venue (${standard}).`;
  }
  return "Governing law matches the playbook, but the venue or forum wording deviates.";
}

// --- Confidentiality -------------------------------------------------------------------------

function explainConfidentiality(text: string, hasPolicy: boolean): string {
  const s = fold(text);
  const years = /\(?(\d{1,2})\)?\s*years?\b/.exec(s)?.[1] ?? /\(?(\d{1,2})\)?\s*(?:سنوات|سنه)/.exec(s)?.[1];
  const indefinite = /indefinite|perpetu|without (?:time )?limit|بصفه دائمه|الي اجل غير مسمي|غير محدد المده/.test(s);
  const review = hasPolicy ? "compare it with the cited playbook clause." : "the playbook has no confidentiality standard yet, so review it manually.";
  if (indefinite && years === undefined) {
    return "Indefinite survival term exceeding standard duration guidelines.";
  }
  if (years !== undefined) {
    const tradeSecrets = indefinite && /trade secret|اسرار التجاريه/.test(s) ? " (trade secrets indefinitely)" : "";
    return `Confidentiality survives ${years} year${years === "1" ? "" : "s"}${tradeSecrets}; ${review}`;
  }
  return `This clause states no confidentiality survival term; ${review}`;
}
