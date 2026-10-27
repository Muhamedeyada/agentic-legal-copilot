import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/infrastructure/config.js";
import { createLegalServices } from "../../src/infrastructure/composition.js";
import { createApp } from "../../src/presentation/http/app.js";

const COUNSEL = "openapi-counsel-token";
const SPEC = new URL("../../../docs/openapi.yaml", import.meta.url);

/** `paths:` → [method, path] pairs, read from the YAML indentation (no YAML dependency). */
function documentedOperations(raw: string): Array<[string, string]> {
  // Windows checkouts (core.autocrlf=true) turn the spec's line endings into CRLF.
  const yaml = raw.replace(/\r\n?/g, "\n");
  const start = yaml.indexOf("\npaths:\n");
  const end = yaml.indexOf("\ncomponents:\n");
  if (start < 0 || end <= start) {
    throw new Error("docs/openapi.yaml: could not find the top-level `paths:` and `components:` sections.");
  }
  const section = yaml.slice(start, end);
  const ops: Array<[string, string]> = [];
  let path = "";
  for (const line of section.split("\n")) {
    const p = /^ {2}(\/\S*):\s*$/.exec(line);
    if (p?.[1]) {
      path = p[1];
      continue;
    }
    const m = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
    if (m?.[1] && path) {
      ops.push([m[1].toUpperCase(), path]);
    }
  }
  return ops;
}

let server: Server;
let base: string;
let operations: Array<[string, string]>;

beforeAll(async () => {
  operations = documentedOperations(await readFile(SPEC, "utf8"));
  const config = { ...loadConfig(), analystToken: "openapi-analyst-token", counselToken: COUNSEL, openaiApiKey: "", rateLimitPerMinute: 1_000 };
  const app = createApp({ config, ...createLegalServices(config) });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("docs/openapi.yaml", () => {
  it("parses the spec the same with LF and CRLF line endings", async () => {
    const lf = (await readFile(SPEC, "utf8")).replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(documentedOperations(crlf)).toEqual(documentedOperations(lf));
    expect(documentedOperations(lf).length).toBeGreaterThan(15);
  });

  it("documents the core endpoints", () => {
    const paths = new Set(operations.map(([, p]) => p));
    for (const p of [
      "/health",
      "/api/contracts",
      "/api/contracts/upload",
      "/api/chat",
      "/api/workflow/run",
      "/api/workflow/stream/{runId}",
      "/api/workflow/{runId}/approve",
    ]) {
      expect(paths).toContain(p);
    }
  });

  it("every documented operation is served by the Express app", async () => {
    expect(operations.length).toBeGreaterThan(15);
    for (const [method, path] of operations) {
      const url = base + path.replace(/\{[^}]+\}/g, "00000000-0000-4000-8000-000000000000");
      const ac = new AbortController();
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${COUNSEL}`, "Content-Type": "application/json" },
        ...(method === "GET" ? {} : { body: "{}" }),
        signal: ac.signal,
      });
      const type = res.headers.get("content-type") ?? "";
      ac.abort();
      // An unknown route falls through to Express's default HTML 404 ("Cannot POST …").
      expect(type, `${method} ${path} -> ${res.status} ${type}`).toMatch(/application\/json|text\/event-stream/);
    }
  });
});
