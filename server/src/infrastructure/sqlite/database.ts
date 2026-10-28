import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteDatabase = Database.Database;

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE runs (
    run_id            TEXT PRIMARY KEY,
    contract_id       TEXT NOT NULL,
    language          TEXT NOT NULL,
    state             TEXT NOT NULL,
    contract_text     TEXT NOT NULL,
    clauses           TEXT NOT NULL,
    findings          TEXT NOT NULL,
    memo              TEXT,
    rejection_reason  TEXT,
    prompt_tokens     INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    iteration         INTEGER NOT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );
  CREATE INDEX runs_state ON runs (state);

  CREATE TABLE run_traces (
    run_id            TEXT NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,
    seq               INTEGER NOT NULL,
    at                TEXT NOT NULL,
    step              TEXT NOT NULL,
    agent_id          TEXT,
    tool_name         TEXT,
    latency_ms        INTEGER NOT NULL,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    error             TEXT,
    input             TEXT NOT NULL,
    output            TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  );

  CREATE TABLE approvals (
    review_id   TEXT PRIMARY KEY,
    decision    TEXT NOT NULL,
    counsel_id  TEXT,
    reason      TEXT,
    edited_memo TEXT,
    at          TEXT NOT NULL
  );

  CREATE TABLE approval_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id   TEXT NOT NULL,
    decision    TEXT NOT NULL,
    counsel_id  TEXT,
    reason      TEXT,
    edited_memo TEXT,
    at          TEXT NOT NULL
  );
  CREATE INDEX approval_audit_review ON approval_audit (review_id);

  CREATE TABLE uploads (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    language   TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
];

export function openDatabase(path: string): SqliteDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(db: SqliteDatabase): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  MIGRATIONS.slice(current).forEach((sql, i) => {
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${current + i + 1}`);
    })();
  });
}
