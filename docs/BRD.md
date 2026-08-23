# Business Requirements Document (BRD)

**Product:** Agentic Legal Copilot  
**Variant:** D1T1 — Legal Contract Review & Research; bilingual AR + EN  
**Stack:** Node.js + TypeScript (Express, hexagonal) · React + Vite + Tailwind (RTL)  
**Audience:** Counsel (primary), paralegal (secondary), instructor (assessment)  
**Status:** Assessment MVP — requirements below match the **running** system (2026-08-23)

---

## 1. Problem statement

Counsel reviewing bilingual (Arabic / English) commercial contracts spend disproportionate time on: locating clauses, comparing them to playbooks or prior language, classifying risk, and drafting a review memo. Manual cross-lingual search is slow and easy to miss. An ungoverned LLM is unsafe: it may invent law, ignore RTL, or act without approval.

This product is a **governed copilot**, not an autonomous lawyer. It extracts, retrieves, and drafts; Counsel decides.

---

## 2. Goals and non-goals

### Goals

- Ingest synthetic/public contracts in AR, EN, or mixed language (text/markdown in this MVP).
- Extract a structured clause inventory (typed schema).
- Assess risk per clause/theme with cited evidence; **silent omission** of mandatory families is Critical.
- Retrieve supporting snippets **cross-lingually** (AR ↔ EN) with citations or a typed refusal.
- Draft a bilingual review memo that is **issued only after Counsel approval**.
- Present Arabic UI in RTL (`document.documentElement.dir`).
- Stream agent progress over SSE.
- Keep an in-memory audit trail of agent steps and human gates (Trace drawer).
- Re-run a bilingual golden set without a paid API (`npm run eval`).

### Non-goals (this assessment / MVP)

- Binding legal advice or court filing.
- Production e-discovery or DMS integration.
- Training or fine-tuning on real client data.
- Fully autonomous send/export without a human.
- Production identity provider / role IAM (paralegal vs Counsel tokens).
- PDF/DOCX binary parsers and a hosted vector database.

---

## 3. Personas

| ID | Persona | Needs |
| --- | --- | --- |
| P-01 | Counsel | Clause map, risk flags, cited memo, approval control |
| P-02 | Paralegal | Fast extraction and bilingual retrieval; no final send rights (enforced by HITL, not by login) |
| P-03 | Instructor | Traceable design, eval set, AI-usage log, 5-minute demo, teaching pack |

---

## 4. Business requirements

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| BR-01 | Upload contract files with size limits | Must | **Partial:** JSON/text upload + 32-file catalog. PDF/DOCX MIME pipeline deferred |
| BR-02 | Detect and tag language per document and per clause (`ar` / `en` / `mixed`) | Must | Heading splitter + script-count detector |
| BR-03 | Extract clauses into a versioned typed schema | Must | Clause Extractor + Zod; deterministic fallback |
| BR-04 | Classify contractual risk with severity and rationale | Must | Risk Assessor + `risk_calculator_tool` |
| BR-05 | Retrieve comparable / policy snippets in AR and EN (cross-lingual) | Must | Lexical RAG + bilingual expand; dense hybrid deferred |
| BR-06 | Render Arabic UI and reports RTL | Must | `locale.tsx` sets `html[dir]` |
| BR-07 | Draft review memo in AR, EN, or both | Must | Memo Drafter; sanitized bodies |
| BR-08 | Require Counsel approval before issuing the memo | Must | HITL; HTTP 403 until approved |
| BR-09 | Cite contract spans and corpus chunks; refuse uncited legal claims | Must | RAG min-score + eval groundedness |
| BR-10 | Swap LLM/embedding providers without changing domain logic | Must | Ports + factory; hosted HTTP still stubbed |
| BR-11 | Local / offline fallback when hosted provider is unavailable | Should | Empty key → mock; agents use rules |
| BR-12 | Audit log of agent I/O and approval events | Must | **Partial:** in-memory `run.traces` + SSE + Trace UI; no durable store |
| BR-13 | Evaluation harness against ≥25 bilingual Q/A pairs | Must | 28-item gold set; EN/AR/XL sliced |
| BR-14 | Never persist raw personal data in git or logs | Must | Synthetic corpus; `redactPii`; `.gitignore` on `.env` |
| BR-15 | Stream review progress to the client via SSE | Should | `/api/workflow/stream/:runId` |

