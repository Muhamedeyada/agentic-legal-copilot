# Business Requirements Document (BRD)

**Product:** Agentic Legal Copilot  
**Variant:** D1T1 — Legal Contract Review & Research; bilingual AR + EN  
**Stack:** Node.js + TypeScript (Express, hexagonal) · React + Vite + Tailwind (RTL)  
**Audience:** Counsel (primary), paralegal (secondary), instructor (assessment)  
**Status:** Draft — acceptance criteria will tighten as the MVP lands

---

## 1. Problem statement

Counsel reviewing bilingual (Arabic / English) commercial contracts spend disproportionate time on: locating clauses, comparing them to playbooks or prior language, classifying risk, and drafting a review memo. Manual cross-lingual search is slow and easy to miss. An ungoverned LLM is unsafe: it may invent law, ignore RTL, or act without approval.

This product is a **governed copilot**, not an autonomous lawyer. It extracts, retrieves, and drafts; Counsel decides.

---

## 2. Goals and non-goals

### Goals

- Ingest synthetic/public contracts in AR, EN, or mixed language.
- Extract a structured clause inventory (typed schema).
- Assess risk per clause/theme with cited evidence.
- Retrieve supporting snippets **cross-lingually** (AR ↔ EN).
- Draft a bilingual review memo **only after Counsel approval**.
- Present Arabic UI in RTL (`dir="rtl"`).
- Stream agent progress over SSE.
- Keep an audit trail of agent steps and human gates.

### Non-goals (this assessment / MVP)

- Binding legal advice or court filing.
- Production e-discovery or DMS integration.
- Training or fine-tuning on real client data.
- Fully autonomous send/export without a human.

---

## 3. Personas

| ID | Persona | Needs |
| --- | --- | --- |
| P-01 | Counsel | Trustworthy clause map, risk flags, cited memo, approval control |
| P-02 | Paralegal | Fast extraction and bilingual retrieval; no final send rights |
| P-03 | Instructor | Traceable design, eval set, AI-usage log, 5-minute demo |

---

## 4. Business requirements

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| BR-01 | Upload contract files (PDF / DOCX / TXT) with size and MIME limits | Must | Synthetic corpus only in git |
| BR-02 | Detect and tag language per document and per clause (`ar` / `en` / `mixed`) | Must | T1 |
| BR-03 | Extract clauses into a versioned typed schema | Must | Clause Extractor agent |
| BR-04 | Classify contractual risk with severity and rationale | Must | Risk Assessor agent |
| BR-05 | Retrieve comparable / policy snippets in AR and EN (cross-lingual) | Must | T1 retrieval |
| BR-06 | Render Arabic UI and reports RTL | Must | React `dir` + bilingual copy |
| BR-07 | Draft review memo in AR, EN, or both | Must | Memo Drafter; gated |
| BR-08 | Require Counsel approval before side effects and final memo | Must | HITL; HTTP 403 until approved |
| BR-09 | Cite contract spans and corpus chunks; refuse uncited legal claims | Must | Grounding |
| BR-10 | Swap LLM/embedding providers without changing domain logic | Must | Hexagonal ports |
| BR-11 | Local fallback when hosted provider is unavailable | Should | Adapter factory |
| BR-12 | Audit log of agent I/O (redacted) and approval events | Must | Governance |
| BR-13 | Evaluation harness against a 25-item bilingual golden set | Must | Assessment |
| BR-14 | Never persist raw personal data in git or logs | Must | Security / privacy |
| BR-15 | Stream review progress to the client via SSE | Should | `/events` |

---

## 5. Success criteria

- Counsel can complete the 5-minute demo path (see root `README.md`) on synthetic AR and EN contracts.
- Cross-lingual retrieval returns at least one relevant cited chunk for golden bilingual queries (threshold TBD in `EVALUATION.md`).
- Memo generation is blocked when `REQUIRE_COUNSEL_APPROVAL=true` and no approval is recorded (`POST /reviews/:id/memo` → 403).
- `server/src/domain` and `server/src/application` have **zero** imports of Express, OpenAI SDKs, or vector-store clients (enforced in review / later lint).
- Toggling the client locale sets `html[dir=rtl]` for Arabic and `ltr` for English.

---

## 6. Traceability matrix

Map each business requirement to design, architecture, security, and evaluation. Fill **Design / Arch / Sec / Eval** as those documents are completed.

| BR ID | Description (short) | Design (SYSTEM-DESIGN) | Architecture (ADR / C4) | Security (OWASP) | Evaluation (golden / metric) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| BR-01 | Upload contracts | TBD | TBD | TBD | TBD | Planned |
| BR-02 | Language tagging | TBD | TBD | TBD | TBD | Planned |
| BR-03 | Clause extraction | TBD | TBD | TBD | TBD | Planned |
| BR-04 | Risk assessment | TBD | TBD | TBD | TBD | Planned |
| BR-05 | Cross-lingual retrieval | TBD | TBD | TBD | TBD | Planned |
| BR-06 | RTL presentation | TBD | TBD | TBD | TBD | Planned |
| BR-07 | Bilingual memo | TBD | TBD | TBD | TBD | Planned |
| BR-08 | Counsel HITL | TBD | TBD | TBD | TBD | Planned |
| BR-09 | Citations / grounding | TBD | TBD | TBD | TBD | Planned |
| BR-10 | Provider ports | TBD | TBD | TBD | TBD | Planned |
| BR-11 | Local fallback | TBD | TBD | TBD | TBD | Planned |
| BR-12 | Audit log | TBD | TBD | TBD | TBD | Planned |
| BR-13 | Golden set eval | TBD | TBD | TBD | TBD | Planned |
| BR-14 | No secrets / PII in git | TBD | TBD | TBD | TBD | Planned |
| BR-15 | SSE progress | TBD | TBD | TBD | TBD | Planned |

---

## 7. Assumptions and constraints

- Assessment corpus is synthetic or public-domain; no live client matters.
- Student/instructor environment may or may not have a hosted API key; local fallback is a design requirement.
- Outputs are assistive drafts. Product copy must not claim to replace a licensed attorney.
