/** Bilingual query expansion so EN questions can hit AR clauses (T1) and vice versa. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["termination", "إنهاء"],
  ["terminate", "إنهاء"],
  ["notice", "إخطار"],
  ["calendar day", "يوم تقويمي"],
  ["one day", "يوم واحد"],
  ["convenience", "للراحة"],
  ["period", "مدة"],
  ["liability", "مسؤولية"],
  ["unlimited", "بلا سقف"],
  ["indemnity", "تعويض"],
  ["uncapped", "دون حد أقصى"],
  ["cap", "سقف"],
  ["monetary cap", "سقف نقدي"],
  ["governing law", "القانون الحاكم"],
  ["jurisdiction", "الاختصاص"],
  ["confidential", "سرية"],
  ["confidentiality", "السرية"],
  ["survive", "تسري"],
  ["duties", "التزامات"],
  ["intellectual property", "ملكية فكرية"],
  ["assignment", "تنازل"],
  ["assigns", "يتنازل"],
  ["irrevocably assigns", "يتنازل تنازلا"],
  ["customer data", "بيانات العميل"],
  ["fifteen percent", "خمسة عشر"],
  ["late fee", "غرام"],
  ["england and wales", "إنجلترا وويلز"],
  ["delaware", "ديلاوير"],
  ["saudi", "السعودية"],
  ["egypt", "مصر"],
  ["singapore", "سنغافورة"],
  ["payment", "دفع"],
  ["invoice", "فاتورة"],
];

export function expandBilingualQuery(query: string): string {
  const extras: string[] = [];
  const lower = query.toLowerCase();
  for (const [en, ar] of PAIRS) {
    if (lower.includes(en) && !query.includes(ar)) {
      extras.push(ar);
    }
    if (query.includes(ar) && !lower.includes(en)) {
      extras.push(en);
    }
  }
  if (extras.length === 0) {
    return query;
  }
  return `${query} ${extras.join(" ")}`;
}
