import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/infrastructure/config.js";
import { createLegalServices } from "../../src/infrastructure/composition.js";
import { createApp } from "../../src/presentation/http/app.js";
import { htmlToText } from "../../src/infrastructure/parsing/document-text.adapter.js";
import { splitClauses } from "../../src/domain/chunking/split-clauses.js";
import { classifyClause } from "../../src/application/agents/classify.js";
import { makeDocx, makePdf } from "../fixtures/make-documents.js";

const ANALYST = "ingest-analyst-token";
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let server: Server;
let base: string;
let services: ReturnType<typeof createLegalServices>;

beforeAll(async () => {
  const config = {
    ...loadConfig(),
    analystToken: ANALYST,
    counselToken: "ingest-counsel-token",
    openaiApiKey: "",
    rateLimitPerMinute: 1_000,
    maxUploadBytes: 64 * 1024,
  };
  services = createLegalServices(config);
  server = createApp({ config, ...services }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  services.close();
});

interface Uploaded {
  id: string;
  title: string;
  language: "ar" | "en";
  source: string;
  text: string;
  redactions: Array<{ kind: string; count: number }>;
}

async function uploadFile(bytes: Buffer | Uint8Array, fileName: string, type: string) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), fileName);
  const res = await fetch(`${base}/api/contracts/upload-file`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANALYST}` },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as Uploaded & { error?: string; message?: string } };
}

function categories(text: string): string[] {
  return splitClauses(text).map((p) => classifyClause(p.heading, p.text).category);
}

const EN_CONTRACT = [
  "MASTER SERVICES AGREEMENT",
  "1. Confidentiality",
  "The receiving party shall keep all information confidential. Contact legal@helios.example for notices.",
  "2. Limitation of Liability",
  "The Supplier's liability shall not be subject to any monetary cap.",
  "3. Termination",
  "Either party may terminate on thirty (30) days' prior written notice.",
  "4. Governing Law",
  "This Agreement is governed by the laws of England and Wales.",
];

describe("POST /api/contracts/upload-file", () => {
  it("extracts a PDF, redacts personal data, stores it, and splits it into clauses", async () => {
    const { status, body } = await uploadFile(makePdf(EN_CONTRACT), "msa.pdf", PDF);
    expect(status).toBe(201);
    expect(body).toMatchObject({ title: "msa.pdf", language: "en", source: "upload" });
    expect(body.text).toContain("[REDACTED_EMAIL]");
    expect(body.text).not.toContain("legal@helios.example");
    expect(body.redactions).toEqual([{ kind: "email", count: 1 }]);
    expect(categories(body.text)).toEqual(["confidentiality", "liability", "termination", "jurisdiction"]);

    const stored = await (await fetch(`${base}/api/contracts/${body.id}`, { headers: { Authorization: `Bearer ${ANALYST}` } })).json();
    expect(stored.text).toBe(body.text);
  });

  it("runs a full review on an uploaded PDF", async () => {
    const { body } = await uploadFile(makePdf(EN_CONTRACT), "msa.pdf", PDF);
    const run = await services.orchestrator.start({ contractId: body.id, text: body.text, language: body.language });
    expect(run.state).toBe("AWAITING_APPROVAL");
    expect(run.clauses.map((c) => c.category)).toEqual(["confidentiality", "liability", "termination", "jurisdiction"]);
    expect(run.findings.filter((f) => f.omitted).map((f) => f.category)).toEqual(["indemnity"]);
    expect(run.findings.find((f) => f.category === "liability")?.severity).toBe("critical");
  });

  it("splits a Word file whose clause titles use heading styles and auto-numbering", async () => {
    const docx = await makeDocx([
      { text: "Confidentiality", heading: true },
      "Each party keeps the other's information confidential.",
      { text: "Termination", numbered: true },
      "Either party may terminate on thirty (30) days' written notice.",
      { text: "Governing Law", numbered: true },
      "This Agreement is governed by the laws of England and Wales.",
    ]);
    const { status, body } = await uploadFile(docx, "nda.docx", DOCX);
    expect(status).toBe(201);
    expect(body.text).toContain("## Confidentiality");
    expect(body.text).toMatch(/^1\. Termination$/m);
    expect(body.text).toMatch(/^2\. Governing Law$/m);
    expect(categories(body.text)).toEqual(["confidentiality", "termination", "jurisdiction"]);
  });

  it("handles an Arabic right-to-left Word file with Arabic-Indic numbering and an Arabic file name", async () => {
    const docx = await makeDocx(
      [
        "١. السرية",
        "يلتزم الطرف المتلقي بالمحافظة على سرية المعلومات.",
        "٢. المسؤولية",
        "تُحد المسؤولية بأتعاب اثني عشر شهراً.",
        "٣. القانون الحاكم",
        "يخضع هذا العقد لقوانين جمهورية مصر العربية.",
      ],
      true,
    );
    const { status, body } = await uploadFile(docx, "عقد-سرية.docx", DOCX);
    expect(status).toBe(201);
    expect(body.title).toBe("عقد-سرية.docx");
    expect(body.language).toBe("ar");
    expect(categories(body.text)).toEqual(["confidentiality", "liability", "jurisdiction"]);
  });

  it("keeps pdf-parse page markers out of multi-page text", async () => {
    const filler = Array.from({ length: 60 }, (_, i) => `Recital line ${i + 1}.`);
    const { status, body } = await uploadFile(makePdf([...EN_CONTRACT.slice(0, 3), ...filler, ...EN_CONTRACT.slice(3)]), "long.pdf", PDF);
    expect(status).toBe(201);
    expect(body.text).not.toMatch(/--\s*\d+\s+of\s+\d+\s*--/);
    expect(body.text).toContain("Recital line 60.");
    expect(categories(body.text)).toEqual(["confidentiality", "liability", "termination", "jurisdiction"]);
  });

  it("accepts plain text and Markdown", async () => {
    const md = Buffer.from("## 1. Payment\nInvoices are due in thirty (30) days.\n## 2. Termination\nEither party may terminate.");
    const { status, body } = await uploadFile(md, "terms.md", "");
    expect(status).toBe(201);
    expect(categories(body.text)).toEqual(["payment", "termination"]);
  });

  it("rejects unsupported, empty-text, oversized and missing files with clear statuses", async () => {
    const legacy = await uploadFile(Buffer.from("x"), "old-contract.doc", "application/msword");
    expect(legacy.status).toBe(415);
    expect(legacy.body.error).toBe("UNSUPPORTED_DOCUMENT");

    const scanned = await uploadFile(makePdf([]), "scan.pdf", PDF);
    expect(scanned.status).toBe(422);
    expect(scanned.body.message).toMatch(/OCR/);

    const corrupt = await uploadFile(Buffer.from("%PDF-1.4 not really"), "broken.pdf", PDF);
    expect(corrupt.status).toBe(422);
    expect(corrupt.body.error).toBe("UNREADABLE_DOCUMENT");

    const big = await uploadFile(Buffer.alloc(80 * 1024, "a"), "big.txt", "text/plain");
    expect(big.status).toBe(413);

    const none = await fetch(`${base}/api/contracts/upload-file`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANALYST}` },
      body: new FormData(),
    });
    expect(none.status).toBe(400);
  });

  it("requires authentication", async () => {
    const form = new FormData();
    form.append("file", new Blob([makePdf(EN_CONTRACT)], { type: PDF }), "x.pdf");
    const res = await fetch(`${base}/api/contracts/upload-file`, { method: "POST", body: form });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/contracts/upload (JSON text)", () => {
  it("now redacts personal data before storing, like file uploads", async () => {
    const res = await fetch(`${base}/api/contracts/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANALYST}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "pasted", text: "## 1. Notices\nWrite to counsel@example.com." }),
    });
    const body = (await res.json()) as Uploaded;
    expect(res.status).toBe(201);
    expect(body.text).toContain("[REDACTED_EMAIL]");
    expect(body.redactions).toEqual([{ kind: "email", count: 1 }]);
  });
});

describe("htmlToText", () => {
  it("keeps headings and list numbering from Word HTML", () => {
    const text = htmlToText(
      "<h1>Fees &amp; Payment</h1><p>Due in 30 days.</p><ol><li>Scope</li><li>Term<ol><li>Renewal</li></ol></li></ol><ul><li>note</li></ul><table><tr><td>a</td><td>b</td></tr></table>",
    );
    expect(text).toContain("## Fees & Payment");
    expect(text).toMatch(/^1\. Scope$/m);
    expect(text).toMatch(/^2\. Term$/m);
    expect(text).toMatch(/^ {2}1\. Renewal$/m);
    expect(text).toMatch(/^- note$/m);
    expect(text).toContain("a | b |");
  });
});

describe("splitClauses headings", () => {
  it("splits on Arabic-Indic numbers and unnumbered ## headings, but not on a single # title", () => {
    const parts = splitClauses("# Title\nPreamble\n## Background\nRecitals.\n١. السرية\nنص.\n## 2. Payment\nFees.");
    expect(parts.map((p) => p.heading)).toEqual(["## Background", "١. السرية", "## 2. Payment"]);
  });
});
