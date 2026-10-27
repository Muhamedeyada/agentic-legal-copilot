import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/infrastructure/config.js";
import { createLegalServices } from "../../src/infrastructure/composition.js";
import { createApp } from "../../src/presentation/http/app.js";

const ANALYST = "test-analyst-token";
const COUNSEL = "test-counsel-token";
const FORBIDDEN = { error: "Forbidden: Requires Legal Counsel authorization" };

const SAMPLE = [
  "## 1. Liability",
  "Liability is capped at twelve months of fees.",
  "## 2. Termination",
  "Either party may terminate on thirty (30) days written notice.",
  "## 3. Governing law",
  "This agreement is governed by England and Wales.",
  "## 4. Indemnity",
  "Each party shall indemnify the other, capped at the liability cap.",
].join("\n");

let server: Server;
let base: string;

beforeAll(async () => {
  const config = {
    ...loadConfig(),
    analystToken: ANALYST,
    counselToken: COUNSEL,
    openaiApiKey: "",
    rateLimitPerMinute: 1_000,
  };
  const services = createLegalServices(config);
  const app = createApp({ config, ...services });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function call(path: string, init: { method?: string; token?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

async function awaitingRun(): Promise<string> {
  const res = await call("/api/workflow/run", {
    method: "POST",
    token: ANALYST,
    body: { contractId: "auth-test", text: SAMPLE, language: "en" },
  });
  expect(res.status).toBe(202);
  const { runId } = (await res.json()) as { runId: string };
  for (let i = 0; i < 100; i += 1) {
    const snap = (await (await call(`/api/workflow/${runId}`, { token: ANALYST })).json()) as { state: string };
    if (snap.state === "AWAITING_APPROVAL") {
      return runId;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("run never reached AWAITING_APPROVAL");
}

describe("authentication", () => {
  it("leaves health open", async () => {
    expect((await call("/api/health")).status).toBe(200);
  });

  it("returns 401 without a token or with a wrong token", async () => {
    expect((await call("/api/contracts")).status).toBe(401);
    expect((await call("/api/contracts", { token: "nope" })).status).toBe(401);
  });

  it("lets an analyst use non-approval endpoints", async () => {
    expect((await call("/api/contracts", { token: ANALYST })).status).toBe(200);
  });

  it("accepts an SSE token in the query string only for event streams", async () => {
    const runId = await awaitingRun();
    const plain = await call(`/api/workflow/${runId}?access_token=${ANALYST}`);
    expect(plain.status).toBe(401);
    const ac = new AbortController();
    const stream = await fetch(`${base}/api/workflow/stream/${runId}?access_token=${ANALYST}`, {
      headers: { Accept: "text/event-stream" },
      signal: ac.signal,
    });
    expect(stream.status).toBe(200);
    ac.abort();
  });
});

describe("counsel approval gate", () => {
  for (const [path, body] of [
    ["approve", {}],
    ["reject", { reason: "not acceptable" }],
    ["edit-and-approve", { bodyEn: "edited" }],
  ] as const) {
    it(`rejects ${path} from an analyst with 403`, async () => {
      const runId = await awaitingRun();
      const res = await call(`/api/workflow/${runId}/${path}`, { method: "POST", token: ANALYST, body });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(FORBIDDEN);
    });
  }

  it("does not let x-user-role escalate an analyst to counsel", async () => {
    const runId = await awaitingRun();
    const res = await call(`/api/workflow/${runId}/approve`, {
      method: "POST",
      token: ANALYST,
      headers: { "x-user-role": "counsel" },
    });
    expect(res.status).toBe(403);
  });

  it("lets x-user-role narrow counsel to analyst", async () => {
    const runId = await awaitingRun();
    const res = await call(`/api/workflow/${runId}/approve`, {
      method: "POST",
      token: COUNSEL,
      headers: { "x-user-role": "analyst" },
    });
    expect(res.status).toBe(403);
  });

  it("blocks the legacy memo and decision routes for analysts", async () => {
    const runId = await awaitingRun();
    for (const path of [`/reviews/${runId}/memo`, `/reviews/runs/${runId}/approve`]) {
      const res = await call(path, { method: "POST", token: ANALYST, body: {} });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(FORBIDDEN);
    }
  });

  it("lets counsel approve", async () => {
    const runId = await awaitingRun();
    const res = await call(`/api/workflow/${runId}/approve`, {
      method: "POST",
      token: COUNSEL,
      body: { counselId: "spoofed" },
    });
    expect(res.status).toBe(200);
    const snap = (await res.json()) as { state: string; memo: { approvedByCounsel: boolean } };
    expect(snap.state).toBe("COMPLETED");
    expect(snap.memo.approvedByCounsel).toBe(true);
  });
});