---

## 5. Success criteria

- Counsel can complete the 5-minute demo path in the root `README.md` on synthetic AR and EN contracts **without a paid API key**.
- Cross-lingual items G-13…G-17 retrieve a cited gold span (see `docs/EVALUATION.md`).
- Memo issue is blocked when `REQUIRE_COUNSEL_APPROVAL=true` (`POST /reviews/:id/memo` → 403).
- `server/src/domain` and `server/src/application` have **zero** imports of Express, OpenAI SDKs, or vector-store clients (`npm run lint`).
- Toggling the client locale sets `html[dir=rtl]` for Arabic and `ltr` for English.

---

## 6. Traceability matrix

| BR ID | Description | Design | Architecture | Security | Evaluation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| BR-01 | Upload / catalog | SYSTEM-DESIGN G-06 | File catalog adapter | A03 size cap | — | **Partial** (text only) |
| BR-02 | Language tagging | G-07 | `splitClauses` + `Locale` | — | Lang on chunks | **Complete** (heuristic) |
| BR-03 | Clause extraction | G-08 | ADR-0003; Zod schemas | LLM05 schema | Schema fixture in eval | **Complete** |
| BR-04 | Risk assessment | G-11 | `risk_calculator_tool` | LLM09 not LLM-scored | G-18, G-19 | **Complete** |
| BR-05 | Cross-lingual retrieve | G-10 | ADR-0004; lexical | LLM09 refuse | G-13…G-17, EN/AR/XL | **Complete** (lexical) |
| BR-06 | RTL | G-05 | Client locale | Homoglyph note | G-12 intent / UI | **Complete** |
| BR-07 | Bilingual memo | G-12 | Memo Drafter | LLM05 sanitize | HITL G-20 | **Complete** |
| BR-08 | Counsel HITL | G-04 | ADR-0003 | LLM06 / A04 | G-20 | **Complete** |
| BR-09 | Citations / refuse | G-10 | DirectRag / CorpusRag | LLM09 | Groundedness + G-21…G-24 | **Complete** |
| BR-10 | Provider ports | G-13 | ADR-0002 | LLM03 | Eval uses mock | **Complete** (adapters stubbed) |
| BR-11 | Offline fallback | G-13 | Factory → mock | — | `npm run eval` | **Complete** |
| BR-12 | Audit / traces | G-14 | `run.traces`, SSE | A09 | Trace UI | **Partial** (in-memory) |
| BR-13 | Golden eval | G-15 | `run_eval.ts` | LLM09 | `EVALUATION.md` | **Complete** |
| BR-14 | No secrets / PII | G-06 | `.gitignore`, redact | A02, LLM02 | Synthetic gold | **Complete** |
| BR-15 | SSE progress | G-03 | Event bus | — | Streaming tests | **Complete** |

### Deferred scope (not Complete)

| Item | Why deferred | Next increment |
| --- | --- | --- |
| PDF/DOCX ingest | Assessment corpus is markdown; parsers add supply-chain surface | MIME allow-list + `pdf-parse` / mammoth behind infra |
| Hybrid dense+BM25+RRF | Exists on `feat/ingestion-and-hybrid-retrieval`, not on `main` | Merge after local embedding adapter is default |
| Hosted completion HTTP | Classroom must not require a key | Wire SDK only in `infrastructure/llm/hosted.adapter.ts` |
| Production auth / roles | Demo is local; `DEMO_API_TOKEN` unused | Token middleware + Counsel vs Paralegal |
| Durable audit / OTel | In-memory traces suffice for the 5-minute demo | SQLite audit table + redacted export |

---

## 7. Assumptions and constraints

- Assessment corpus is synthetic or public-domain; no live client matters.
- Student/instructor environment may have no hosted API key; mock + deterministic fallbacks are the supported path.
- Outputs are assistive drafts. Product copy must not claim to replace a licensed attorney.
