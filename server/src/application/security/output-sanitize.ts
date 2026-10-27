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
