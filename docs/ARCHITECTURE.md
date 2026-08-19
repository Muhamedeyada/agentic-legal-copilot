# Architecture

**Style:** Strict Clean / Hexagonal (ports & adapters)  
**Runtime (target):** Node.js 20+, Express, React + Vite  
**Variant:** D1T1

Inner layers (`server/src/domain`, `server/src/application`) **must never** depend on LLM SDKs, vector databases, or web frameworks. See `.cursorrules`.

---

## 1. C4 — Context (Level 1)

```mermaid
C4Context
  title D1T1 Agentic Legal Copilot — System Context
  Person(counsel, "Counsel", "Approves memos; reviews risk")
  Person(paralegal, "Paralegal", "Uploads contracts; runs retrieval")
  System(copilot, "Agentic Legal Copilot", "Clause extract, risk, bilingual retrieve, gated memo")
  System_Ext(llm, "LLM Provider", "Hosted or local completions/embeddings")
  System_Ext(vdb, "Vector Store", "Chunk index with lang metadata")
  Rel(counsel, copilot, "HTTPS — review, approve, export")
  Rel(paralegal, copilot, "HTTPS — upload, query")
  Rel(copilot, llm, "Completions & embeddings via ports")
  Rel(copilot, vdb, "Upsert / query via ports")
```

**Placeholder:** Replace this sketch with a reviewed Context diagram (PNG or updated Mermaid) before the assessment demo.

---

## 2. C4 — Container (Level 2)

```mermaid
C4Container
  title D1T1 — Containers
  Person(counsel, "Counsel")
  Container(web, "React SPA", "Vite + Tailwind", "RTL locale shell")
  Container(api, "Express app", "Node.js / TS", "presentation: JSON + SSE")
  Container(app, "Application services", "TypeScript", "use cases + orchestrator")
  Container(domain, "Domain model", "TypeScript", "entities, ports — no npm frameworks")
  ContainerDb(db, "App DB", "SQLite/Postgres", "approvals, audit")
  ContainerDb(idx, "Vector index", "Chroma/Qdrant", "AR+EN chunks")
  Container(llm_adapt, "LLM adapters", "TypeScript", "hosted + local")
  Rel(counsel, web, "HTTPS")
  Rel(web, api, "JSON / SSE")
  Rel(api, app, "commands / queries")
  Rel(app, domain, "uses")
  Rel(app, llm_adapt, "CompletionPort / EmbeddingPort")
  Rel(app, idx, "VectorStorePort")
  Rel(app, db, "ApprovalPort / AuditPort")
```

**Placeholder:** Add a Container diagram that names real adapters once they exist.

---

## 3. C4 — Component (Level 3)

```mermaid
flowchart LR
  subgraph client [React]
    UI[Locale + RTL shell]
  end
  subgraph presentation [Express]
    R[Routers]
    SSE[SSE /events]
  end
  subgraph application
    O[Orchestrator]
    UC[Use cases]
  end
  subgraph agents
    CE[Clause Extractor]
    RA[Risk Assessor]
    MD[Memo Drafter]
  end
  subgraph domain
    P[Ports]
    E[Entities]
  end
  subgraph infrastructure
    A1[Hosted LLM]
    A2[Local LLM]
    VS[Vector adapter]
    AP[Approval adapter]
  end
  UI --> R
  UI --> SSE
  R --> UC
  UC --> O
  O --> CE
  O --> RA
  O --> MD
  CE --> P
  RA --> P
  MD --> P
  P --> A1
  P --> A2
  P --> VS
  P --> AP
  UC --> E
```

**Placeholder:** Component diagram should show **typed schemas** on each agent boundary (see `server/src/application/agents/schemas.ts`).

---

## 4. Sequence — Counsel-gated memo (target)

```mermaid
sequenceDiagram
  actor Counsel
  participant UI as React client
  participant API as Express presentation
  participant Orch as ReviewOrchestrator
  participant Gate as ApprovalPort
  participant Memo as Memo Drafter

  Counsel->>UI: Request memo
  UI->>API: POST /reviews/{id}/memo
  API->>Orch: draftMemo()
  Orch->>Gate: isApproved(id)
  alt not approved
    Gate-->>Orch: false
    Orch-->>API: ApprovalRequiredError
    API-->>UI: 403 APPROVAL_REQUIRED
  else approved
    Gate-->>Orch: true
    Orch->>Memo: typed input
    Memo-->>Orch: ReviewMemo + citations
    Orch-->>API: MemoDrafterOutput
    API-->>UI: 200 JSON
  end
```

**Placeholder:** Add extract/assess sequences when those routes exist. Scaffold today: memo route always 403 until an approval adapter records the review id (in-memory, empty on boot).

---

## 5. C4 — Code (Level 4)

**Placeholder.** After the first vertical slice, document `draftMemo` end-to-end:

- `presentation` DTO → `application` command
- `ApprovalPort.isApproved()`
- Memo Drafter input/output schema
- `CompletionPort.complete()`
- citation validator in `domain`

Link to source files here when they exist. Current entrypoints:

- `server/src/main.ts`
- `server/src/presentation/http/app.ts`
- `server/src/application/orchestrator.ts`
- `server/src/domain/ports/*.ts`

---

## 6. Architecture Decision Records

Keep ADRs short: context, decision, consequences. Four records are required for this assessment.

### ADR-0001 — Hexagonal architecture with Express at the edge

| Field | Content |
| --- | --- |
| Status | Proposed |
| Context | Assessment requires Clean/Hexagonal architecture; Express is the HTTP framework; React is a separate SPA. |
| Decision | Domain and application contain no Express/LLM/vector imports. Express lives only in `server/src/presentation`. React lives only in `client/`. |
| Consequences | Slightly more types/ports early; use cases testable without spinning HTTP. |

### ADR-0002 — Provider abstraction for completions, embeddings, and tools

| Field | Content |
| --- | --- |
| Status | Proposed |
| Context | Hosted APIs may be unavailable; models will change. |
| Decision | `CompletionPort`, `EmbeddingPort`, and (later) tool ports in domain; hosted and local adapters in infrastructure, selected by `LLM_PROVIDER`. |
| Consequences | Factory in infrastructure; domain tests use fakes. |

### ADR-0003 — Three typed agents plus orchestrator; Counsel HITL on side effects and memo

| Field | Content |
| --- | --- |
| Status | Proposed |
| Context | Unbounded “one agent with tools” is hard to evaluate and easy to over-act. |
| Decision | Clause Extractor, Risk Assessor, Memo Drafter, coordinated by `ReviewOrchestrator` via typed schemas. Memo drafting and side effects require Counsel approval (`ApprovalRequiredError` → HTTP 403). |
| Consequences | More hops per review; clear eval surfaces per agent; no silent exports. |

### ADR-0004 — Bilingual AR+EN with RTL presentation and cross-lingual retrieval

| Field | Content |
| --- | --- |
| Status | Proposed |
| Context | Twist T1. Monolingual RAG fails Counsel who work in both languages. |
| Decision | Tag every chunk and clause with `language`. Use a multilingual embedding space (or dual encode). The React app sets `dir="rtl"` for `ar`. Translations are labeled, never silently substituted for source text. |
| Consequences | Need bilingual golden set and RTL checks; embedding model choice is coupled to the index. |

---

## 7. Dependency rule (enforcement)

```
client → presentation → application → domain ← infrastructure
```

Forbidden:

- `server/src/domain/**` importing `express`, `openai`, vector clients, etc.
- `server/src/application/**` doing the same.

**Placeholder:** Add `dependency-cruiser` or an ESLint boundary rule in a later step.
