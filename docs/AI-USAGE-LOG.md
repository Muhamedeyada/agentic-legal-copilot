# AI usage log

Required by the assessment. Notes on where a coding assistant was used, what I kept, and what I still have to verify. No secrets or real contracts in this file.

## How I log

Date, milestone, what I asked for, what I changed after review, open risks.

---

## 2026-08-19 — Scaffolding

I set the variant to D1T1 from the National ID derivation in the README. Stack is Node.js / Express (TypeScript) and React, hexagonal layers, Counsel approval before any **issued** memo.

A coding assistant helped with the first folder layout, npm workspaces, and first-pass markdown. I kept:

- domain ports with no Express or SDK imports
- memo path returning 403 until approval
- AR/EN toggle setting `dir` on `html`

I did not keep a Python layout.

**Open then:** agents and retrieval not built. Those docs were later refreshed (do not treat the 19 Aug README claims as current).

---

## 2026-08-19 — Corpus (ingest content, not hybrid index)

I asked for a synthetic bilingual legal corpus (≥30 files, high-risk fixtures). I kept `scripts/generate_corpus.ts` and `data/corpus/` (32 markdown files, 16 AR / 16 EN, five intentional playbook deviations). No real personal data.

**Reviewed:** risk flags on NDA-003, AR-SLA-002, SAAS-001, AR-MSA-003, EMP-002.

---

## 2026-08-19 — Agents + HITL

I asked for three typed agents, an orchestrator state machine, and Counsel approve/reject/edit. I kept:

- Zod schemas and `parseContract`
- `risk_calculator_tool` as the only severity source
- silent-omission → Critical
- `ApprovalRequiredError` on `draftMemo`

The assistant first drafted LLM-heavy extractors; I kept **deterministic fallbacks** so the classroom works without a key. Mock adapter throws; agents catch.

---

## 2026-08-19 — UI / SSE

I asked for REST + SSE and a bilingual review workstation. I kept enqueue + `GET /api/workflow/stream/:runId`, cancel debounce for React StrictMode, and the Counsel / trace / RAG panels.

**Reviewed:** snapshot types after `noUncheckedIndexedAccess` failures; EventSource reconnect must not abort the run.

---

## 2026-08-22 — Evaluation + security

I asked for FR-3 (≥25 gold items) and Section 5 controls. I kept:

- `data/evaluation_golden_set.json` (28 items)
- `npm run eval` (lexical `CorpusRagUseCase`, no paid API)
- EN/AR/XL slices in the report
- prompt isolation, output sanitize, PII redact, rate limit, token caps

I **rejected** Jaccard-on-long-clauses as the retrieve score (it zeroed Arabic). I kept query coverage + bilingual expansion after XL sat at 20%. I moved an OOD question off “Cairo” after false hits on venue names.

Merge conflicts with PR #6 (UI) were real overlaps on `app.ts` / `orchestrator.ts` / `config.ts` — I kept SSE **and** PII/rate-limit, not a squash of one side.

---

## 2026-08-23 — Packaging, teaching, doc sync

I asked for Docker/CI, a teaching pack, and docs that match the running system.

I kept:

- multi-stage `server/Dockerfile` + `client/Dockerfile`, `docker-compose.yml` (`3000` / `3001` / `5173`)
- `.github/workflows/ci.yml` — lint, typecheck, test, eval
- `teaching/SLIDES.md`, `LAB-SHEET.md`, `TRAINEE-MISTAKES.md`
- rewritten README, BRD traceability, SYSTEM-DESIGN gap table, this log

I did **not** claim `npm run ingest` or hybrid RRF as shipped. I did not invent production auth.

**Still to verify by a human:** `docker compose up --build` on a machine that has Docker Desktop; GitHub Actions on the first PR after this commit; lecture timing on a live cohort.

---

## What I still own (not the assistant)

- Variant math and the D1 silent-omission rule
- Saying “no” to real client contracts in git
- Checking hexagonal imports on every change (`npm run lint`)
- Re-running `npm run eval` after any retrieve or gold-set edit
