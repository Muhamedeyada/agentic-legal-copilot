import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("golden set", () => {
  it("has at least 25 items with bilingual and adversarial coverage", async () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const raw = JSON.parse(await readFile(join(root, "data/evaluation_golden_set.json"), "utf8")) as {
      items: Array<{ lang_query: string; lang_source: string; task: string; adversarial: boolean }>;
    };
    expect(raw.items.length).toBeGreaterThanOrEqual(25);
    expect(raw.items.filter((i) => i.lang_query === "ar").length).toBeGreaterThanOrEqual(6);
    expect(raw.items.filter((i) => i.task === "crosslingual").length).toBeGreaterThanOrEqual(5);
    expect(raw.items.filter((i) => i.adversarial).length).toBeGreaterThanOrEqual(5);
  });
});
