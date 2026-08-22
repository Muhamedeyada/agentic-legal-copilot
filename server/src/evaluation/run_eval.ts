import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApprovalRequiredError } from "../domain/errors.js";
import { ClauseExtractorOutputZ, parseContract } from "../application/agents/schemas.js";
import { CorpusRagUseCase } from "../application/chat/corpus-rag.js";
import { LegalWorkflowOrchestrator } from "../application/orchestrator.js";
import { MockCompletionAdapter } from "../infrastructure/llm/mock.adapter.js";
import { InMemoryApprovalAdapter } from "../infrastructure/approval/in-memory.adapter.js";
import { InMemoryPlaybookAdapter } from "../infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../infrastructure/runs/in-memory.adapter.js";
import { loadCorpusChunks } from "./load-corpus.js";
import { splitClauses } from "../domain/chunking/split-clauses.js";
import { classifyClause } from "../application/agents/classify.js";

interface GoldenItem {
  id: string;
  lang_query: "ar" | "en";
  lang_source: "ar" | "en" | "mixed";
  task: string;
  query: string;
  contract_id?: string;
  expected_answer: string;
  must_cite_docs: string[];
  must_cite_terms: string[];
  expect_refuse: boolean;
  adversarial: boolean;
}

interface GoldenFile {
  version: string;
  k: number;
  items: GoldenItem[];
}

interface ItemResult {
  id: string;
  task: string;
  lang_query: "ar" | "en";
  lang_source: string;
  adversarial: boolean;
  hit: boolean;
  precisionAtK: number;
  citationAccuracy: boolean;
  grounded: boolean;
  refusalCorrect: boolean;
  refused: boolean;
  notes: string;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(n: number | undefined): string {
  return `${(((n ?? 0) * 100).toFixed(1))}%`;
}

function resolveRepoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../..");
}

function corpusDir(root: string): string {
  const fromEnv = process.env.CORPUS_DIR;
  if (fromEnv && fromEnv.length > 0) {
    return resolve(fromEnv);
  }
  return join(root, "data", "corpus");
}

export async function runEvaluation(): Promise<{
  summary: Record<string, unknown>;
  items: ItemResult[];
}> {
  const root = resolveRepoRoot();
  const goldenPath = join(root, "data", "evaluation_golden_set.json");
  const golden = JSON.parse(await readFile(goldenPath, "utf8")) as GoldenFile;
  const k = golden.k ?? 5;
  const chunks = await loadCorpusChunks(corpusDir(root));
  const knownDocs = new Set(chunks.map((c) => c.documentId));
  const rag = new CorpusRagUseCase(chunks, new InMemoryPlaybookAdapter());

  const items: ItemResult[] = [];

  for (const item of golden.items) {
    if (item.task === "hitl") {
      items.push(await evalHitl(item));
      continue;
    }
    const answer = await rag.ask({
      query: item.query,
      topK: k,
      ...(item.contract_id ? { documentId: item.contract_id } : {}),
    });
    const citedDocs = answer.citations.map((c) => c.documentId);
    const goldDocs = item.must_cite_docs;
    const hit =
      goldDocs.length === 0
        ? item.expect_refuse
          ? true
          : answer.citations.length > 0
        : citedDocs.some((d) => goldDocs.includes(d));
    const overlap = citedDocs.filter((d) => goldDocs.includes(d)).length;
    const precisionAtK = citedDocs.length === 0 ? (goldDocs.length === 0 ? 1 : 0) : overlap / Math.min(k, citedDocs.length);
    const citationAccuracy = answer.citations.every(
      (c) => knownDocs.has(c.documentId) || c.documentId.startsWith("playbook:"),
    );
    const blob = `${answer.answer}\n${answer.citations
      .map((c) => {
        const full = chunks.find((ch) => ch.chunkId === c.chunkId);
        return `${c.excerpt}\n${full?.text ?? ""}`;
      })
      .join("\n")}`;
    const grounded =
      item.expect_refuse ||
      item.must_cite_terms.length === 0 ||
      item.must_cite_terms.every((term) => blob.toLowerCase().includes(term.toLowerCase()));
    const refusalCorrect = answer.refused === item.expect_refuse;
    items.push({
      id: item.id,
      task: item.task,
      lang_query: item.lang_query,
      lang_source: item.lang_source,
      adversarial: item.adversarial,
      hit: item.expect_refuse ? refusalCorrect : hit && !answer.refused,
      precisionAtK: item.expect_refuse ? (refusalCorrect ? 1 : 0) : precisionAtK,
      citationAccuracy,
      grounded: item.expect_refuse ? refusalCorrect : grounded,
      refusalCorrect,
      refused: answer.refused,
      notes: answer.reason ?? (hit ? "ok" : `cited=${citedDocs.slice(0, 3).join(",")}`),
    });
  }

  const schemaOk = checkSchemaFixture();
  const by = (pred: (r: ItemResult) => boolean) => items.filter(pred);
  const retrieveLike = by((r) => r.task !== "hitl" && r.task !== "refusal");
  const en = by((r) => r.lang_query === "en" && r.task !== "hitl");
  const ar = by((r) => r.lang_query === "ar" && r.task !== "hitl");
  const xl = by((r) => r.task === "crosslingual");
  const adv = by((r) => r.adversarial);
  const refusal = by((r) => r.task === "refusal" || r.id === "G-20");

  const summary = {
    provider: "deterministic-local",
    model: "none (CorpusRagUseCase + MockCompletion for HITL)",
    n: items.length,
    schemaValidity: schemaOk ? 1 : 0,
    overall: {
      hitRate: mean(retrieveLike.map((r) => (r.hit ? 1 : 0))),
      precisionAtK: mean(retrieveLike.map((r) => r.precisionAtK)),
      citationAccuracy: mean(items.map((r) => (r.citationAccuracy ? 1 : 0))),
      groundedness: mean(items.map((r) => (r.grounded ? 1 : 0))),
      refusalCorrectness: mean(refusal.map((r) => (r.refusalCorrect ? 1 : 0))),
    },
    english: {
      n: en.length,
      hitRate: mean(en.filter((r) => r.task !== "refusal").map((r) => (r.hit ? 1 : 0))),
      precisionAtK: mean(en.filter((r) => r.task !== "refusal").map((r) => r.precisionAtK)),
    },
    arabic: {
      n: ar.length,
      hitRate: mean(ar.filter((r) => r.task !== "refusal").map((r) => (r.hit ? 1 : 0))),
      precisionAtK: mean(ar.filter((r) => r.task !== "refusal").map((r) => r.precisionAtK)),
    },
    crossLingual: {
      n: xl.length,
      hitRate: mean(xl.map((r) => (r.hit ? 1 : 0))),
      precisionAtK: mean(xl.map((r) => r.precisionAtK)),
    },
    adversarial: {
      n: adv.length,
      refusalCorrectness: mean(adv.map((r) => (r.refusalCorrect ? 1 : 0))),
      hitRate: mean(adv.filter((r) => !r.task.includes("refusal")).map((r) => (r.hit ? 1 : 0))),
    },
    failures: items.filter((r) => !r.hit || !r.refusalCorrect || !r.grounded).map((r) => r.id),
  };

  return { summary, items };
}

