# System Design

**Variant:** D1T1  
**Stack:** Express (TypeScript) + React (Vite, RTL)  
**Status:** Draft — Part A is the unconstrained target; Part B is what is actually running

---

## Part A — Target system

### A.1 Purpose

A Node.js API that runs a **typed, orchestrated** review pipeline over bilingual contracts, plus a React client that presents AR/EN with correct `dir`:

```
Contract (AR|EN) → Clause Extractor → Risk Assessor ─┐
        │                                              ├→ Counsel gate → Memo Drafter → Memo (AR+EN)
        └────────── Cross-lingual retriever ───────────┘
                         │
                    SSE progress → React UI
```

### A.2 Logical components

| Component | Layer | Responsibility |
| --- | --- | --- |
| Clause / Risk / Memo types | `server/src/domain` | Canonical types; language tags; citation value objects |
| Ports: `CompletionPort`, `EmbeddingPort`, `VectorStorePort`, `ApprovalPort` | `domain` | Interfaces only — no npm imports |
| Use cases + `ReviewOrchestrator` | `application` | Coordinates three agents via typed schemas |
| Hosted LLM adapter / local LLM adapter | `infrastructure` | Swappable via `LLM_PROVIDER` |
| Vector adapter (Chroma / Qdrant / in-memory) | `infrastructure` | Bilingual embeddings + `lang` metadata |
| Express routers, JSON, SSE | `presentation` | No business rules |
| React locale + RTL shell | `client` | `dir`/`lang`, Counsel-facing chrome |

### A.3 Data flows

1. **Ingest.** Parse file → language detection → chunk → embed → upsert with `lang` metadata.
2. **Extract.** Orchestrator invokes Clause Extractor; validates typed output.
3. **Retrieve.** Query in a multilingual embedding space; return AR and EN hits.
4. **Assess.** Risk Assessor consumes clauses + retrieval hits; emits severity + citations.
5. **Gate.** Memo Drafter **does not run** until `ApprovalPort` confirms Counsel.
6. **Draft.** Memo Drafter produces bilingual memo; client renders AR with `dir="rtl"`.
7. **Stream.** Presentation emits SSE events (`extract`, `assess`, `awaiting_approval`, `drafted`).

### A.4 Cross-lingual retrieval (T1)

Target approach (to be confirmed in an ADR):

- Store chunks with `lang=ar|en` and original text.
- Embed with a multilingual model (or dual encode).
- Query once; UI shows **both** languages.
- Never translate silently in the retrieval path without labeling the translation as generated.

### A.5 Failure and fallback

| Failure | Target behavior |
| --- | --- |
| Hosted LLM down | Factory selects local completion adapter; log `providerId` |
| Embedding mismatch | Refuse mixed-index queries; rebuild index rather than mix spaces |
| Uncited legal assertion | Validator rejects memo; return typed error |
| Missing Counsel approval | HTTP 403 `APPROVAL_REQUIRED` — no draft persisted |

---

## Part B — MVP gap table

Fill **Current MVP** as implementation lands. **Gap** is Target minus MVP. **Phase** is when the gap closes.

| ID | Capability (from Part A / BR) | Target | Current MVP | Gap | Phase |
| --- | --- | --- | --- | --- | --- |
| G-01 | Hexagonal TypeScript packages | Four layers + ports | Folders, entities, ports, stub orchestrator | Agents not implemented | Next: agent schemas + fakes |
| G-02 | Express app + health | Locale-aware `/health` | Implemented | Auth later | Done |
| G-03 | SSE endpoint | Agent progress events | Heartbeat `/events` only | Real event types | MVP-1 |
| G-04 | Counsel memo gate | 403 until approval | `POST /reviews/:id/memo` uses `ApprovalPort` | Persist approvals; UI button | MVP-1 |
| G-05 | React RTL shell | AR/EN toggle, `dir` | Locale provider + bilingual copy | Review workspace UI | MVP-1 |
| G-06 | Document ingest + parse | PDF/DOCX/TXT, MIME limits | Not started | Parsers + validation | MVP-1 |
| G-07 | Language detection | Per doc / clause `ar\|en\|mixed` | Types only | Detector port + adapter | MVP-1 |
| G-08 | Clause Extractor agent | Typed schema, validated | Throws `not implemented` | Agent + schema runtime | MVP-1 |
| G-09 | Vector index + multilingual embed | AR+EN chunks | In-memory stub throws | Store adapter + corpus load | MVP-1 |
| G-10 | Cross-lingual retrieve | EN query → AR hits and reverse | Not started | Retriever use case | MVP-2 |
| G-11 | Risk Assessor agent | Severity + citations | Stub | Agent + eval | MVP-2 |
| G-12 | Memo Drafter agent | Bilingual memo, RTL-safe | Stub (blocked by HITL) | Agent + templates | MVP-3 |
| G-13 | Provider swap + local fallback | Hosted / local adapters | Factory + stubs (no HTTP yet) | Wire SDKs | MVP-3 |
| G-14 | Audit log | Redacted agent I/O + approvals | Docs only | Persistence + API | MVP-3 |
| G-15 | Golden set runner | 25 Q/A, bilingual metrics | Template in `EVALUATION.md` | Harness + fixtures | MVP-3 |
| G-16 | 5-minute demo path | Scripted demo in README | Health + RTL + 403 only | Working vertical slice | MVP-3 |

### Suggested MVP slice (first vertical)

1. Ingest one EN and one AR **synthetic** TXT contract.
2. Extract clauses (even if heuristic + LLM).
3. Retrieve one bilingual hit.
4. Block memo without approval; allow after approval; stream SSE.

Everything else is incrementally added against this table — do not skip the gate.
