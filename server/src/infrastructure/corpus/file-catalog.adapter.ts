import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  ContractCatalogPort,
  ContractRecord,
  ContractSummary,
} from "../../domain/ports/contract-catalog.port.js";

interface ManifestDoc {
  document_id: string;
  filename: string;
  language: "ar" | "en";
  contract_type: string;
  title: string;
  high_risk?: boolean;
}

interface Manifest {
  documents: ManifestDoc[];
}

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

export class FileContractCatalogAdapter implements ContractCatalogPort {
  private readonly uploads = new Map<string, ContractRecord>();

  constructor(private readonly corpusDir: string) {}

  async list(): Promise<readonly ContractSummary[]> {
    const corpus = await this.corpusSummaries();
    return [...corpus, ...this.uploads.values()].map((row) => ({
      id: row.id,
      title: row.title,
      language: row.language,
      source: row.source,
      ...(row.contractType ? { contractType: row.contractType } : {}),
      ...(row.highRisk !== undefined ? { highRisk: row.highRisk } : {}),
    }));
  }

  async get(id: string): Promise<ContractRecord | undefined> {
    const uploaded = this.uploads.get(id);
    if (uploaded) {
      return uploaded;
    }
    const corpus = await this.corpusSummaries();
    const meta = corpus.find((d) => d.id === id);
    if (!meta) {
      return undefined;
    }
    const raw = await readFile(join(this.corpusDir, `${id}.md`), "utf8");
    return { ...meta, text: stripFrontmatter(raw) };
  }

  async saveUpload(input: {
    title: string;
    language: "ar" | "en";
    text: string;
  }): Promise<ContractRecord> {
    const record: ContractRecord = {
      id: `upload-${randomUUID()}`,
      title: input.title.trim() || "Uploaded contract",
      language: input.language,
      source: "upload",
      text: input.text,
    };
    this.uploads.set(record.id, record);
    return record;
  }

  private async corpusSummaries(): Promise<ContractRecord[]> {
    try {
      const raw = await readFile(join(this.corpusDir, "corpus_manifest.json"), "utf8");
      const manifest = JSON.parse(raw) as Manifest;
      return manifest.documents.map((d) => ({
        id: d.document_id,
        title: d.title,
        language: d.language,
        source: "corpus" as const,
        contractType: d.contract_type,
        ...(d.high_risk ? { highRisk: true } : {}),
        text: "",
      }));
    } catch {
      const names = await readdir(this.corpusDir);
      return names
        .filter((n) => n.endsWith(".md"))
        .map((n) => {
          const id = n.replace(/\.md$/, "");
          const language: "ar" | "en" = id.includes("-AR-") ? "ar" : "en";
          return {
            id,
            title: id,
            language,
            source: "corpus" as const,
            text: "",
          };
        });
    }
  }
}
