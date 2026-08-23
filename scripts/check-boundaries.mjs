#!/usr/bin/env node
/**
 * Hexagonal import guard (assessment lint).
 * domain/ and application/ must not import Express, LLM SDKs, or vector clients.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORBIDDEN = [
  /from\s+["']express["']/,
  /from\s+["']cors["']/,
  /from\s+["']openai["']/,
  /from\s+["']@qdrant\//,
  /from\s+["']chromadb["']/,
  /from\s+["']dotenv["']/,
  /from\s+["'].*presentation\//,
  /from\s+["'].*infrastructure\//,
];

const DOMAIN_ONLY_EXTRA = [/from\s+["'].*application\//];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function violations(path, source, extra = []) {
  const hits = [];
  for (const re of [...FORBIDDEN, ...extra]) {
    if (re.test(source)) {
      hits.push(re.source);
    }
  }
  return hits;
}

const domainDir = join(ROOT, "server/src/domain");
const appDir = join(ROOT, "server/src/application");
const problems = [];

for (const file of await walk(domainDir)) {
  const text = await readFile(file, "utf8");
  const hits = violations(file, text, DOMAIN_ONLY_EXTRA);
  if (hits.length) {
    problems.push(`${relative(ROOT, file)}: ${hits.join(", ")}`);
  }
}
for (const file of await walk(appDir)) {
  const text = await readFile(file, "utf8");
  const hits = violations(file, text);
  if (hits.length) {
    problems.push(`${relative(ROOT, file)}: ${hits.join(", ")}`);
  }
}

if (problems.length > 0) {
  console.error("Hexagonal boundary violations:");
  for (const line of problems) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("lint: hexagonal boundaries ok (domain + application).");
