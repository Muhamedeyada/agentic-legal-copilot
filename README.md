# Agentic Legal Copilot

ITI Instructor Assessment — **Variant D1T1**: Legal Contract Review & Research with bilingual Arabic + English (RTL and cross-lingual retrieval).

This repository is a governed, human-in-the-loop copilot for counsel: extract clauses, assess contractual risk, retrieve supporting authority in AR/EN, and draft a review memo that **does not ship without Counsel approval**.

**Stack (locked by `.cursorrules`):** Node.js + TypeScript (Express) in hexagonal layers on the server; React + Vite + Tailwind with RTL on the client.

---

## Variant derivation (D1T1)

Assessment identifiers are derived from student numbers (placeholder inputs used for this scaffold):

| Input | Formula | Result | Mapping |
| --- | --- | --- | --- |
| Domain seed `92` | `92 mod 7 = 1` | **D1** | Legal Contract Review & Research |
| Twist seed `49` | `49 mod 8 = 1` | **T1** | Bilingual AR + EN (RTL + cross-lingual retrieval) |

**D1 — Legal Contract Review & Research.** Counsel uploads a contract (or a clause set). The system extracts structured clauses, flags risk, retrieves comparable language and corpus snippets, and produces a grounded review memo with citations.

**T1 — Bilingual AR + EN.** The product must accept, retrieve, and present content in Arabic and English. Arabic UI surfaces are RTL (`dir="rtl"`). Retrieval is cross-lingual: an English query can surface Arabic corpus chunks (and vice versa) without leaking uncited generation.

---

## Core principles

1. **Clean / Hexagonal architecture.** `server/src/domain` and `server/src/application` never import LLM SDKs, vector databases, or Express. Adapters live in `infrastructure`; HTTP and SSE live in `presentation`.
2. **Provider abstraction.** Completions, embeddings, and tool calls go through ports. Hosted API and local fallback are swappable adapters.
3. **Typed multi-agent workflow.** Three agents plus an orchestrator communicate via typed schemas:
   - **Clause Extractor** — structured clause inventory from the source contract.
   - **Risk Assessor** — per-clause / per-theme risk with rationale and citations.
   - **Memo Drafter** — bilingual review memo (Counsel-gated).
4. **Human-in-the-loop.** Side-effecting operations (persist, export, send) and **final memo drafting** require Counsel approval.
5. **Grounded answers.** Claims in the memo must cite retrieved corpus or contract spans. No silent invention of law or facts.
6. **RTL-first client.** React sets `document.documentElement.dir` from locale. Arabic is not an afterthought CSS patch.
7. **No secrets, no raw PII in git.** Conventional Commits. Corpus in this repo is synthetic or public-domain only.

---

## Repository layout

```
server/src/
  domain/            # entities, ports (zero npm framework imports)
  application/       # use cases, DTOs, agent schemas, orchestrator
  infrastructure/    # LLM / vector / approval adapters + config
  presentation/      # Express routes, controllers, SSE
client/src/          # React + Vite + Tailwind, AR/EN locale + RTL
docs/                # BRD, design, architecture, security, eval, AI governance
data/corpus/         # synthetic / public sample contracts (AR + EN)
teaching/            # instructor-facing notes and walkthroughs
```

npm workspaces: `@alc/server` and `@alc/client`, orchestrated from the root `package.json`.

---

## Prerequisites

| Tool | Suggested version | Why |
| --- | --- | --- |
| Node.js | 20+ (see `.nvmrc`) | Runtime for Express and Vite |
| npm | 10+ | Workspaces |
| Git | 2.40+ | Conventional Commits |
| Optional: Docker | latest | Local Qdrant / later services |
| Optional: Ollama (or equivalent) | latest | Local LLM fallback |
| API key for a hosted chat + embedding provider | — | Development path; never commit the real key |

Copy `.env.example` → `.env` before running anything that talks to a provider.

---

## Quick start (scaffold)

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Server (`:3001`) and client (`:5173`) together |
| `npm run dev:server` | Express only |
| `npm run dev:client` | Vite only |
| `npm run typecheck` | `tsc` on both workspaces |

Smoke checks after `npm run dev`:

- `GET http://127.0.0.1:3001/health` → `{ "status": "ok", "variant": "D1T1", ... }`
- `GET http://127.0.0.1:3001/events` → SSE `hello` then `ping`
- `POST http://127.0.0.1:3001/reviews/demo/memo` → **403** `APPROVAL_REQUIRED` while the Counsel gate is on
- Client locale toggle flips `dir="rtl"` / `dir="ltr"`

Agents are **stubs**. Do not expect clause extraction or a real memo yet.

---

## 5-minute demo path

> Placeholder — fill after the MVP vertical slice exists.

| Minute | Action | Expected evidence |
| --- | --- | --- |
| 0:00–0:45 | `npm run dev`; open client; toggle AR/EN | RTL layout; bilingual chrome |
| 0:45–1:30 | Click Check `/health` | `{ status: "ok", variant: "D1T1" }` |
| 1:30–2:15 | Upload a **synthetic** EN contract | Clause Extractor returns typed clause list |
| 2:15–3:00 | Same flow on a **synthetic** AR contract | Clauses + RTL-safe presentation |
| 3:00–3:45 | Cross-lingual question (EN query over AR clause / vice versa) | Retrieved chunks in both languages with citations |
| 3:45–4:30 | Risk Assessor + Counsel gate | Memo **blocked** until approval (`403`) |
| 4:30–5:00 | Approve as Counsel → Memo Drafter | Grounded bilingual memo; SSE progress; audit entry |

Demo contracts must be synthetic. Do not use real client agreements.

---

## Documentation index

| Document | Purpose |
| --- | --- |
| [docs/BRD.md](docs/BRD.md) | Business requirements and traceability |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Target design vs MVP gap |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | C4 views, sequences, ADRs |
| [docs/SECURITY.md](docs/SECURITY.md) | OWASP Web + LLM Top 10 mapping |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Golden set (25 Q/A) and bilingual metrics |
| [docs/AGENTIC-WORKFLOW.md](docs/AGENTIC-WORKFLOW.md) | How this project is built with governed AI |
| [docs/AI-USAGE-LOG.md](docs/AI-USAGE-LOG.md) | Per-session AI usage and decisions |

---

## Teaching notes

Instructor-facing material lives in [`teaching/`](teaching/). Keep walkthroughs aligned with the 5-minute demo and the evaluation golden set.

---

## License / assessment use

Prepared for ITI instructor assessment. Not a substitute for licensed legal advice. Outputs are assistive drafts for Counsel review only.
