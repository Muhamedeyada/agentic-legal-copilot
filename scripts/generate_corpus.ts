/**
 * D1T1 synthetic bilingual legal corpus.
 * Run from repo root: npx tsx scripts/generate_corpus.ts
 *
 * All documents are fictional. No real parties or personal data.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "corpus");

export type Language = "ar" | "en";
export type ContractType = "nda" | "sla" | "msa" | "saas" | "employment";
export type RiskCode =
  | "unlimited_liability"
  | "one_day_termination"
  | "unilateral_ip"
  | "uncapped_indemnity"
  | "punitive_late_fees";

export interface DocSpec {
  id: string;
  language: Language;
  contractType: ContractType;
  version: string;
  effectiveDate: string;
  titleEn: string;
  titleAr: string;
  partyA: string;
  partyB: string;
  governingLaw: string;
  venue: string;
  currency: string;
  amount: string;
  noticeDays: number;
  liabilityCapMonths: number;
  risk?: RiskCode;
}

export interface ManifestEntry {
  document_id: string;
  filename: string;
  language: Language;
  contract_type: ContractType;
  version: string;
  effective_date: string;
  title: string;
  parties: { disclosing_or_provider: string; receiving_or_customer: string };
  governing_law: string;
  clause_types: string[];
  high_risk: boolean;
  risk_indicators: Array<{
    code: RiskCode;
    article: string;
    summary: string;
  }>;
  synthetic: true;
}

const CLAUSE_TYPES = [
  "confidentiality",
  "liability_indemnification",
  "termination_notice",
  "governing_law_dispute_resolution",
  "payment_terms_penalties",
] as const;

const SPECS: DocSpec[] = [
  // --- NDAs (8) ---
  {
    id: "D1T1-EN-NDA-001",
    language: "en",
    contractType: "nda",
    version: "1.2",
    effectiveDate: "2024-01-15",
    titleEn: "Mutual Non-Disclosure Agreement",
    titleAr: "اتفاقية عدم إفشاء متبادلة",
    partyA: "Helios Analytics Ltd",
    partyB: "Nile Delta Trading SAE",
    governingLaw: "England and Wales",
    venue: "London",
    currency: "GBP",
    amount: "0",
    noticeDays: 30,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-EN-NDA-002",
    language: "en",
    contractType: "nda",
    version: "1.0",
    effectiveDate: "2024-03-01",
    titleEn: "One-Way Non-Disclosure Agreement",
    titleAr: "اتفاقية عدم إفشاء أحادية",
    partyA: "Cobalt Systems GmbH",
    partyB: "Qantara Retail LLC",
    governingLaw: "laws of the Federal Republic of Germany",
    venue: "Frankfurt am Main",
    currency: "EUR",
    amount: "0",
    noticeDays: 14,
    liabilityCapMonths: 6,
  },
  {
    id: "D1T1-EN-NDA-003",
    language: "en",
    contractType: "nda",
    version: "1.1",
    effectiveDate: "2024-06-10",
    titleEn: "Mutual Confidentiality Deed",
    titleAr: "صك سرية متبادل",
    partyA: "Meridian Cloud Inc",
    partyB: "Atlas Freight LLC",
    governingLaw: "State of Delaware",
    venue: "Wilmington, Delaware",
    currency: "USD",
    amount: "0",
    noticeDays: 30,
    liabilityCapMonths: 12,
    risk: "unlimited_liability",
  },
  {
    id: "D1T1-EN-NDA-004",
    language: "en",
    contractType: "nda",
    version: "2.0",
    effectiveDate: "2025-02-01",
    titleEn: "Evaluation NDA (Pilot Disclosure)",
    titleAr: "اتفاقية سرية لتقييم تجريبي",
    partyA: "Saffron Labs Pte Ltd",
    partyB: "Red Sea Ports Authority Contracting Co",
    governingLaw: "Singapore",
    venue: "Singapore",
    currency: "SGD",
    amount: "0",
    noticeDays: 21,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-NDA-001",
    language: "ar",
    contractType: "nda",
    version: "1.0",
    effectiveDate: "2024-02-20",
    titleEn: "Mutual NDA",
    titleAr: "اتفاقية عدم إفشاء أسرار متبادلة",
    partyA: "شركة أفق التقنية ش.ذ.م.م",
    partyB: "شركة وادي النيل للتوزيع ش.م.م",
    governingLaw: "قوانين جمهورية مصر العربية",
    venue: "القاهرة",
    currency: "EGP",
    amount: "0",
    noticeDays: 30,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-NDA-002",
    language: "ar",
    contractType: "nda",
    version: "1.3",
    effectiveDate: "2024-05-08",
    titleEn: "Unilateral NDA",
    titleAr: "اتفاقية عدم إفشاء أحادية الجانب",
    partyA: "شركة مدارات البرمجيات ش.ش.و",
    partyB: "مؤسسة الخليج للخدمات اللوجستية",
    governingLaw: "قوانين دولة الإمارات العربية المتحدة",
    venue: "دبي",
    currency: "AED",
    amount: "0",
    noticeDays: 15,
    liabilityCapMonths: 6,
  },
  {
    id: "D1T1-AR-NDA-003",
    language: "ar",
    contractType: "nda",
    version: "1.0",
    effectiveDate: "2024-09-01",
    titleEn: "Joint venture NDA",
    titleAr: "اتفاقية سرية لمشروع مشترك",
    partyA: "شركة النور للاستشارات المالية",
    partyB: "شركة الرمال الذهبية للتطوير العقاري",
    governingLaw: "أنظمة المملكة العربية السعودية",
    venue: "الرياض",
    currency: "SAR",
    amount: "0",
    noticeDays: 30,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-NDA-004",
    language: "ar",
    contractType: "nda",
    version: "1.1",
    effectiveDate: "2025-01-12",
    titleEn: "Supplier NDA",
    titleAr: "اتفاقية سرية مع مورد",
    partyA: "شركة جسور البيانات ش.م.خ",
    partyB: "مصنع الدلتا للصناعات الغذائية",
    governingLaw: "قوانين سلطنة عمان",
    venue: "مسقط",
    currency: "OMR",
    amount: "0",
    noticeDays: 20,
    liabilityCapMonths: 12,
  },
  // --- SLAs (6) ---
  {
    id: "D1T1-EN-SLA-001",
    language: "en",
    contractType: "sla",
    version: "3.0",
    effectiveDate: "2024-04-01",
    titleEn: "Managed Hosting Service Level Agreement",
    titleAr: "اتفاقية مستوى خدمة للاستضافة المدارة",
    partyA: "Lumen Hosting Ltd",
    partyB: "Cairo Medical Records Co",
    governingLaw: "England and Wales",
    venue: "London",
    currency: "GBP",
    amount: "48000",
    noticeDays: 60,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-EN-SLA-002",
    language: "en",
    contractType: "sla",
    version: "2.1",
    effectiveDate: "2024-07-15",
    titleEn: "Payment Gateway Availability SLA",
    titleAr: "اتفاقية مستوى خدمة لبوابة الدفع",
    partyA: "Riviera Payments Inc",
    partyB: "Souk Marketplace LLC",
    governingLaw: "DIFC law",
    venue: "Dubai International Financial Centre",
    currency: "USD",
    amount: "120000",
    noticeDays: 45,
    liabilityCapMonths: 6,
  },
  {
    id: "D1T1-EN-SLA-003",
    language: "en",
    contractType: "sla",
    version: "1.4",
    effectiveDate: "2025-03-01",
    titleEn: "SOC Support Desk SLA",
    titleAr: "اتفاقية مستوى خدمة لمكتب أمن المعلومات",
    partyA: "Nightwatch SOC Ltd",
    partyB: "Harbor Bank SAE",
    governingLaw: "Arab Republic of Egypt",
    venue: "Cairo",
    currency: "EGP",
    amount: "900000",
    noticeDays: 30,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-SLA-001",
    language: "ar",
    contractType: "sla",
    version: "2.0",
    effectiveDate: "2024-04-12",
    titleEn: "Cloud uptime SLA",
    titleAr: "اتفاقية مستوى الخدمة للحوسبة السحابية",
    partyA: "شركة سحاب المشرق لتقنية المعلومات",
    partyB: "هيئة الخدمات البلدية التجريبية",
    governingLaw: "قوانين إمارة أبوظبي",
    venue: "أبوظبي",
    currency: "AED",
    amount: "360000",
    noticeDays: 60,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-SLA-002",
    language: "ar",
    contractType: "sla",
    version: "1.0",
    effectiveDate: "2024-08-20",
    titleEn: "Helpdesk SLA",
    titleAr: "اتفاقية مستوى خدمة لمكتب الدعم الفني",
    partyA: "شركة خط الدعم الذكي",
    partyB: "جامعة النيل الأهلية (وحدة التحول الرقمي)",
    governingLaw: "قوانين جمهورية مصر العربية",
    venue: "الجيزة",
    currency: "EGP",
    amount: "240000",
    noticeDays: 1,
    liabilityCapMonths: 6,
    risk: "one_day_termination",
  },
  {
    id: "D1T1-AR-SLA-003",
    language: "ar",
    contractType: "sla",
    version: "1.2",
    effectiveDate: "2025-01-05",
    titleEn: "Network SLA",
    titleAr: "اتفاقية مستوى خدمة لشبكة الاتصالات",
    partyA: "شركة ألياف الصحراء للاتصالات",
    partyB: "مجموعة التمور التجارية",
    governingLaw: "أنظمة المملكة العربية السعودية",
    venue: "الدمام",
    currency: "SAR",
    amount: "540000",
    noticeDays: 90,
    liabilityCapMonths: 12,
  },
  // --- MSAs (6) ---
  {
    id: "D1T1-EN-MSA-001",
    language: "en",
    contractType: "msa",
    version: "4.0",
    effectiveDate: "2023-11-01",
    titleEn: "Master Services Agreement — Systems Integration",
    titleAr: "اتفاقية خدمات رئيسية — تكامل أنظمة",
    partyA: "Oakridge Integration Ltd",
    partyB: "Delta Cement Holding SAE",
    governingLaw: "England and Wales",
    venue: "Manchester",
    currency: "GBP",
    amount: "850000",
    noticeDays: 90,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-EN-MSA-002",
    language: "en",
    contractType: "msa",
    version: "2.2",
    effectiveDate: "2024-09-01",
    titleEn: "Master Professional Services Agreement",
    titleAr: "اتفاقية خدمات مهنية رئيسية",
    partyA: "Brightline Advisory LLP",
    partyB: "Maghreb Telecoms Ltd",
    governingLaw: "laws of the State of New York",
    venue: "New York County",
    currency: "USD",
    amount: "1500000",
    noticeDays: 60,
    liabilityCapMonths: 18,
  },
  {
    id: "D1T1-EN-MSA-003",
    language: "en",
    contractType: "msa",
    version: "1.0",
    effectiveDate: "2025-04-01",
    titleEn: "Outsourcing Master Agreement",
    titleAr: "اتفاقية إسناد رئيسية",
    partyA: "Peninsula BPO Pte Ltd",
    partyB: "Levant Insurance Co",
    governingLaw: "Singapore",
    venue: "Singapore",
    currency: "USD",
    amount: "620000",
    noticeDays: 120,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-MSA-001",
    language: "ar",
    contractType: "msa",
    version: "3.1",
    effectiveDate: "2024-01-07",
    titleEn: "IT MSA",
    titleAr: "اتفاقية تقديم الخدمات الرئيسية لتقنية المعلومات",
    partyA: "شركة بناء النظم المتكاملة",
    partyB: "بنك القناة التجاري",
    governingLaw: "قوانين جمهورية مصر العربية",
    venue: "الإسكندرية",
    currency: "EGP",
    amount: "12500000",
    noticeDays: 90,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-MSA-002",
    language: "ar",
    contractType: "msa",
    version: "1.0",
    effectiveDate: "2024-06-18",
    titleEn: "Consulting MSA",
    titleAr: "اتفاقية خدمات استشارية رئيسية",
    partyA: "مكتب المشرق للحوكمة والمخاطر",
    partyB: "شركة الأنابيب الصناعية ش.م.ع",
    governingLaw: "قوانين مركز دبي المالي العالمي",
    venue: "مركز دبي المالي العالمي",
    currency: "AED",
    amount: "2100000",
    noticeDays: 60,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-MSA-003",
    language: "ar",
    contractType: "msa",
    version: "2.0",
    effectiveDate: "2024-12-01",
    titleEn: "Facilities + IT MSA",
    titleAr: "اتفاقية خدمات رئيسية للتشغيل والصيانة المعلوماتية",
    partyA: "شركة إسناد الخليج للتشغيل",
    partyB: "الهيئة التجريبية للمناطق الصناعية",
    governingLaw: "أنظمة المملكة العربية السعودية",
    venue: "جدة",
    currency: "SAR",
    amount: "7800000",
    noticeDays: 90,
    liabilityCapMonths: 12,
    risk: "uncapped_indemnity",
  },
  // --- SaaS / licensing (6) ---
  {
    id: "D1T1-EN-SAAS-001",
    language: "en",
    contractType: "saas",
    version: "5.0",
    effectiveDate: "2024-05-01",
    titleEn: "SaaS Subscription and Software Licence Agreement",
    titleAr: "اتفاقية اشتراك وترخيص برمجيات كخدمة",
    partyA: "Folio Workspace Inc",
    partyB: "North Africa Legal Aid Foundation",
    governingLaw: "State of California",
    venue: "San Francisco County",
    currency: "USD",
    amount: "36000",
    noticeDays: 30,
    liabilityCapMonths: 12,
    risk: "unilateral_ip",
  },
  {
    id: "D1T1-EN-SAAS-002",
    language: "en",
    contractType: "saas",
    version: "2.3",
    effectiveDate: "2024-10-01",
    titleEn: "On-Premises Software Licence (Perpetual, Support Annual)",
    titleAr: "ترخيص برمجيات محلي دائم مع دعم سنوي",
    partyA: "Kestrel ERP Ltd",
    partyB: "Nile Cotton Mills SAE",
    governingLaw: "England and Wales",
    venue: "Leeds",
    currency: "GBP",
    amount: "220000",
    noticeDays: 90,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-EN-SAAS-003",
    language: "en",
    contractType: "saas",
    version: "1.6",
    effectiveDate: "2025-02-14",
    titleEn: "API Access and Developer Licence",
    titleAr: "اتفاقية ترخيص واجهة برمجة التطبيقات",
    partyA: "Mapline Geospatial Ltd",
    partyB: "Urban Mobility Cairo LLC",
    governingLaw: "Ireland",
    venue: "Dublin",
    currency: "EUR",
    amount: "18000",
    noticeDays: 30,
    liabilityCapMonths: 3,
  },
  {
    id: "D1T1-AR-SAAS-001",
    language: "ar",
    contractType: "saas",
    version: "3.0",
    effectiveDate: "2024-03-22",
    titleEn: "HR SaaS",
    titleAr: "اتفاقية اشتراك في نظام موارد بشرية سحابي",
    partyA: "شركة موارد السحاب للبرمجيات",
    partyB: "مجموعة الفنار للتجزئة",
    governingLaw: "قوانين دولة الإمارات العربية المتحدة",
    venue: "الشارقة",
    currency: "AED",
    amount: "144000",
    noticeDays: 30,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-SAAS-002",
    language: "ar",
    contractType: "saas",
    version: "1.1",
    effectiveDate: "2024-11-11",
    titleEn: "Document management SaaS",
    titleAr: "اتفاقية ترخيص نظام إدارة المستندات",
    partyA: "شركة أرشيف النيل الرقمية",
    partyB: "مكتب الشروق للمحاماة والاستشارات",
    governingLaw: "قوانين جمهورية مصر العربية",
    venue: "القاهرة",
    currency: "EGP",
    amount: "180000",
    noticeDays: 45,
    liabilityCapMonths: 12,
  },
  {
    id: "D1T1-AR-SAAS-003",
    language: "ar",
    contractType: "saas",
    version: "2.0",
    effectiveDate: "2025-01-20",
    titleEn: "Billing SaaS",
    titleAr: "اتفاقية برمجيات فوترة سحابية",
    partyA: "شركة حسابات المشرق",
    partyB: "شركة المياه المعبأة الصفوة",
    governingLaw: "أنظمة المملكة العربية السعودية",
    venue: "الخبر",
    currency: "SAR",
    amount: "96000",
    noticeDays: 30,
    liabilityCapMonths: 6,
  },
  // --- Employment & consulting (6) ---
  {
    id: "D1T1-EN-EMP-001",
    language: "en",
    contractType: "employment",
    version: "1.0",
    effectiveDate: "2024-02-01",
    titleEn: "Contract of Employment — Senior Counsel",
    titleAr: "عقد عمل — مستشار قانوني أول",
    partyA: "Helios Analytics Ltd",
    partyB: "Amira N. (synthetic employee identifier EMP-4412)",
    governingLaw: "England and Wales",
    venue: "London",
    currency: "GBP",
    amount: "92000",
    noticeDays: 90,
    liabilityCapMonths: 0,
  },
  {
    id: "D1T1-EN-EMP-002",
    language: "en",
    contractType: "employment",
    version: "1.2",
    effectiveDate: "2024-08-01",
    titleEn: "Independent Contractor Agreement — Data Engineer",
    titleAr: "عقد استشارات — مهندس بيانات",
    partyA: "Riviera Payments Inc",
    partyB: "Kite Systems Studio Ltd (contractor)",
    governingLaw: "State of Delaware",
    venue: "Wilmington, Delaware",
    currency: "USD",
    amount: "14000",
    noticeDays: 14,
    liabilityCapMonths: 1,
    risk: "punitive_late_fees",
  },
  {
    id: "D1T1-EN-EMP-003",
    language: "en",
    contractType: "employment",
    version: "1.0",
    effectiveDate: "2025-03-15",
    titleEn: "Fixed-Term Consulting Agreement — Playbook Author",
    titleAr: "عقد استشارات محدد المدة — إعداد دليل تعاقدي",
    partyA: "Oakridge Integration Ltd",
    partyB: "Cedar Clause Review Ltd",
    governingLaw: "Ireland",
    venue: "Dublin",
    currency: "EUR",
    amount: "65000",
    noticeDays: 30,
    liabilityCapMonths: 6,
  },
  {
    id: "D1T1-AR-EMP-001",
    language: "ar",
    contractType: "employment",
    version: "1.0",
    effectiveDate: "2024-03-01",
    titleEn: "Employment contract",
    titleAr: "عقد عمل محدد المدة — أخصائي امتثال",
    partyA: "شركة أفق التقنية ش.ذ.م.م",
    partyB: "الموظف الاصطناعي رقم EMP-7781",
    governingLaw: "قانون العمل الإماراتي والأنظمة ذات الصلة",
    venue: "دبي",
    currency: "AED",
    amount: "216000",
    noticeDays: 30,
    liabilityCapMonths: 0,
  },
  {
    id: "D1T1-AR-EMP-002",
    language: "ar",
    contractType: "employment",
    version: "1.1",
    effectiveDate: "2024-09-15",
    titleEn: "Consulting retainer",
    titleAr: "عقد استشارات قانونية على أساس أتعاب شهرية",
    partyA: "بنك القناة التجاري",
    partyB: "مكتب النيل للاستشارات القانونية",
    governingLaw: "قوانين جمهورية مصر العربية",
    venue: "القاهرة",
    currency: "EGP",
    amount: "85000",
    noticeDays: 60,
    liabilityCapMonths: 6,
  },
  {
    id: "D1T1-AR-EMP-003",
    language: "ar",
    contractType: "employment",
    version: "1.0",
    effectiveDate: "2025-02-01",
    titleEn: "Part-time employment",
    titleAr: "عقد عمل بدوام جزئي — مترجم قانوني",
    partyA: "شركة أرشيف النيل الرقمية",
    partyB: "الموظف الاصطناعي رقم EMP-2209",
    governingLaw: "قانون العمل المصري",
    venue: "المنصورة",
    currency: "EGP",
    amount: "72000",
    noticeDays: 15,
    liabilityCapMonths: 0,
  },
];

function yamlFrontmatter(spec: DocSpec): string {
  return [
    "---",
    `document_id: ${spec.id}`,
    `language: ${spec.language}`,
    `contract_type: ${spec.contractType}`,
    `version: ${spec.version}`,
    `effective_date: ${spec.effectiveDate}`,
    `governing_law: "${spec.governingLaw.replaceAll('"', "'")}"`,
    `venue: "${spec.venue.replaceAll('"', "'")}"`,
    `synthetic: true`,
    `personal_data: none`,
    spec.risk ? `risk_flag: ${spec.risk}` : "risk_flag: none",
    "---",
    "",
  ].join("\n");
}

function confidentialityEn(spec: DocSpec): string {
  return `## ${article(spec, "confidentiality")}. Confidentiality

${spec.partyB} shall keep confidential all non-public information disclosed by ${spec.partyA} in connection with the discussions contemplated by this instrument, including technical specifications, customer lists, pricing models, source code fragments, and negotiation positions (the "Confidential Information"). Confidential Information does not include information that is or becomes public other than by breach, was independently developed without use of the discloser's materials, or is received from a third party without duty of confidence.

The receiving party shall restrict access to personnel with a need to know who are bound by written duties no less protective than this clause, and shall not reverse engineer any software provided solely for evaluation. Upon written request, tangible Confidential Information shall be returned or destroyed, save for one copy retained in backup media or as required by law, which remains subject to this clause.

The duties in this clause survive for three (3) years after termination, and indefinitely for trade secrets so long as they remain trade secrets under applicable law. Compelled disclosure is permitted to the extent required by a competent authority, provided the receiving party gives prompt notice where legally allowed so the disclosing party may seek a protective order.`;
}

function confidentialityAr(spec: DocSpec): string {
  return `## ${article(spec, "confidentiality")}. السرية

يلتزم ${spec.partyB} بالمحافظة على سرية جميع المعلومات غير العلنية التي يفصح عنها ${spec.partyA} بمناسبة هذا العقد، بما في ذلك المواصفات الفنية وقوائم العملاء ونماذج التسعير وأجزاء الشفرة المصدرية ومواقف التفاوض ("المعلومات السرية"). لا تشمل المعلومات السرية ما أصبح عاماً دون إخلال، أو ما طُوّر مستقلاً دون استخدام مواد الطرف المفصح، أو ما ورد من الغير دون التزام بالسرية.

يُقيَّد الاطلاع على من يحتاج إليه من العاملين المرتبطين بواجبات كتابية لا تقل حماية عن هذا البند، ويُحظر الهندسة العكسية لأي برمجيات قُدمت للتقييم فقط. عند الطلب الكتابي تُعاد المواد أو تُتلف، مع جواز الاحتفاظ بنسخة واحدة في وسائط النسخ الاحتياطي أو حيث يفرض القانون، وتبقى خاضعة لهذا البند.

تسري التزامات السرية لمدة ثلاث (3) سنوات بعد انتهاء العقد، وبصفة دائمة للأسرار التجارية ما بقيت كذلك قانوناً. ويجوز الإفصاح الإلزامي بالقدر الذي تطلبه جهة مختصة مع إخطار الطرف المفصح حيث يسمح القانون ليتسنى طلب أمر حماية.`;
}

function paymentEn(spec: DocSpec): string {
  if (spec.risk === "punitive_late_fees") {
    return `## ${article(spec, "payment")}. Fees, Invoicing and Charges

Fees are ${spec.currency} ${spec.amount} per month, exclusive of tax, invoiced in arrears. Invoices are due on presentation. For the avoidance of doubt, and without limiting any other remedy, any amount not received in cleared funds by 17:00 in the billing time zone on the due date shall accrue an administrative charge equal to fifteen percent (15%) of the then-outstanding balance for each calendar day of delay, compounding daily, in addition to statutory interest. The parties agree this charge is a genuine pre-estimate of the cost of accelerated treasury operations and is payable without demand.

${spec.partyA} may suspend services immediately if any invoice is overdue, without a cure period. Set-off by ${spec.partyB} is excluded.`;
  }
  const due = spec.contractType === "employment" ? "monthly in arrears within 14 days" : "within thirty (30) days of invoice";
  return `## ${article(spec, "payment")}. Payment Terms and Service Credits

Unless a statement of work says otherwise, charges are denominated in ${spec.currency}. Where a recurring fee applies, the annualised commercial value referenced for liability purposes is ${spec.currency} ${spec.amount}. Invoices are issued monthly and payable ${due}. Overdue sums accrue interest at two percent (2%) per annum above the Bank of England base rate (or the equivalent policy rate of the governing-law jurisdiction), calculated daily, after a ten (10) business day grace period.

Service credits, if any, are ${spec.partyB}'s sole financial remedy for unavailability and are capped at fifteen percent (15%) of the monthly fee for the affected service. Credits are not refunds and expire if unused at the next renewal. Taxes are extra. The customer may not withhold or set off disputed amounts exceeding five percent (5%) of the relevant invoice without written notice specifying the dispute.`;
}

function paymentAr(spec: DocSpec): string {
  return `## ${article(spec, "payment")}. شروط الدفع والغرامات

تكون المبالغ بعملة ${spec.currency}. وعند وجود مقابل دوري يُعتمد للقيمة السنوية المشار إليها في تحديد سقف المسؤولية مبلغ ${spec.currency} ${spec.amount}. تُصدر الفواتير شهرياً وتُسدد خلال ثلاثين (30) يوماً من تاريخ الفاتورة، ما لم يُنص في أمر عمل على خلاف ذلك. وتستحق المبالغ المتأخرة فائدة بسيطة قدرها اثنان بالمائة (2%) سنوياً فوق سعر الإقراض المعلن من البنك المركزي المختص بعد مهلة سماح عشرة (10) أيام عمل.

أي أرصدة خدمة (إن وُجدت) هي التعويض المالي الوحيد عن عدم التوافر وبحد أقصى خمسة عشر بالمائة (15%) من الرسم الشهري للخدمة المتأثرة، ولا تُعد استرداداً نقدياً. الضرائب إضافية. ولا يجوز للعميل حبس أو مقاصة مبلغ متنازع عليه يزيد على خمسة بالمائة (5%) من الفاتورة دون إخطار كتابي ببيان النزاع.`;
}

function liabilityEn(spec: DocSpec): string {
  if (spec.risk === "unlimited_liability") {
    return `## ${article(spec, "liability")}. Liability and Indemnification

Each party indemnifies the other against third-party claims arising from breach of confidentiality or infringement of Intellectual Property Rights by the indemnifying party's materials. Nothing in this deed limits liability for fraud, death or personal injury caused by negligence, or any liability that cannot be limited by law.

**8.2 Cap.** For the avoidance of doubt, the parties intend that liability arising under or in connection with this deed — including for confidentiality breach, negligence, misrepresentation and consequential, incidental, indirect, special or punitive loss, lost profits, lost data and loss of goodwill — shall not be subject to any monetary cap and shall not be limited by reference to fees paid or payable. The exclusion of indirect loss that appears in the standard playbook of ${spec.partyA} is expressly disapplied between the parties. Each party shall maintain insurance but the existence of insurance does not cap recoverable loss.`;
  }
  if (spec.risk === "uncapped_indemnity") {
    return `## ${article(spec, "liability")}. Liability and Indemnification

Subject to the next sentence, each party's aggregate liability in a contract year is limited to the fees paid in the twelve (12) months preceding the claim. The limitation does not apply to the indemnity in this clause: ${spec.partyB} shall indemnify, defend and hold harmless ${spec.partyA} and its officers from and against any and all losses, damages, liabilities, costs and expenses (including reasonable legal fees), whether direct, indirect, incidental, consequential, special or punitive, arising out of or related to the services, data processing, or any third-party claim, without any monetary ceiling and without regard to the liability cap stated above.`;
  }
  const months = spec.liabilityCapMonths || 12;
  return `## ${article(spec, "liability")}. Liability and Indemnification

Neither party is liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue, goodwill or anticipated savings, whether in contract, tort or otherwise, even if advised of the possibility.

Except for (a) fraud, (b) death or personal injury caused by negligence, (c) breach of confidentiality, and (d) infringement of the other party's Intellectual Property Rights, each party's aggregate liability arising out of this agreement is limited to the fees paid by ${spec.partyB} to ${spec.partyA} in the ${months} months immediately preceding the event giving rise to the claim (or, if no fees are payable, ${spec.currency} 50,000).

Each party shall indemnify the other against third-party claims to the extent caused by the indemnifying party's wilful misconduct or material breach of confidentiality, subject always to the cap in this clause except for fraud. The indemnified party shall give prompt notice and reasonable cooperation, and shall not settle without consent not to be unreasonably withheld.`;
}

function liabilityAr(spec: DocSpec): string {
  if (spec.risk === "uncapped_indemnity") {
    return `## ${article(spec, "liability")}. المسؤولية والتعويض

مع مراعاة الجملة التالية، يقتصر مجموع مسؤولية أي طرف في السنة التعاقدية على الرسوم المدفوعة خلال الاثني عشر شهراً السابقة للمطالبة. ولا يسري هذا السقف على التزام التعويض الآتي: يتحمل ${spec.partyB} تعويض ${spec.partyA} ومسؤوليه وإبراء ذمتهم عن أي خسائر أو أضرار أو التزامات أو تكاليف أو مصروفات (بما فيها أتعاب المحاماة المعقولة) سواء كانت مباشرة أو غير مباشرة أو عرضية أو تبعية أو خاصة أو عقابية، الناشئة عن الخدمات أو معالجة البيانات أو أي مطالبة للغير، وذلك دون أي حد أقصى نقدي وبصرف النظر عن سقف المسؤولية المذكور أعلاه.`;
  }
  if (spec.risk === "unlimited_liability") {
    return `## ${article(spec, "liability")}. المسؤولية والتعويض

يعوّض كل طرف الآخر عن مطالبات الغير الناشئة عن الإخلال بالسرية أو التعدي على حقوق الملكية الفكرية. لا يُحد من المسؤولية عن الغش أو الوفاة أو الإصابة البدنية الناشئة عن الإهمال.

ولرفع اللبس، تتفق الأطراف على ألا تخضع المسؤولية الناشئة عن هذا العقد — بما فيها الإخلال بالسرية والإهمال والتضليل والخسارة التبعية وغير المباشرة وفوات الربح وفقدان البيانات — لأي سقف نقدي وألا تُقيَّد بالرجوع إلى الرسوم المدفوعة. ويُستبعد صراحة شرط استثناء الخسارة غير المباشرة الوارد في الدليل التعاقدي المعياري لـ ${spec.partyA}.`;
  }
  const months = spec.liabilityCapMonths || 12;
  return `## ${article(spec, "liability")}. المسؤولية والتعويض

لا يُسأل أي طرف عن الأضرار غير المباشرة أو العرضية أو الخاصة أو التبعية أو العقابية، ولا عن فوات الربح أو الإيراد أو السمعة أو الوفورات المتوقعة، في العقد أو المسؤولية التقصيرية، حتى لو أُخطر بإمكانية وقوعها.

وباستثناء (أ) الغش و(ب) الوفاة أو الإصابة البدنية الناشئة عن الإهمال و(ج) الإخلال بالسرية و(د) التعدي على حقوق الملكية الفكرية للطرف الآخر، يقتصر مجموع مسؤولية كل طرف على الرسوم التي دفعها ${spec.partyB} إلى ${spec.partyA} خلال ${months} شهراً السابقة للواقعة الموجبة للمسؤولية (أو مبلغ ${spec.currency} 50,000 إن لم تكن هناك رسوم).

ويعوّض كل طرف الآخر عن مطالبات الغير بقدر ما تكون ناشئة عن سوء سلوك عمدي أو إخلال جوهري بالسرية، مع بقاء السقف المذكور سارياً عدا حالة الغش. ويُخطر الطرف المعوَّض فوراً ويتعاون، ولا يسوّي دون موافقة لا تُحجب دون مسوغ.`;
}

function terminationEn(spec: DocSpec): string {
  if (spec.risk === "one_day_termination") {
    return `## ${article(spec, "termination")}. Term, Termination and Notices

This agreement continues from the Effective Date until terminated. Either party may terminate for convenience by giving one (1) calendar day's prior written notice, which may be delivered by email to any published address of the other party and is effective at 00:01 on the following calendar day, including Fridays, Saturdays and public holidays. No wind-down, transition assistance or pro-rata refund shall apply. For material breach, termination may be immediate without an opportunity to cure. Notices under this clause need not be copied to legal counsel.`;
  }
  return `## ${article(spec, "termination")}. Term, Termination and Notices

The initial term is twelve (12) months from the Effective Date and renews for successive twelve-month periods unless either party gives written notice of non-renewal at least ${spec.noticeDays} days before the then-current expiry.

Either party may terminate for material breach if the breach remains uncured thirty (30) days after written notice (or immediately if the breach is not reasonably capable of cure). Either party may terminate if the other becomes insolvent, enters administration, or ceases ordinary operations.

On termination, accrued payment obligations survive, Confidential Information is returned or destroyed as provided above, and licences granted solely for the term end. Notices shall be in writing (email with read-receipt suffices for operational notices; termination notices shall also be sent by courier to the registered office) and are deemed received on the next business day in ${spec.venue}.`;
}

function terminationAr(spec: DocSpec): string {
  if (spec.risk === "one_day_termination") {
    return `## ${article(spec, "termination")}. مدة العقد والإنهاء والإخطار

يسري هذا العقد من تاريخ النفاذ حتى إنهائه. ويجوز لأي طرف إنهاؤه دون إبداء سبب بإخطار كتابي سابق مدته يوم تقويمي واحد (1)، ويجوز إرسال الإخطار بالبريد الإلكتروني إلى أي عنوان معلن للطرف الآخر، ويُعد نافذاً في الساعة 00:01 من اليوم التقويمي التالي بما في ذلك أيام الجمعة والسبت والعطل الرسمية. ولا يترتب على الإنهاء أي التزام بالمساعدة على الانتقال أو رد نسبي للمقابل. وفي حال الإخلال الجوهري يجوز الإنهاء فوراً دون مهلة تصحيح. ولا يُشترط إرسال نسخة من إخطارات هذا البند إلى المستشار القانوني.`;
  }
  return `## ${article(spec, "termination")}. مدة العقد والإنهاء والإخطار

المدة الأولية اثنا عشر (12) شهراً من تاريخ النفاذ وتتجدد لمدد مماثلة ما لم يُخطر أحد الطرفين بعدم التجديد قبل انتهائها بـ ${spec.noticeDays} يوماً على الأقل.

ويجوز لأي طرف الإنهاء للإخلال الجوهري إذا بقي الإخلال قائماً بعد ثلاثين (30) يوماً من الإخطار الكتابي (أو فوراً إن تعذر التصحيح عقلاً). كما يجوز الإنهاء إذا أعسر الطرف الآخر أو دخل في إجراءات تصفية أو توقف عن أعماله المعتادة.

عند الانتهاء تبقى الالتزامات المالية المستحقة، وتُعاد المعلومات السرية أو تُتلف وفق ما تقدم، وتنتهي التراخيص الممنوحة لمدة العقد. وتكون الإخطارات كتابية (ويكفي البريد الإلكتروني مع إشعار قراءة للإخطارات التشغيلية، أما إخطار الإنهاء فيُرسل أيضاً بالبريد المستعجل إلى المقر المسجل) وتُعد منتجة في يوم العمل التالي في ${spec.venue}.`;
}

function governingLawEn(spec: DocSpec): string {
  return `## ${article(spec, "law")}. Governing Law and Dispute Resolution

This agreement is governed by ${spec.governingLaw}, excluding conflict-of-law rules. The United Nations Convention on Contracts for the International Sale of Goods does not apply.

The parties shall first attempt in good faith to resolve disputes through negotiation between authorised officers within fifteen (15) business days of a written dispute notice. If unresolved, the dispute shall be finally settled by arbitration under the rules of the London Court of International Arbitration (or, where the venue is in the UAE, DIFC-LCIA / DIAC as the parties later confirm in a side letter), with one arbitrator, seat in ${spec.venue}, language English. Judgment on the award may be entered in any court of competent jurisdiction.

Notwithstanding the foregoing, either party may seek interim injunctive relief from the courts of ${spec.venue} to protect Confidential Information or Intellectual Property Rights. Each party irrevocably submits to that non-exclusive jurisdiction for such relief.`;
}

function governingLawAr(spec: DocSpec): string {
  return `## ${article(spec, "law")}. القانون الحاكم وفض المنازعات

يخضع هذا العقد لـ ${spec.governingLaw} دون قواعد تنازع القوانين. ولا تسري اتفاقية الأمم المتحدة بشأن عقود البيع الدولي للبضائع.

تسعى الأطراف أولاً بحسن نية إلى تسوية أي نزاع بالتفاوض بين المفوضين خلال خمسة عشر (15) يوم عمل من إخطار كتابي بالنزاع. فإن لم يُسوَّ يتولى التحكيم وفق قواعد غرفة التجارة الدولية أو مركز القاهرة الإقليمي أو مركز دبي للتحكيم الدولي بحسب ما يُؤكد في خطاب لاحق، بمحكم واحد، ومكان التحكيم ${spec.venue}، واللغة العربية مع جواز الإنجليزية للمستندات الفنية. ويجوز إيداع حكم التحكيم لدى أي محكمة مختصة.

ومع ذلك يجوز لأي طرف طلب تدابير وقتية من محاكم ${spec.venue} لحماية المعلومات السرية أو حقوق الملكية الفكرية، ويقر كل طرف بهذا الاختصاص غير الحصري لذلك الغرض.`;
}

function ipEn(spec: DocSpec): string {
  if (spec.risk === "unilateral_ip") {
    return `## ${article(spec, "ip")}. Intellectual Property

${spec.partyA} retains ownership of the Service, including all software, models, documentation and know-how. Customer Data remains, as between the parties, owned by ${spec.partyB} until the next sentence. To the fullest extent permitted by law, ${spec.partyB} hereby irrevocably assigns to ${spec.partyA} all right, title and interest in and to (i) Customer Data uploaded to or processed by the Service, (ii) all derivative works, trained models, embeddings and aggregated outputs, and (iii) all feedback, suggestions and customisations, throughout the world, in perpetuity, without residual licence back to ${spec.partyB} except a revocable, non-exclusive right to access the Service during a paid term. Moral rights are waived to the extent waivable. This assignment is a condition of access and survives termination.`;
  }
  return `## ${article(spec, "ip")}. Intellectual Property

Each party retains Intellectual Property Rights in materials it supplies. ${spec.partyA} owns the service software, models and documentation. ${spec.partyB} owns Customer Data. ${spec.partyB} grants ${spec.partyA} a non-exclusive licence to host and process Customer Data solely to provide the service. Feedback may be used by ${spec.partyA} without restriction but does not assign Customer Data. No reverse engineering of licensed software is permitted except to the extent that restriction is prohibited by mandatory law.`;
}

function ipAr(spec: DocSpec): string {
  if (spec.risk === "unilateral_ip") {
    return `## ${article(spec, "ip")}. الملكية الفكرية

يحتفظ ${spec.partyA} بملكية الخدمة والبرمجيات والنماذج والوثائق. وتبقى بيانات العميل مملوكة لـ ${spec.partyB} إلى حين الجملة التالية. وبالقدر الذي يسمح به القانون، يتنازل ${spec.partyB} تنازلاً غير قابل للرجوع لـ ${spec.partyA} عن جميع الحقوق والمصالح في (1) بيانات العميل المرفوعة أو المعالجة و(2) الأعمال المشتقة والنماذج المدرَّبة والمتجهات والمخرجات المجمّعة و(3) الملاحظات والاقتراحات والتخصيصات، في جميع أنحاء العالم وعلى سبيل الدوام، دون ترخيص متبقٍّ لـ ${spec.partyB} سوى حق غير حصري قابل للإلغاء في الدخول أثناء مدة الاشتراك المدفوعة. ويُتنازل عن الحقوق المعنوية بالقدر الجائز. ويُعد هذا التنازل شرطاً للوصول ويبقى بعد انتهاء العقد.`;
  }
  return `## ${article(spec, "ip")}. الملكية الفكرية

يحتفظ كل طرف بحقوق الملكية الفكرية على مواده. ويملك ${spec.partyA} برمجيات الخدمة والنماذج والوثائق، ويملك ${spec.partyB} بيانات العميل. ويمنح ${spec.partyB} ترخيصاً غير حصري لاستضافة البيانات ومعالجتها فقط لتقديم الخدمة. ويجوز استخدام الملاحظات دون قيد دون أن ينقل ذلك ملكية بيانات العميل. وتُحظر الهندسة العكسية إلا حيث يمنع القانون تقييدها.`;
}

function article(_spec: DocSpec, kind: string): string {
  const map: Record<string, string> = {
    confidentiality: "5",
    payment: "6",
    termination: "7",
    liability: "8",
    law: "9",
    ip: "10",
  };
  return map[kind] ?? "4";
}

function recitalsEn(spec: DocSpec): string {
  return `# ${spec.titleEn}

**Document ID:** ${spec.id}  
**Version:** ${spec.version}  
**Effective Date:** ${spec.effectiveDate}  
**Language:** English  

This ${labelEn(spec.contractType)} (the "Agreement") is entered into as of the Effective Date between **${spec.partyA}** ("Party A") and **${spec.partyB}** ("Party B").

## 1. Background

The parties wish to record the terms on which confidential information, professional services, software access and related commercial terms will be governed. This document is a complete synthetic specimen prepared for retrieval and risk-evaluation testing. It does not bind any living person.

## 2. Definitions

"**Affiliate**" means any entity that controls, is controlled by, or is under common control with a party.  
"**Business Day**" means a day other than Friday, Saturday or a public holiday in ${spec.venue}, unless the governing law implies otherwise.  
"**Customer Data**" means data submitted by Party B.  
"**Intellectual Property Rights**" means patents, copyrights, trade marks, trade secrets and analogous rights.  
"**Playbook**" means Party A's internal contracting standards for similar transactions.

## 3. Scope of Documents

Schedules form part of this Agreement. If there is a conflict, the following order of precedence applies: (1) a signed statement of work; (2) the body of this Agreement; (3) schedules. Headings are for convenience only.

## 4. Representations

Each party represents that it has capacity to contract, that entering into this Agreement does not breach any other instrument, and that it will comply with applicable anti-bribery, export-control and data-protection laws in connection with performance.`;
}

function recitalsAr(spec: DocSpec): string {
  return `# ${spec.titleAr}

**معرّف المستند:** ${spec.id}  
**الإصدار:** ${spec.version}  
**تاريخ النفاذ:** ${spec.effectiveDate}  
**اللغة:** العربية  

أُبرمت ${labelAr(spec.contractType)} ("العقد") في تاريخ النفاذ بين **${spec.partyA}** ("الطرف الأول") و**${spec.partyB}** ("الطرف الثاني").

## 1. التمهيد

ترغب الأطراف في توثيق الشروط التي تحكم المعلومات السرية والخدمات المهنية والوصول إلى البرمجيات والأحكام التجارية المرتبطة بها. وهذا المستند عيّنة اصطناعية كاملة لأغراض الاختبار والاسترجاع وتقييم المخاطر، ولا يُلزم أي شخص حقيقي.

## 2. التعاريف

"**الشركة التابعة**": أي كيان يسيطر أو يخضع لسيطرة مشتركة مع أحد الأطراف.  
"**يوم عمل**": أي يوم عدا الجمعة والسبت والعطل الرسمية في ${spec.venue} ما لم يقتضِ القانون الحاكم خلاف ذلك.  
"**بيانات العميل**": البيانات التي يقدمها الطرف الثاني.  
"**حقوق الملكية الفكرية**": البراءات وحقوق المؤلف والعلامات والأسرار التجارية وما يماثلها.  
"**الدليل التعاقدي**": المعايير الداخلية للطرف الأول للصفقات المماثلة.

## 3. نطاق المستندات وترتيب الأولوية

تُعد الملاحق جزءاً من العقد. وعند التعارض يُعمل بالترتيب: (1) أمر العمل الموقع؛ (2) صلب العقد؛ (3) الملاحق. والعناوين للتيسير فقط.

## 4. الإقرارات

يقر كل طرف بأهليته للتعاقد وبأن إبرام هذا العقد لا يخلّ بأي صك آخر، وبأنه سيمتثل لقوانين مكافحة الرشوة والرقابة على الصادرات وحماية البيانات ذات الصلة بالتنفيذ.`;
}

function labelEn(t: ContractType): string {
  switch (t) {
    case "nda":
      return "non-disclosure agreement";
    case "sla":
      return "service level agreement";
    case "msa":
      return "master services agreement";
    case "saas":
      return "software licensing and SaaS agreement";
    case "employment":
      return "employment or consulting contract";
  }
}

function labelAr(t: ContractType): string {
  switch (t) {
    case "nda":
      return "اتفاقية عدم إفشاء الأسرار";
    case "sla":
      return "اتفاقية مستوى الخدمة";
    case "msa":
      return "اتفاقية تقديم الخدمات الرئيسية";
    case "saas":
      return "اتفاقية ترخيص البرمجيات والبرمجيات كخدمة";
    case "employment":
      return "عقد عمل أو استشارات";
  }
}

function typeSpecificEn(spec: DocSpec): string {
  switch (spec.contractType) {
    case "nda":
      return `## 11. Permitted Purpose and Residual Knowledge

Confidential Information may be used solely to evaluate a potential commercial relationship concerning analytics, logistics or software, and not to procure goods from a competitor of the discloser using the discloser's pricing. Residual knowledge remaining in unaided memory of representatives who no longer have access to documents may be used, provided no Confidential Information is deliberately memorised for that purpose. No licence to Intellectual Property Rights is granted except the limited right to review materials for the Permitted Purpose.

## 12. Non-Solicitation

For twelve (12) months after the last disclosure, neither party shall solicit the other's employees who were identified in Confidential Information, except via general advertisements. This clause does not restrict hiring following unsolicited application.`;
    case "sla":
      return `## 11. Service Levels

Party A shall use commercially reasonable efforts to make the production endpoint available not less than 99.5% in each calendar month, excluding scheduled maintenance notified 48 hours in advance and force majeure. Measurement is from Party A's monitoring probes in ${spec.venue}. Priority-1 incidents (complete production outage) shall receive a first response within thirty (30) minutes, 24x7. Priority-2 (material degradation) within four (4) hours during Business Days.

If monthly availability falls below 99.5% but not below 99.0%, Party B receives a service credit of 5% of that month's recurring fee; below 99.0%, 10%; below 98.0%, 15%. Credits are Party B's exclusive remedy for availability failure.

## 12. Security and Audit

Party A shall maintain ISO/IEC 27001-aligned controls or equivalent, encrypt Customer Data in transit using TLS 1.2 or higher, and notify Party B without undue delay after becoming aware of a personal-data breach affecting Party B. Party B may request a summary audit report not more than once per year.`;
    case "msa":
      return `## 11. Statements of Work and Change Control

Services are provided only under a signed statement of work describing deliverables, fees, and acceptance criteria. Changes in scope require a written change request; Party A shall quote impact on fees and timetable within ten (10) Business Days. Work performed outside a signed SOW is at Party B's risk and does not vary this MSA.

Personnel remain employees or contractors of Party A. Nothing creates a partnership or joint employment. Party A may use subcontractors who are bound by confidentiality no less strict than this Agreement, remaining liable for their performance.

## 12. Acceptance

Deliverables are accepted if Party B does not reject in writing within ten (10) Business Days of delivery, stating defects with reasonable specificity. Rejected deliverables shall be re-performed once at no additional charge if the defects are within scope.`;
    case "saas":
      return `## 11. Licence Grant and Acceptable Use

Subject to timely payment, Party A grants Party B a non-exclusive, non-transferable right for its employees and contractors to access the hosted service during the subscription term, in object form only. Party B shall not (a) exceed documented user caps, (b) probe or load-test without consent, (c) upload unlawful content, or (d) use the service to train a competing model.

Party A may suspend access for material acceptable-use breach after notice, or immediately if the service or other customers are at imminent risk. Uptime commitments, if any, appear in an attached SLA schedule; if none is attached, the service is provided as-is except for the warranty that Party A has the right to grant the licence.

## 12. Data Processing

Party A acts as processor of Customer Data on documented instructions of Party B as controller. Data may be stored in the region specified in the order form. On termination, Party B may export Customer Data for thirty (30) days, after which Party A may delete it from active systems, retaining backups until rotation completes.`;
    case "employment":
      return `## 11. Duties, Place of Work and Hours

The individual or contractor shall perform the role described in Schedule A with reasonable skill and care, primarily from ${spec.venue}, with travel as reasonably required. Working time shall comply with applicable working-time legislation. The engagement does not guarantee a particular volume of work beyond the fees stated.

## 12. Conflicts, Non-Dealing and Garden Leave

During the term the individual shall not accept conflicting instructions from a direct competitor of Party A in the same product line without written consent. For three (3) months after termination, Party A may place an employee (not a contractor) on garden leave, paying salary, during which duties may be reduced. Restrictive covenants are no wider than reasonably necessary to protect Confidential Information and client connections.`;
  }
}

function typeSpecificAr(spec: DocSpec): string {
  switch (spec.contractType) {
    case "nda":
      return `## 11. الغرض المسموح والمعرفة المتبقية

تُستخدم المعلومات السرية فقط لتقييم علاقة تجارية محتملة في التحليلات أو الخدمات اللوجستية أو البرمجيات، وليس لتوريد سلع من منافس للمفصح باستخدام أسعاره. ويجوز استخدام المعرفة المتبقية في الذاكرة غير المعانة لمن لم يعد لديه وصول إلى المستندات، بشرط عدم حفظ المعلومات عمداً لهذا الغرض. ولا يُمنح ترخيص بحقوق ملكية فكرية سوى حق الاطلاع لغرض التقييم.

## 12. عدم الاستقطاب

لمدة اثني عشر (12) شهراً بعد آخر إفصاح لا يستقطب أي طرف عاملي الآخر ممن وردت أسماؤهم في المعلومات السرية، عدا الإعلانات العامة. ولا يمنع هذا البند التوظيف بناء على طلب غير موجّه.`;
    case "sla":
      return `## 11. مستويات الخدمة

يبذل الطرف الأول عناية معقولة تجارياً لتوفير نقطة الإنتاج بنسبة لا تقل عن 99.5% في كل شهر ميلادي، مع استثناء الصيانة المجدولة المُخطَر بها قبل 48 ساعة والقوة القاهرة. ويُقاس التوافر من مجسات الطرف الأول في ${spec.venue}. وتُلبّى حوادث الأولوية الأولى (انقطاع الإنتاج الكامل) برد أولي خلال ثلاثين (30) دقيقة على مدار الساعة، والأولوية الثانية خلال أربع (4) ساعات في أيام العمل.

إذا انخفض التوافر الشهري عن 99.5% دون 99.0% استحق الطرف الثاني رصيد خدمة 5% من الرسم الشهري؛ ودون 99.0% يستحق 10%؛ ودون 98.0% يستحق 15%. والأرصدة هي التعويض الحصري عن الإخفاق في التوافر.

## 12. الأمن والتدقيق

يحافظ الطرف الأول على ضوابط متوافقة مع ISO/IEC 27001 أو ما يعادلها، ويشفّر بيانات العميل أثناء النقل بـ TLS 1.2 فأعلى، ويخطر الطرف الثاني دون تأخير غير مبرر بعد العلم بخرق بيانات شخصية يمسّه. ويجوز طلب ملخص تقرير تدقيق مرة واحدة في السنة على الأكثر.`;
    case "msa":
      return `## 11. أوامر العمل ومراقبة التغيير

لا تُقدَّم الخدمات إلا بموجب أمر عمل موقع يبيّن المخرجات والأتعاب ومعايير القبول. وأي تغيير في النطاق يتطلب طلب تغيير كتابي؛ ويقدم الطرف الأول أثره على الأتعاب والجدول خلال عشرة (10) أيام عمل. والعمل خارج أمر عمل موقع يقع على مسؤولية الطرف الثاني ولا يعدّل هذه الاتفاقية الرئيسية.

يبقى العاملون تابعين للطرف الأول ولا تنشأ شراكة أو علاقة عمل مشتركة. ويجوز استخدام مقاولين من الباطن ملتزمين بسرية لا تقل عن هذا العقد مع بقاء الطرف الأول مسؤولاً عن أدائهم.

## 12. القبول

تُعد المخرجات مقبولة إن لم يرفضها الطرف الثاني كتابة خلال عشرة (10) أيام عمل من التسليم مع بيان العيوب بدرجة معقولة من التحديد. وتُعاد الأعمال المرفوضة مرة واحدة دون مقابل إضافي إذا كانت العيوب داخل النطاق.`;
    case "saas":
      return `## 11. منح الترخيص والاستخدام المقبول

لقاء السداد في مواعيده يمنح الطرف الأول الطرف الثاني حقاً غير حصري وغير قابل للنقل لوصول موظفيه ومقاوليه إلى الخدمة المستضافة خلال مدة الاشتراك وبصورة الهدف فقط. ويمتنع الطرف الثاني عن (أ) تجاوز سقف المستخدمين الموثّق و(ب) اختبار الحمل دون موافقة و(ج) رفع محتوى غير مشروع و(د) استخدام الخدمة لتدريب نموذج منافس.

يجوز إيقاف الوصول عند الإخلال الجوهري بسياسة الاستخدام بعد إخطار، أو فوراً إذا تعرضت الخدمة أو العملاء الآخرون لخطر وشيك. فإن لم يُرفق ملحق مستوى خدمة تُقدم الخدمة بحالتها مع ضمان أن للطرف الأول حق منح الترخيص.

## 12. معالجة البيانات

يعمل الطرف الأول كمعالج لبيانات العميل وفق تعليمات الطرف الثاني بصفته متحكمًا. ويجوز تخزين البيانات في الإقليم المحدد في نموذج الطلب. وعند الانتهاء يجوز للطرف الثاني تصدير البيانات خلال ثلاثين (30) يوماً ثم تُحذف من الأنظمة النشطة مع بقائها في النسخ الاحتياطي حتى اكتمال الدورة.`;
    case "employment":
      return `## 11. الواجبات ومكان العمل وساعاته

يؤدي الشخص أو المتعاقد الدور المبيّن في الملحق (أ) بعناية ومهارة معقولتين، وأساساً من ${spec.venue} مع التنقل حسب الحاجة المعقولة. وتراعي ساعات العمل تشريعات العمل المعمول بها. ولا يضمن التعاقد حجماً معيناً من العمل يتجاوز الأتعاب المبينة.

## 12. تعارض المصالح والإجازة المنزلية

خلال المدة لا يقبل الفرد تعليمات متعارضة من منافس مباشر للطرف الأول في خط المنتج ذاته دون موافقة كتابية. ولمدة ثلاثة (3) أشهر بعد انتهاء عقد العمل (لا عقد الاستشارات) يجوز وضع الموظف في إجازة منزلية مع صرف الأجر وتخفيف الواجبات. ولا تتسع شروط عدم المنافسة عما يلزم لحماية المعلومات السرية وعلاقات العملاء.`;
  }
}

function signaturesEn(spec: DocSpec): string {
  return `## 13. General

This Agreement is the entire agreement and supersedes prior discussions on its subject. Amendments must be in writing and signed (electronic signature permitted). If a provision is unenforceable, the remainder continues. Failure to enforce is not a waiver. Neither party may assign without consent, except to an Affiliate or successor to substantially all assets. Counterparts and electronic copies are originals.

## 14. Signature

IN WITNESS WHEREOF the parties have executed this Agreement as of the Effective Date.

| Party A | Party B |
| --- | --- |
| ${spec.partyA} | ${spec.partyB} |
| Name: (synthetic signatory A) | Name: (synthetic signatory B) |
| Title: Authorised signatory | Title: Authorised signatory |
| Date: ${spec.effectiveDate} | Date: ${spec.effectiveDate} |

— End of synthetic document ${spec.id} —`;
}

function signaturesAr(spec: DocSpec): string {
  return `## 13. أحكام عامة

يمثل هذا العقد الاتفاق الكامل ويحل محل أي تفاهم سابق في موضوعه. ولا يُعدَّل إلا كتابةً بتوقيع (ويجوز التوقيع الإلكتروني). وإذا بطل حكم بقي الباقي نافذاً. وعدم التمسك بالحق لا يُعد تنازلاً. ولا يجوز الحوالة دون موافقة إلا إلى شركة تابعة أو خلف يشتري جوهر الأصول. وللنسخ والصور الإلكترونية حجية الأصل.

## 14. التوقيع

وإثباتاً لما تقدم وقّعت الأطراف هذا العقد في تاريخ النفاذ.

| الطرف الأول | الطرف الثاني |
| --- | --- |
| ${spec.partyA} | ${spec.partyB} |
| الاسم: موقع اصطناعي (أ) | الاسم: موقع اصطناعي (ب) |
| الصفة: مفوض بالتوقيع | الصفة: مفوض بالتوقيع |
| التاريخ: ${spec.effectiveDate} | التاريخ: ${spec.effectiveDate} |

— نهاية المستند الاصطناعي ${spec.id} —`;
}

function render(spec: DocSpec): string {
  if (spec.language === "ar") {
    return [
      yamlFrontmatter(spec),
      recitalsAr(spec),
      "",
      confidentialityAr(spec),
      "",
      paymentAr(spec),
      "",
      terminationAr(spec),
      "",
      liabilityAr(spec),
      "",
      governingLawAr(spec),
      "",
      ipAr(spec),
      "",
      typeSpecificAr(spec),
      "",
      signaturesAr(spec),
      "",
    ].join("\n");
  }
  return [
    yamlFrontmatter(spec),
    recitalsEn(spec),
    "",
    confidentialityEn(spec),
    "",
    paymentEn(spec),
    "",
    terminationEn(spec),
    "",
    liabilityEn(spec),
    "",
    governingLawEn(spec),
    "",
    ipEn(spec),
    "",
    typeSpecificEn(spec),
    "",
    signaturesEn(spec),
    "",
  ].join("\n");
}

function riskSummary(code: RiskCode): { article: string; summary: string } {
  switch (code) {
    case "unlimited_liability":
      return {
        article: "8.2",
        summary: "Liability cap disapplied; consequential and lost-profit claims left unlimited.",
      };
    case "one_day_termination":
      return {
        article: "7",
        summary: "Either party may terminate for convenience on one calendar day's email notice, including weekends, with no wind-down.",
      };
    case "unilateral_ip":
      return {
        article: "10",
        summary: "Customer Data, derivatives, models and feedback assigned to the provider with only a revocable access right back.",
      };
    case "uncapped_indemnity":
      return {
        article: "8",
        summary: "Customer indemnity for all loss classes, including indirect and punitive, with no monetary ceiling.",
      };
    case "punitive_late_fees":
      return {
        article: "6",
        summary: "Fifteen percent of outstanding balance charged per calendar day on late invoices, compounding daily, plus immediate suspension.",
      };
  }
}

function toManifest(spec: DocSpec, filename: string): ManifestEntry {
  const title = spec.language === "ar" ? spec.titleAr : spec.titleEn;
  return {
    document_id: spec.id,
    filename,
    language: spec.language,
    contract_type: spec.contractType,
    version: spec.version,
    effective_date: spec.effectiveDate,
    title,
    parties: {
      disclosing_or_provider: spec.partyA,
      receiving_or_customer: spec.partyB,
    },
    governing_law: spec.governingLaw,
    clause_types: [...CLAUSE_TYPES],
    high_risk: Boolean(spec.risk),
    risk_indicators: spec.risk
      ? [{ code: spec.risk, ...riskSummary(spec.risk) }]
      : [],
    synthetic: true,
  };
}

function assertSpecs(): void {
  if (SPECS.length !== 32) {
    throw new Error(`Expected 32 specs, got ${SPECS.length}`);
  }
  const ar = SPECS.filter((s) => s.language === "ar").length;
  const en = SPECS.filter((s) => s.language === "en").length;
  if (ar < 16 || en < 16) {
    throw new Error(`Need at least 16 AR and 16 EN, got AR=${ar} EN=${en}`);
  }
  const risks = SPECS.filter((s) => s.risk);
  if (risks.length !== 5) {
    throw new Error(`Expected 5 high-risk docs, got ${risks.length}`);
  }
  const ids = new Set(SPECS.map((s) => s.id));
  if (ids.size !== 32) {
    throw new Error("Duplicate document IDs");
  }
}

function main(): void {
  assertSpecs();
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest: ManifestEntry[] = [];
  for (const spec of SPECS) {
    const filename = `${spec.id}.md`;
    const body = render(spec);
    writeFileSync(join(OUT_DIR, filename), body, "utf8");
    manifest.push(toManifest(spec, filename));
  }

  const index = {
    corpus_id: "d1t1-synthetic-legal-v1",
    variant: "D1T1",
    generated_at: new Date().toISOString(),
    description:
      "Synthetic bilingual (AR+EN) contract corpus for Legal Contract Review & Research. No real personal data.",
    counts: {
      documents: manifest.length,
      arabic: manifest.filter((m) => m.language === "ar").length,
      english: manifest.filter((m) => m.language === "en").length,
      high_risk: manifest.filter((m) => m.high_risk).length,
      by_type: {
        nda: manifest.filter((m) => m.contract_type === "nda").length,
        sla: manifest.filter((m) => m.contract_type === "sla").length,
        msa: manifest.filter((m) => m.contract_type === "msa").length,
        saas: manifest.filter((m) => m.contract_type === "saas").length,
        employment: manifest.filter((m) => m.contract_type === "employment").length,
      },
    },
    documents: manifest,
  };

  writeFileSync(join(OUT_DIR, "corpus_manifest.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Wrote ${manifest.length} documents and corpus_manifest.json to ${OUT_DIR}`);
}

main();
