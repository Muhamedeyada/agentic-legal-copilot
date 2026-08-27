import type { ClauseCategory } from "../api/types";
import type { UiLocale } from "../copy";

interface PlaybookRow {
  readonly title: { readonly en: string; readonly ar: string };
  readonly text: { readonly en: string; readonly ar: string };
  readonly guidance: { readonly en: string; readonly ar: string };
}

const PLAYBOOK: Record<ClauseCategory, PlaybookRow> = {
  liability: {
    title: { en: "Liability cap (playbook)", ar: "سقف المسؤولية (دليل المراجعة)" },
    text: {
      en: "Each party's aggregate liability is capped at twelve (12) months of fees paid under this agreement, except for fraud, wilful misconduct, or breach of confidentiality.",
      ar: "تُحد المسؤولية الإجمالية لكل طرف بما يعادل أتعاب اثني عشر (12) شهراً المدفوعة بموجب هذا الاتفاق، باستثناء الاحتيال أو سوء النية أو الإخلال بالسرية.",
    },
    guidance: {
      en: "Flag unlimited, uncapped, or 'no monetary cap' wording. Keep carve-outs narrow: fraud, wilful misconduct, and confidentiality breach. Do not accept consequential-loss carve-ins that swallow the cap.",
      ar: "ارصد صياغة المسؤولية غير المحدودة أو بلا سقف نقدي. أبقِ الاستثناءات ضيقة: الاحتيال وسوء النية والإخلال بالسرية. لا تقبل استثناءات الضرر التبعي التي تفرّغ السقف.",
    },
  },
  indemnity: {
    title: { en: "Mutual capped indemnity (playbook)", ar: "تعويض متبادل بسقف (دليل المراجعة)" },
    text: {
      en: "Indemnity is mutual, capped at the liability cap, and excludes indirect damages except for intellectual property infringement.",
      ar: "يكون التعويض متبادلاً ومقيداً بسقف المسؤولية، ويُستثنى منه الضرر غير المباشر عدا انتهاك الملكية الفكرية.",
    },
    guidance: {
      en: "Indemnity must be mutual and sit inside the liability cap. One-way or uncapped hold-harmless language is a material deviation except for IP infringement.",
      ar: "يجب أن يكون التعويض متبادلاً وداخل سقف المسؤولية. التعويض أحادي الجانب أو بلا سقف انحراف جوهري عدا انتهاك الملكية الفكرية.",
    },
  },
  termination: {
    title: { en: "Termination notice (playbook)", ar: "إخطار الإنهاء (دليل المراجعة)" },
    text: {
      en: "Either party may terminate for convenience on thirty (30) days' prior written notice. Immediate termination is limited to material uncured breach.",
      ar: "يجوز لأي طرف الإنهاء للراحة بموجب إخطار كتابي مسبق مدته ثلاثون (30) يوماً. يقتصر الإنهاء الفوري على الإخلال الجوهري غير المعالج.",
    },
    guidance: {
      en: "Convenience termination needs at least 30 days' written notice. Same-day or one-day notice, or a one-sided walk-away, should be rejected.",
      ar: "إنهاء الراحة يتطلب إخطاراً كتابياً لا يقل عن 30 يوماً. ارفض الإخطار في يوم واحد أو الإنهاء الأحادي بلا سبب.",
    },
  },
  jurisdiction: {
    title: { en: "Governing law (playbook)", ar: "القانون الحاكم (دليل المراجعة)" },
    text: {
      en: "This agreement is governed by the laws of England and Wales. The courts of England have exclusive jurisdiction.",
      ar: "يخضع هذا الاتفاق لقوانين إنجلترا وويلز، وتكون محاكم إنجلترا صاحبة الاختصاص الحصري.",
    },
    guidance: {
      en: "Standard is England and Wales with exclusive English courts. Foreign governing law or non-exclusive venue needs Counsel sign-off.",
      ar: "المعيار هو إنجلترا وويلز مع اختصاص حصري لمحاكم إنجلترا. أي قانون أجنبي أو اختصاص غير حصري يحتاج موافقة المستشار.",
    },
  },
  ip: {
    title: { en: "IP ownership (playbook)", ar: "الملكية الفكرية (دليل المراجعة)" },
    text: {
      en: "Each party retains its background intellectual property. Customer receives a non-exclusive licence to deliverables. No irrevocable assignment of vendor IP.",
      ar: "يحتفظ كل طرف بملكيته الفكرية الخلفية. يحصل العميل على ترخيص غير حصري للمخرجات. لا تنازل نهائي عن ملكية المورد.",
    },
    guidance: {
      en: "Block irrevocable assignment of vendor background IP. Customer should receive a non-exclusive licence to deliverables only.",
      ar: "ارفض التنازل النهائي عن الملكية الفكرية الخلفية للمورد. يحصل العميل على ترخيص غير حصري للمخرجات فقط.",
    },
  },
  payment: {
    title: { en: "Payment (playbook)", ar: "الدفع (دليل المراجعة)" },
    text: {
      en: "Invoices are due in thirty (30) days. Late amounts accrue interest at a reasonable statutory rate, not a per-day penalty percentage.",
      ar: "تستحق الفواتير خلال ثلاثين (30) يوماً. تستحق المبالغ المتأخرة فائدة بمعدل نظامي معقول وليس غرامة يومية نسبة مئوية.",
    },
    guidance: {
      en: "Reject per-day percentage penalties (for example 15% per calendar day). Late sums may accrue a reasonable statutory interest rate only.",
      ar: "ارفض الغرامات اليومية بالنسبة المئوية (مثل 15% عن كل يوم). يجوز احتساب فائدة نظامية معقولة على المتأخر فقط.",
    },
  },
  confidentiality: {
    title: { en: "Confidentiality survival (playbook)", ar: "بقاء السرية (دليل المراجعة)" },
    text: {
      en: "Confidentiality duties survive for three (3) years after termination, and indefinitely for trade secrets.",
      ar: "تسري التزامات السرية ثلاث (3) سنوات بعد الانتهاء، وبصفة دائمة للأسرار التجارية.",
    },
    guidance: {
      en: "Survival should be three years after termination, and indefinite for trade secrets. Open-ended duties on all information are over-broad.",
      ar: "البقاء ثلاث سنوات بعد الانتهاء، وبصفة دائمة للأسرار التجارية. الالتزام المفتوح على كل المعلومات أوسع من المعيار.",
    },
  },
  other: {
    title: { en: "Playbook standard", ar: "معيار دليل المراجعة" },
    text: {
      en: "Align the clause with the review playbook standard.",
      ar: "مواءمة البند مع معيار دليل المراجعة.",
    },
    guidance: {
      en: "No dedicated playbook family. Record the deviation in the memo and ask Counsel whether a fallback is required.",
      ar: "لا توجد عائلة مخصصة في الدليل. سجّل الانحراف في المذكرة واسأل المستشار إن لزم نص بديل.",
    },
  },
};

export function playbookText(category: ClauseCategory, locale: UiLocale): string {
  return PLAYBOOK[category].text[locale];
}

export function playbookTitle(category: ClauseCategory, locale: UiLocale): string {
  return PLAYBOOK[category].title[locale];
}

export function playbookGuidance(category: ClauseCategory, locale: UiLocale): string {
  return PLAYBOOK[category].guidance[locale];
}
