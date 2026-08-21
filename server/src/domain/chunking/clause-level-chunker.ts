import type { Chunk, ChunkMetadata, DocumentLanguage, LegalDocument } from "../entities/document.js";

const HEADING =
  /^(#{1,3})\s+(?:(Article|Clause|Section|بند|مادة|المادة)\s*)?(\d+(?:\.\d+)*)[.:)\-–]?\s*(.*)$/u;

const MAX_CHARS = 2800;

export interface ClauseLevelChunker {
  chunk(document: LegalDocument): Chunk[];
}

export class DefaultClauseLevelChunker implements ClauseLevelChunker {
  chunk(document: LegalDocument): Chunk[] {
    const body = stripFrontmatter(document.text);
    const segments = splitByHeadings(body);
    const chunks: Chunk[] = [];

    segments.forEach((segment, index) => {
      const parts = splitLong(segment.body);
      parts.forEach((text, partIndex) => {
        const clauseNumber =
          parts.length > 1 ? `${segment.clauseNumber}.${partIndex + 1}` : segment.clauseNumber;
        const metadata: ChunkMetadata = {
          source: document.source,
          title: document.title,
          section: segment.section,
          clauseNumber,
          version: document.version,
          language: document.language,
          pageOrSection: `§${clauseNumber}`,
        };
        chunks.push({
          id: `${document.id}::${clauseNumber}::${index}::${partIndex}`,
          documentId: document.id,
          text: text.trim(),
          metadata,
        });
      });
    });

    return chunks.filter((c) => c.text.length > 0);
  }
}

export function detectLanguage(text: string, fallback: DocumentLanguage = "en"): DocumentLanguage {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > latin) {
    return "ar";
  }
  if (latin > 0) {
    return "en";
  }
  return fallback;
}

function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) {
    return text;
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return text;
  }
  return text.slice(end + 4).trim();
}

interface Segment {
  clauseNumber: string;
  section: string;
  body: string;
}

function splitByHeadings(body: string): Segment[] {
  const lines = body.split(/\r?\n/);
  const segments: Segment[] = [];
  let current: Segment = { clauseNumber: "0", section: "preamble", body: "" };

  const flush = (): void => {
    if (current.body.trim().length > 0) {
      segments.push({ ...current, body: current.body.trim() });
    }
  };

  for (const line of lines) {
    const match = line.trim().match(HEADING);
    if (match) {
      flush();
      const clauseNumber = match[3] ?? "0";
      const title = (match[4] ?? "").trim() || (match[2] ?? "clause");
      current = {
        clauseNumber,
        section: title,
        body: `${line.trim()}\n`,
      };
      continue;
    }
    current.body += `${line}\n`;
  }
  flush();
  return segments.length > 0 ? segments : [{ clauseNumber: "0", section: "body", body }];
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) {
    return [text];
  }
  const paras = text.split(/\n{2,}/);
  const out: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > MAX_CHARS && buf.length > 0) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf.length === 0 ? p : `${buf}\n\n${p}`;
    }
  }
  if (buf.trim()) {
    out.push(buf.trim());
  }
  return out.length > 0 ? out : [text.slice(0, MAX_CHARS)];
}
