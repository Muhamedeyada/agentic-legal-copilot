# System Design

**Variant:** D1T1  
**Stack:** Express (TypeScript) + React (Vite, RTL)  
**Status:** Part A is the unconstrained target; Part B is what **actually runs** on `main` (2026-08-23)

---

## Part A — Target system

### A.1 Purpose

A Node.js API that runs a **typed, orchestrated** review pipeline over bilingual contracts, plus a React client that presents AR/EN with correct `dir`:

```
Contract (AR|EN) → Clause Extractor → Risk Assessor ─┐
        │                                              ├→ pending memo → Counsel gate → issued memo
        └────────── Cross-lingual retriever ───────────┘
                         │
                    SSE progress → React UI
```

### A.2 Logical components

| Component | Layer | Responsibility |
| --- | --- | --- |
| Clause / Risk / Memo types | `server/src/domain` | Canonical types; language tags; citation value objects |
| Ports: `CompletionPort`, `EmbeddingPort`, `VectorStorePort`, `ApprovalPort` | `domain` | Interfaces only — no npm imports |
| Use cases + `LegalWorkflowOrchestrator` | `application` | Coordinates three agents via typed schemas |
| Hosted LLM adapter / local / mock | `infrastructure` | Swappable via `LLM_PROVIDER` + key presence |
| Vector adapter (Chroma / Qdrant / in-memory) | `infrastructure` | Target: bilingual embeddings + `lang` metadata |
| Express routers, JSON, SSE | `presentation` | No business rules |
| React locale + RTL workstation | `client` | `dir`/`lang`, Counsel-facing chrome |

### A.3 Data flows (target)

1. **Ingest.** Parse file → language detection → chunk → embed → upsert with `lang` metadata.
2. **Extract.** Orchestrator invokes Clause Extractor; validates typed output.
3. **Retrieve.** Query in a multilingual embedding space; return AR and EN hits.
4. **Assess.** Risk Assessor consumes clauses + retrieval hits; severity from a **matrix**, not the LLM.
5. **Draft.** Memo Drafter writes a **pending** bilingual memo (citations required).
6. **Gate.** Counsel approve / reject / edit-and-approve. `draftMemo` is 403 until then.
7. **Stream.** Presentation emits SSE (`AGENT_START`, `RISK_FOUND`, `AWAITING_APPROVAL`, …).

### A.4 Cross-lingual retrieval (T1)

Target: multilingual embeddings (or dual encode), `lang` metadata, never silent translation.

**Shipped substitute:** lexical query coverage + `expandBilingualQuery` + Arabic stemming. Good enough for the golden set when `contract_id` is scoped; weaker for open-corpus Recall@5.

### A.5 Failure and fallback

| Failure | Target / shipped behavior |
| --- | --- |
| Hosted LLM down or no key | Factory selects **mock**; agents catch and use deterministic extract/draft |
| Embedding mismatch | Target: refuse mixed indexes. Shipped: no embedding index |
| Uncited legal assertion | RAG refuses below min score; eval checks term overlap |
| Missing Counsel approval | HTTP 403 `APPROVAL_REQUIRED` |

---

## Part B — MVP gap table (honest)