function checkSchemaFixture(): boolean {
  const text = [
    "## 1. Liability",
    "Aggregate liability is capped at twelve months of fees.",
    "## 2. Governing law",
    "This agreement is governed by England and Wales.",
  ].join("\n");
  const clauses = splitClauses(text).map((part, index) => {
    const { category, standard } = classifyClause(part.heading, part.text);
    return {
      id: `schema:clause:${index + 1}`,
      contractId: "schema",
      category,
      title: part.title,
      text: part.text,
      language: part.language,
      heading: part.heading,
      standard,
      spanStart: part.spanStart,
      spanEnd: part.spanEnd,
    };
  });
  try {
    parseContract(ClauseExtractorOutputZ, "ClauseExtractorOutput", { clauses });
    return true;
  } catch {
    return false;
  }
}

async function evalHitl(item: GoldenItem): Promise<ItemResult> {
  const orchestrator = new LegalWorkflowOrchestrator({
    completion: new MockCompletionAdapter(),
    playbook: new InMemoryPlaybookAdapter(),
    approval: new InMemoryApprovalAdapter(),
    runs: new InMemoryRunStoreAdapter(),
    requireCounselApproval: true,
    maxRetries: 0,
  });
  const sample = [
    "## 1. Confidentiality",
    "The parties shall keep confidential information secret for three (3) years.",
    "## 2. Liability",
    "Liability is capped at twelve months of fees.",
    "## 3. Termination",
    "Either party may terminate on thirty (30) days written notice.",
    "## 4. Governing law",
    "This agreement is governed by England and Wales.",
    "## 5. Indemnity",
    "Each party shall indemnify the other, capped at the liability cap.",
  ].join("\n");
  const run = await orchestrator.start({
    contractId: item.contract_id ?? "hitl",
    text: sample,
    language: "en",
  });
  let blocked = false;
  try {
    await orchestrator.draftMemo({
      reviewId: run.runId,
      contractId: run.contractId,
      language: "en",
    });
  } catch (err) {
    blocked = err instanceof ApprovalRequiredError;
  }
  return {
    id: item.id,
    task: item.task,
    lang_query: item.lang_query,
    lang_source: item.lang_source,
    adversarial: item.adversarial,
    hit: blocked,
    precisionAtK: blocked ? 1 : 0,
    citationAccuracy: true,
    grounded: blocked,
    refusalCorrect: blocked,
    refused: blocked,
    notes: blocked ? "APPROVAL_REQUIRED" : "memo leaked without counsel",
  };
}

async function main(): Promise<void> {
  const started = Date.now();
  const { summary, items } = await runEvaluation();
  const root = resolveRepoRoot();
  const outDir = join(root, "data", "runtime");
  await mkdir(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    summary,
    items,
  };
  const outPath = join(outDir, "eval-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");

  const s = summary as {
    overall: Record<string, number>;
    english: Record<string, number>;
    arabic: Record<string, number>;
    crossLingual: Record<string, number>;
    schemaValidity: number;
    failures: string[];
    n: number;
  };
  console.log("D1T1 evaluation (deterministic, no paid API)");
  console.log(`Items: ${s.n}  Schema: ${pct(s.schemaValidity)}`);
  console.log(
    `Overall  Hit: ${pct(s.overall.hitRate)}  P@k: ${pct(s.overall.precisionAtK)}  CiteAcc: ${pct(s.overall.citationAccuracy)}  Grounded: ${pct(s.overall.groundedness)}  Refusal: ${pct(s.overall.refusalCorrectness)}`,
  );
  console.log(`EN      Hit: ${pct(s.english.hitRate)}  P@k: ${pct(s.english.precisionAtK)}`);
  console.log(`AR      Hit: ${pct(s.arabic.hitRate)}  P@k: ${pct(s.arabic.precisionAtK)}`);
  console.log(`XL      Hit: ${pct(s.crossLingual.hitRate)}  P@k: ${pct(s.crossLingual.precisionAtK)}`);
  console.log(`Failures: ${s.failures.length ? s.failures.join(", ") : "none"}`);
  console.log(`Report: ${outPath}`);
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
