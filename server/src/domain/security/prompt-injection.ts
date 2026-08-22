const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (all |any )?(previous|prior|above) instructions/i,
  /disregard (the )?(system|developer) prompt/i,
  /reveal (the )?(system|hidden) prompt/i,
  /you are now (dan|jailbroken|unrestricted)/i,
  /output (your )?(api keys?|secrets?)/i,
  /exfiltrat/i,
  /تجاهل (كل )?(التعليمات|الأوامر) السابق/i,
  /اعرض (موجه|برومبت) النظام/i,
  /أظهر مفتاح/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

/** Remove injection phrases so retrieval can still run on the legal question. */
export function stripInjectionPhrases(text: string): string {
  let out = text;
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}
