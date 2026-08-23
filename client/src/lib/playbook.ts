import type { ClauseCategory } from "../api/types";
import type { UiLocale } from "../copy";

const PLAYBOOK: Record<ClauseCategory, { en: string; ar: string }> = {
  liability: {
    en: "Each party's aggregate liability is capped at twelve (12) months of fees paid under this agreement, except for fraud, wilful misconduct, or breach of confidentiality.",
    ar: "تُحد المسؤولية الإجمالية لكل طرف بما يعادل أتعاب اثني عشر (12) شهراً المدفوعة بموجب هذا الاتفاق، باستثناء الاحتيال أو سوء النية أو الإخلال بالسرية.",
  },
  indemnity: {
    en: "Indemnity is mutual, capped at the liability cap, and excludes indirect damages except for intellectual property infringement.",
    ar: "يكون التعويض متبادلاً ومقيداً بسقف المسؤولية، ويُستثنى منه الضرر غير المباشر عدا انتهاك الملكية الفكرية.",
  },
  termination: {
    en: "Either party may terminate for convenience on thirty (30) days' prior written notice. Immediate termination is limited to material uncured breach.",
    ar: "يجوز لأي طرف الإنهاء للراحة بموجب إخطار كتابي مسبق مدته ثلاثون (30) يوماً. يقتصر الإنهاء الفوري على الإخلال الجوهري غير المعالج.",
  },
  jurisdiction: {
    en: "This agreement is governed by the laws of England and Wales. The courts of England have exclusive jurisdiction.",
    ar: "يخضع هذا الاتفاق لقوانين إنجلترا وويلز، وتكون محاكم إنجلترا صاحبة الاختصاص الحصري.",
  },
  ip: {
    en: "Each party retains its background intellectual property. Customer receives a non-exclusive licence to deliverables. No irrevocable assignment of vendor IP.",
    ar: "يحتفظ كل طرف بملكيته الفكرية الخلفية. يحصل العميل على ترخيص غير حصري للمخرجات. لا تنازل نهائي عن ملكية المورد.",
  },
  payment: {
    en: "Invoices are due in thirty (30) days. Late amounts accrue interest at a reasonable statutory rate, not a per-day penalty percentage.",
    ar: "تستحق الفواتير خلال ثلاثين (30) يوماً. تستحق المبالغ المتأخرة فائدة بمعدل نظامي معقول وليس غرامة يومية نسبة مئوية.",
  },
  confidentiality: {
    en: "Confidentiality duties survive for three (3) years after termination, and indefinitely for trade secrets.",
    ar: "تسري التزامات السرية ثلاث (3) سنوات بعد الانتهاء، وبصفة دائمة للأسرار التجارية.",
  },
  other: {
    en: "Align the clause with the review playbook standard.",
    ar: "مواءمة البند مع معيار دليل المراجعة.",
  },
};

export function playbookText(category: ClauseCategory, locale: UiLocale): string {
  return PLAYBOOK[category][locale];
}
