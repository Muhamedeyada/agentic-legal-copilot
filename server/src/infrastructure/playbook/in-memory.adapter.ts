import type { ClauseCategory } from "../../domain/entities/clause-category.js";
import type { PlaybookClause } from "../../domain/entities/playbook.js";
import type { PlaybookPort } from "../../domain/ports/playbook.port.js";

const PLAYBOOK: readonly PlaybookClause[] = [
  {
    id: "playbook:en:liability",
    category: "liability",
    language: "en",
    title: "Liability cap (playbook)",
    mandatory: true,
    text: "Each party's aggregate liability is capped at twelve (12) months of fees paid under this agreement, except for fraud, wilful misconduct, or breach of confidentiality.",
  },
  {
    id: "playbook:ar:liability",
    category: "liability",
    language: "ar",
    title: "سقف المسؤولية (دليل المراجعة)",
    mandatory: true,
    text: "تُحد المسؤولية الإجمالية لكل طرف بما يعادل أتعاب اثني عشر (12) شهراً المدفوعة بموجب هذا الاتفاق، باستثناء الاحتيال أو سوء النية أو الإخلال بالسرية.",
  },
  {
    id: "playbook:en:indemnity",
    category: "indemnity",
    language: "en",
    title: "Mutual capped indemnity (playbook)",
    mandatory: true,
    text: "Indemnity is mutual, capped at the liability cap, and excludes indirect damages except for intellectual property infringement.",
  },
  {
    id: "playbook:ar:indemnity",
    category: "indemnity",
    language: "ar",
    title: "تعويض متبادل بسقف (دليل المراجعة)",
    mandatory: true,
    text: "يكون التعويض متبادلاً ومقيداً بسقف المسؤولية، ويُستثنى منه الضرر غير المباشر عدا انتهاك الملكية الفكرية.",
  },
  {
    id: "playbook:en:termination",
    category: "termination",
    language: "en",
    title: "Termination notice (playbook)",
    mandatory: true,
    text: "Either party may terminate for convenience on thirty (30) days' prior written notice. Immediate termination is limited to material uncured breach.",
  },
  {
    id: "playbook:ar:termination",
    category: "termination",
    language: "ar",
    title: "إخطار الإنهاء (دليل المراجعة)",
    mandatory: true,
    text: "يجوز لأي طرف الإنهاء للراحة بموجب إخطار كتابي مسبق مدته ثلاثون (30) يوماً. يقتصر الإنهاء الفوري على الإخلال الجوهري غير المعالج.",
  },
  {
    id: "playbook:en:jurisdiction",
    category: "jurisdiction",
    language: "en",
    title: "Governing law (playbook)",
    mandatory: true,
    text: "This agreement is governed by the laws of England and Wales. The courts of England have exclusive jurisdiction.",
  },
  {
    id: "playbook:ar:jurisdiction",
    category: "jurisdiction",
    language: "ar",
    title: "القانون الحاكم (دليل المراجعة)",
    mandatory: true,
    text: "يخضع هذا الاتفاق لقوانين إنجلترا وويلز، وتكون محاكم إنجلترا صاحبة الاختصاص الحصري.",
  },
  {
    id: "playbook:en:ip",
    category: "ip",
    language: "en",
    title: "IP ownership (playbook)",
    mandatory: false,
    text: "Each party retains its background intellectual property. Customer receives a non-exclusive licence to deliverables. No irrevocable assignment of vendor IP.",
  },
  {
    id: "playbook:ar:ip",
    category: "ip",
    language: "ar",
    title: "الملكية الفكرية (دليل المراجعة)",
    mandatory: false,
    text: "يحتفظ كل طرف بملكيته الفكرية الخلفية. يحصل العميل على ترخيص غير حصري للمخرجات. لا تنازل نهائي عن ملكية المورد.",
  },
  {
    id: "playbook:en:payment",
    category: "payment",
    language: "en",
    title: "Payment (playbook)",
    mandatory: false,
    text: "Invoices are due in thirty (30) days. Late amounts accrue interest at a reasonable statutory rate, not a per-day penalty percentage.",
  },
  {
    id: "playbook:ar:payment",
    category: "payment",
    language: "ar",
    title: "الدفع (دليل المراجعة)",
    mandatory: false,
    text: "تستحق الفواتير خلال ثلاثين (30) يوماً. تستحق المبالغ المتأخرة فائدة بمعدل نظامي معقول وليس غرامة يومية نسبة مئوية.",
  },
];

export class InMemoryPlaybookAdapter implements PlaybookPort {
  async list(): Promise<readonly PlaybookClause[]> {
    return PLAYBOOK;
  }

  async byCategory(
    category: ClauseCategory,
    language?: "ar" | "en",
  ): Promise<readonly PlaybookClause[]> {
    return PLAYBOOK.filter((c) => c.category === category && (!language || c.language === language));
  }
}
