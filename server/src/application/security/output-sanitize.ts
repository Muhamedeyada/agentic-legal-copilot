/** Strip HTML/script payloads from model text before any UI or export (LLM05). */
export function sanitizeModelText(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\son\w+\s*=/gi, " ")
    .replace(/\u0000/g, "");
}

export function looksLikeHtml(input: string): boolean {
  return /<[a-z][\s\S]*>/i.test(input);
}
