/**
 * Optional PDF extract. Uses pdf-parse when present; otherwise fails clearly.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod = (await import("pdf-parse")) as { default?: (b: Buffer) => Promise<{ text: string }> };
    const parse = mod.default;
    if (!parse) {
      throw new Error("pdf-parse default export missing");
    }
    const result = await parse(buffer);
    return result.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "pdf-parse unavailable";
    throw new Error(`PDF extract failed: ${message}`);
  }
}