| ID | Capability | Target | Current MVP | Gap / trade-off | Effort to close at scale | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| G-01 | Hexagonal packages | Four layers + ports | Domain, application, infra, presentation; `npm run lint` | None for assessment | — | **Done** |
| G-02 | Express + health | Locale-aware `/health` | `/health` and `/api/health` | Auth later | 1–2 d token middleware | **Done** |
| G-03 | SSE agent events | Typed progress | `/api/workflow/stream/:runId` + event bus | Legacy `/events` is heartbeat only | — | **Done** |
| G-04 | Counsel memo gate | 403 until approval | Orchestrator + UI CounselGate + G-20 | In-memory approvals die on process restart | 3–5 d persist `ApprovalPort` | **Done** (process lifetime) |
| G-05 | React RTL workstation | AR/EN, `dir`, review UX | Full workstation (stepper, risk, chat, traces) | No mobile-first polish | 1–2 w design QA | **Done** |
| G-06 | Document ingest | PDF/DOCX/TXT, MIME | Markdown corpus + JSON text upload + char cap | No PDF/DOCX. Trade-off: smaller supply chain for the demo | 1–2 w parsers + malware scanning | **Partial** |
| G-07 | Language detection | Per doc / clause | Script-count + filename `-AR-`/`-EN-` | Weak on mixed legal French/AR | 3–5 d detector port + CLD3 | **Partial** |
| G-08 | Clause Extractor | Typed schema | Agent + Zod + heading fallback | LLM path unused without a live adapter | 2–3 d wire hosted JSON mode | **Done** |
| G-09 | Vector index | Multilingual embed | Port + in-memory stub **throws** | Lexical catalog instead. Trade-off: no ANN recall | 1–2 w local embeddings + persist | **Open** |
| G-10 | Cross-lingual retrieve | EN↔AR dense | Lexical + glossary + stemming; eval XL 100% scoped | Open-corpus XL still brittle | 2–3 w hybrid RRF (branch exists) | **Partial** |
| G-11 | Risk Assessor | Severity + citations | Matrix tool + omission Critical | Flags are keyword/`detectRiskFlags`, not NLU | 1–2 w richer feature extractors | **Done** |
| G-12 | Memo Drafter | Bilingual, RTL-safe | Template + optional LLM; sanitize | Quality depends on findings, not prose model | 1 w counsel-editable templates | **Done** |
| G-13 | Provider swap | Hosted / local | Factory + mock + cap; hosted/local **throw** if used | Classroom works; production chat does not | 2–4 d OpenAI-compatible fetch | **Partial** |
| G-14 | Audit log | Redacted durable log | `run.traces` + SSE + Trace drawer | Lost on restart; not redacted for every field | 1 w SQLite + redaction policy | **Partial** |
| G-15 | Golden set | ≥25 Q/A, bilingual | 28 items, `npm run eval`, JSON report | Document-scoped hit-rate ≠ production Recall@5 | Ongoing gold maintenance | **Done** |
| G-16 | 5-minute demo | Scripted in README | UI + HITL + eval + Docker | README was stale; now matches code | — | **Done** |
| G-17 | Packaging / CI | Compose + PR checks | `Dockerfile`s, compose, `.github/workflows/ci.yml` | No image scan / SBOM yet | 2–3 d Trivy in CI | **Done** (MVP) |
| G-18 | Auth / roles | Paralegal vs Counsel | None (`DEMO_API_TOKEN` unused) | Anyone who can hit the API is Counsel | 1–2 w IdP + RBAC | **Open** |

### Cost / effort notes (scale, not this repo)

| Increment | People-weeks (indicative) | Recurring cost |
| --- | --- | --- |
| Wire hosted chat + embeddings | 1–2 | Token spend; cap already in config |
| Hybrid retrieve in prod (Qdrant + BM25) | 3–5 | Vector hosting + re-index jobs |
| PDF/DOCX + OCR | 2–4 | CPU; malware scanning |
| Durable audit + SSO | 3–6 | IdP contract |
| Keep AR retrieval honest | Ongoing | Gold-set refresh each corpus change |

**Trade-off we accepted:** ship a **governed, demoable, key-free** vertical slice (agents + HITL + lexical T1 + eval + Docker) instead of an incomplete hybrid stack that fails in the classroom when Docker Desktop or an API bill is missing.

---

## Suggested next vertical (after assessment)

1. Merge or reimplement hybrid ingest from `feat/ingestion-and-hybrid-retrieval` with **local** embeddings by default.
2. Persist runs and approvals.
3. Enforce `DEMO_API_TOKEN` (then replace it).
