import { randomUUID } from "node:crypto";
import type {
  ContractCatalogPort,
  ContractRecord,
  ContractSummary,
} from "../../domain/ports/contract-catalog.port.js";
import type { SqliteDatabase } from "../sqlite/database.js";

interface UploadRow {
  id: string;
  title: string;
  language: "ar" | "en";
  text: string;
}

/** Synthetic corpus from disk (read-only) plus uploaded contracts persisted in SQLite. */
export class SqliteContractCatalogAdapter implements ContractCatalogPort {
  private readonly insert;
  private readonly selectOne;
  private readonly selectAll;

  constructor(
    db: SqliteDatabase,
    private readonly corpus: ContractCatalogPort,
  ) {
    this.insert = db.prepare(
      "INSERT INTO uploads (id, title, language, text, created_at) VALUES (@id, @title, @language, @text, @created_at)",
    );
    this.selectOne = db.prepare("SELECT id, title, language, text FROM uploads WHERE id = ?");
    this.selectAll = db.prepare("SELECT id, title, language FROM uploads ORDER BY created_at, id");
  }

  async list(): Promise<readonly ContractSummary[]> {
    const corpus = (await this.corpus.list()).filter((c) => c.source === "corpus");
    const uploads = (this.selectAll.all() as Omit<UploadRow, "text">[]).map(
      (row): ContractSummary => ({ id: row.id, title: row.title, language: row.language, source: "upload" }),
    );
    return [...corpus, ...uploads];
  }

  async get(id: string): Promise<ContractRecord | undefined> {
    const row = this.selectOne.get(id) as UploadRow | undefined;
    if (row) {
      return { id: row.id, title: row.title, language: row.language, source: "upload", text: row.text };
    }
    return this.corpus.get(id);
  }

  async saveUpload(input: { title: string; language: "ar" | "en"; text: string }): Promise<ContractRecord> {
    const record: ContractRecord = {
      id: `upload-${randomUUID()}`,
      title: input.title.trim() || "Uploaded contract",
      language: input.language,
      source: "upload",
      text: input.text,
    };
    this.insert.run({
      id: record.id,
      title: record.title,
      language: record.language,
      text: record.text,
      created_at: new Date().toISOString(),
    });
    return record;
  }
}
