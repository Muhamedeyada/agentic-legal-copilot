import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import type { DocumentLanguage, LegalDocument } from "../../domain/entities/document.js";
import type { DocumentSourcePort } from "../../domain/ports/document-source.port.js";
import { detectLanguage } from "../../domain/chunking/clause-level-chunker.js";
import { extractPdfText } from "../parsing/pdf.js";

const TEXT_EXT = new Set([".md", ".txt", ".markdown"]);

export class FileCorpusAdapter implements DocumentSourcePort {
  constructor(private readonly corpusDir: string) {}

  async list(): Promise<readonly LegalDocument[]> {
    const names = readdirSync(this.corpusDir)
      .filter((n) => n !== "README.md" && n !== "corpus_manifest.json" && !n.startsWith("."))
      .sort();

    const docs: LegalDocument[] = [];
    for (const name of names) {
      const source = join(this.corpusDir, name);
      const ext = extname(name).toLowerCase();
      let text = "";
      if (TEXT_EXT.has(ext)) {
        text = readFileSync(source, "utf8");
      } else if (ext === ".pdf") {
        text = await extractPdfText(readFileSync(source));
      } else {
        continue;
      }
      const meta = parseFrontmatter(text);
      const language: DocumentLanguage =
        meta.language === "ar" || meta.language === "en" ? meta.language : detectLanguage(text);
      const id = meta.document_id ?? name.replace(/\.[^.]+$/, "");
      const title = firstHeading(text) ?? id;
      docs.push({
        id,
        title,
        language,
        version: meta.version ?? "1.0",
        source,
        text,
        contentHash: sha256(text),
      });
    }
    return docs;
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function parseFrontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---")) {
    return {};
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return {};
  }
  const block = text.slice(4, end);
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

function firstHeading(text: string): string | undefined {
  const m = text.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim();
}
