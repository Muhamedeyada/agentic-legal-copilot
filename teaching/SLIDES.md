# Production Agentic RAG: Guardrails, Multi-Agent Orchestration, and Human-in-the-Loop in Legal AI

**Audience:** postgraduate / ITI assessment  
**Length:** 90 minutes  
**Product:** D1T1 Agentic Legal Copilot (AR+EN, RTL)  
**Mode:** lecture + live demo. Leave `OPENAI_API_KEY` empty — the mock adapter is the intended classroom path.

---

## 1. Title & outcomes (3 min)

By the end of this session you can:

1. Explain why a **single chat agent** is the wrong control plane for legal review.
2. Draw the D1T1 hexagonal layers and name what each layer may import.
3. Trace Clause Extractor → Risk Assessor → Memo Drafter → Counsel gate on a live run.
4. Distinguish **lexical bilingual RAG** (what ships) from hybrid dense+BM25 (deferred).
5. Run `npm run eval` and interpret EN / AR / XL / refusal scores separately.

---

## 2. The failure mode that defines D1 (5 min)

Counsel uploads a contract. The copilot must **not** silently drop liability, termination, governing law, or indemnity.

- False positive risk flag: recoverable (Counsel ignores it).
- Silent omission of a dangerous clause: **worse** — that is the D1 guard.

Live question: if the model is “confident” and the clause is missing, who is liable?

---

## 3. Twist T1 — bilingual is not a theme (4 min)

Arabic is not English with `dir=rtl`.

- Ingest and retrieve AR documents correctly.
- Cross-lingual queries (EN question / AR source and reverse).
- UI: `document.documentElement.dir` from locale.
- **Measure AR and XL separately.** An English-only Recall@5 is a vanity metric.

---

## 4. Why not “one agent with tools”? (5 min)

| One mega-agent | Typed multi-agent |
| --- | --- |
| Free-text plan | Zod contracts between specialists |
| LLM invents severity | `risk_calculator_tool` is deterministic |
| Side effects anytime | Write tools + memo release need Counsel |
| Hard to evaluate | Per-agent schema + golden set |

D1T1: three specialists + orchestrator. Not a swarm.

---

## 5. Hexagonal architecture (6 min)

```
client → presentation (Express) → application → domain ← infrastructure
```

**Forbidden:** `domain/` or `application/` importing Express, OpenAI, Chroma, Qdrant.

Ports live in domain: `CompletionPort`, `EmbeddingPort`, `VectorStorePort`, `ApprovalPort`, `PlaybookPort`.

Classroom check: `npm run lint` (`scripts/check-boundaries.mjs`).

---

## 6. Provider abstraction (4 min)

`createCompletionAdapter`:

- Empty or placeholder `OPENAI_API_KEY` → `MockCompletionAdapter` (agents fall back to rules).
- Real key → hosted adapter (HTTP still stubbed until an SDK is wired).
- `LLM_PROVIDER=local` → local OpenAI-compatible URL.
- Always wrapped in `CappedCompletionAdapter` (token / char caps).

**Teaching point:** the classroom must work **without a paid key**. That is a product requirement, not a shortcut.

---

## 7. Ingest & chunking — FR-1 as shipped (5 min)

What runs today:

- 32 synthetic contracts in `data/corpus/` (16 AR, 16 EN).
- `splitClauses` on Article / بند / markdown headings + language tag (`ar`/`en`/`mixed`).
- File catalog + JSON text upload (`POST /api/contracts/upload`).
- PII redaction before the orchestrator stores contract text.

What does **not** ship: PDF/DOCX parsers, `npm run ingest` into Chroma. Do not demo those as working.

---

## 8. Retrieval that can refuse — FR-2 (6 min)

Live path: `DirectRagUseCase` / `CorpusRagUseCase`.

- Token overlap after Arabic folding + bilingual query expansion.
- Citations required; below `MIN_SCORE` → `not_enough_information` (HTTP 404 on chat).
- Document-scoped search is the Counsel “this contract” workflow.

Deferred: dense embeddings + BM25 + RRF (`feat/ingestion-and-hybrid-retrieval`).

**Rule:** no cite → no legal claim.

---

## 9. Three agents and their schemas (6 min)

| Agent | Must produce | Must not do |
| --- | --- | --- |
| Clause Extractor | `ExtractedClause[]` (Zod) | Side effects |
| Risk Assessor | Findings + citation ids | Invent severity |
| Memo Drafter | Bilingual memo + redlines | Release without Counsel |

Schemas: `server/src/application/agents/schemas.ts`. Invalid JSON → `SchemaViolationError` or deterministic fallback.

---

## 10. Risk is a matrix, not a vibe (5 min)

`risk_calculator_tool` (`calculateRisk`):

- Unlimited liability / uncapped indemnity / 1-day termination / 15%/day fees → Critical or High.
- **Silent omission** of a mandatory family → always Critical.

