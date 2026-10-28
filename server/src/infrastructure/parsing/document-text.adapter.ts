import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { DocumentFile, DocumentTextExtractorPort } from "../../domain/ports/document-text.port.js";
import { UnreadableDocumentError, UnsupportedDocumentError } from "../../domain/errors.js";

type Kind = "pdf" | "docx" | "text";

const BY_EXTENSION: Record<string, Kind> = { pdf: "pdf", docx: "docx", txt: "text", md: "text", markdown: "text" };
const BY_MIME: Record<string, Kind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "text/markdown": "text",
};

function kindOf(file: Pick<DocumentFile, "fileName" | "mimeType">): Kind | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(file.fileName)?.[1]?.toLowerCase();
  // The extension decides when present: browsers report .md as "" or application/octet-stream.
  return ext ? BY_EXTENSION[ext] : BY_MIME[file.mimeType.split(";")[0]?.trim().toLowerCase() ?? ""];
}

export class DocumentTextExtractor implements DocumentTextExtractorPort {
  supports(file: Pick<DocumentFile, "fileName" | "mimeType">): boolean {
    return kindOf(file) !== undefined;
  }

  async extract(file: DocumentFile): Promise<string> {
    const kind = kindOf(file);
    if (!kind) {
      throw new UnsupportedDocumentError(file.fileName);
    }
    try {
      const text = kind === "pdf" ? await pdfText(file.bytes) : kind === "docx" ? await docxText(file.bytes) : utf8Text(file.bytes);
      return normalise(text);
    } catch (err) {
      if (err instanceof UnsupportedDocumentError) throw err;
      throw new UnreadableDocumentError(file.fileName, `could not read the ${kind.toUpperCase()} file (${err instanceof Error ? err.message : String(err)}).`);
    }
  }
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    // The default joiner writes "-- 1 of 2 --" into the text; a blank scan would then look non-empty.
    const result = await parser.getText({ pageJoiner: "\n" });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Via HTML rather than raw text: Word headings and auto-numbered lists carry the clause structure,
 * and raw text drops both (a styled "Confidentiality" heading or an auto "1." would vanish).
 */
async function docxText(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  return htmlToText(value);
}

export function htmlToText(html: string): string {
  const lists: number[] = [];
  // Word keeps one top-level numbering sequence across clauses separated by body paragraphs;
  // mammoth emits each run as its own <ol>, so carry the count over.
  let topLevel = 0;
  const out = html
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner: string) => `\n\n## ${stripTags(inner)}\n\n`)
    .replace(/<(\/?)(ol|ul|li)[^>]*>/gi, (_m, close: string, tag: string) => {
      const t = tag.toLowerCase();
      if (t === "ol" || t === "ul") {
        if (close) {
          const ended = lists.pop();
          if (lists.length === 0 && t === "ol" && ended !== undefined) topLevel = ended;
        } else {
          lists.push(t === "ol" ? (lists.length === 0 ? topLevel : 0) : -1);
        }
        return "\n";
      }
      if (close) return "\n";
      const depth = lists.length - 1;
      const counter = lists[depth];
      if (counter === undefined || counter < 0) return `\n${"  ".repeat(Math.max(depth, 0))}- `;
      lists[depth] = counter + 1;
      return `\n${"  ".repeat(depth)}${counter + 1}. `;
    })
    .replace(/<\/(p|tr|table)>/gi, "\n\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n");
  return decodeEntities(stripTags(out));
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function utf8Text(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
}

function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
