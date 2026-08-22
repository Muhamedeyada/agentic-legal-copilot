import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { indexContractText, type IndexedChunk } from "../application/chat/corpus-rag.js";

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) {
    return raw;
  }
  const end = raw.indexOf("\n---", 3);
  if (end < 0) {
    return raw;
  }
  return raw.slice(end + 4).trim();
}

export async function loadCorpusChunks(corpusDir: string): Promise<IndexedChunk[]> {
  const names = await readdir(corpusDir);
  const chunks: IndexedChunk[] = [];
  for (const name of names) {
    if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") {
      continue;
    }
    const id = name.replace(/\.md$/, "");
    const language: "ar" | "en" = id.includes("-AR-") ? "ar" : "en";
    const raw = await readFile(join(corpusDir, name), "utf8");
    chunks.push(...indexContractText(id, stripFrontmatter(raw), language));
  }
  return chunks;
}
