/** Pull the first JSON object out of a completion (tolerates ```json fences and chatter). */
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object in completion.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}