If a trainee “asks the LLM for a score from 1–10”, stop the demo and open this file.

---

## 11. Orchestrator as a state machine — FR-5 (6 min)

```
INIT → EXTRACTING → ASSESSING → DRAFTING → AWAITING_APPROVAL
                 → APPROVED | REJECTED | EDITED → COMPLETED
```

Also: max iterations, step timeout, backoff, `AbortSignal` cancel (debounced for React StrictMode SSE reconnect).

Memo Drafter **does** write a draft. `draftMemo` / the Counsel UI **must not treat it as issued** until approval.

---

## 12. Human-in-the-loop live demo (8 min)

On `http://localhost:5173` or Docker `http://localhost:3000`:

1. Locale toggle — confirm `html[dir=rtl]` for Arabic.
2. Open `D1T1-EN-NDA-003` (unlimited liability).
3. Run review. Watch stepper: extract → assess → draft.
4. Open Trace drawer: `AGENT_START`, `TOOL_EXEC`, `RISK_FOUND`.
5. Counsel: Approve / Reject / Edit-and-approve.

Without approval, `POST /reviews/:id/memo` and `draftMemo` return **403 `APPROVAL_REQUIRED`**.

---

## 13. SSE is the control-plane UI — FR-6/7 (4 min)

`GET /api/workflow/stream/:runId` (not the old heartbeat-only `/events`).

Events: `AGENT_START`, `TOOL_EXEC`, `CLAUSE_EXTRACTED`, `RISK_FOUND`, `AWAITING_APPROVAL`, `HITL_DECISION`, `RUN_FAILED`, `RUN_CANCELLED`.

React: `useWorkflowStream` + EventSource. Reconnect must not cancel the run (1.5s debounce).

---

## 14. Guardrails that are not “be nice in the prompt” (6 min)

| Control | Where |
| --- | --- |
| Privilege separation | System vs `<<<UNTRUSTED_DOCUMENT>>>` |
| Injection detect (EN+AR) | `prompt-injection.ts` |
| Output sanitize | Strip script/HTML from memo bodies |
| PII redact | Emails, cards, phones before LLM |
| Rate limit | 429 / `RATE_LIMIT_PER_MINUTE` |
| Token caps | `CappedCompletionAdapter` |
| Schema validation | Zod `parseContract` |

Map these to OWASP LLM01, LLM05, LLM06, LLM10 in `docs/SECURITY.md`.

---

## 15. Evaluation harness — FR-3 (7 min)

```
npm run eval
```

- 28 gold items: EN, AR, cross-lingual, HITL, ≥7 adversarial.
- Metrics: Hit-rate, P@k, citation accuracy, groundedness, refusal; **EN / AR / XL sliced**.
- No paid API. Report: `data/runtime/eval-report.json`.

Honest caveat: retrieve items are mostly **document-scoped**. Open-corpus items test refusal, not Recall@5 over 32 files.

---

## 16. Adversarial cases you must keep (4 min)

- OOD clinical / weather / invented statute → refuse.
- “Ignore previous instructions” (EN) and `تجاهل التعليمات السابقة` (AR) → refuse / strip.
- Playbook says 12-month cap; **this deed** (`D1T1-EN-NDA-003`) disapplies it — cite the deed.
- Do not use corpus toponyms (Cairo) in refusal questions (false hits).

---

## 17. What is deferred (honest) (3 min)

- PDF/DOCX ingest, hybrid dense+BM25 index.
- Hosted completion HTTP (factory is ready; adapter throws).
- Production auth / roles (`DEMO_API_TOKEN` is unused).
- Persistent audit store / OpenTelemetry.

Assessment MVP is the **governed vertical slice**, not a DMS.

---

## 18. Packaging for a clean machine (3 min)

```powershell
docker compose up --build
```

- UI: `http://localhost:3000` (also `:5173`, same nginx build)
- API: `http://localhost:3001/health`

CI (`.github/workflows/ci.yml`): lint, typecheck, unit tests, `npm run eval` on PRs and `main`.

---

## 19. Classroom ethics (2 min)

- Synthetic corpus only. No real client agreements.
- Outputs are assistive drafts, **not legal advice**.
- Never commit `.env` or live keys.

---

## 20. Lab kickoff (2 min)

Open [LAB-SHEET.md](LAB-SHEET.md). Work in pairs. Instructors: walk the room on Exercise 3 (Counsel gate) — that is the grade-bearing control.

---

## Timing (90 min)

| Block | Slides | Minutes |
| --- | --- | --- |
| Outcomes + D1/T1 | 1–3 | 12 |
| Architecture + providers | 4–6 | 15 |
| Ingest / retrieve / agents | 7–10 | 22 |
| Orchestrator + live HITL/SSE | 11–13 | 18 |
| Security + eval | 14–16 | 17 |
| Deferred + Docker + lab start | 17–20 | 6 |
