# Agentic Legal Copilot

ITI Instructor Assessment — **D1T1**: legal contract review and research, Arabic and English (RTL and cross-lingual retrieval).

Counsel uploads a contract. The copilot extracts clauses, flags risk against a playbook, retrieves supporting chunks in AR/EN, and drafts a memo. The memo is not issued until Counsel approves it.

**Stack:** Node.js and TypeScript (Express) on the server, hexagonal layers. React, Vite and Tailwind on the client, with RTL for Arabic.

---

## Variant derivation (D1T1)

From the assessment rule: Domain = (last two National ID digits) mod 7, Twist = (sum of all digits) mod 8.

| Input | Formula | Result | Mapping |
| --- | --- | --- | --- |
| Last two digits `92` | `92 mod 7 = 1` | **D1** | Legal — contract review and research |
| Digit sum `49` | `49 mod 8 = 1` | **T1** | Bilingual AR + EN (RTL, cross-lingual retrieval) |

**D1.** Upload → segment clauses → compare to playbook → flag deviations → draft redline and risk memo. Agents: Clause Extractor, Risk Assessor, Memo Drafter. Counsel approves the memo. The failure mode to guard is silent omission of a dangerous clause.

**T1.** Arabic documents must ingest and retrieve correctly. Queries work across languages. The UI is RTL for Arabic. Retrieval quality for Arabic is measured on its own, not mixed into an English-only score.

---

## Design rules

1. `server/src/domain` and `server/src/application` do not import LLM SDKs, vector clients, or Express.
2. Completions and embeddings go through ports. Hosted and local adapters are selected by config.
3. The three agents plus orchestrator use typed schemas.
4. Side effects and final memo drafting require Counsel approval.
5. Claims in answers and memos cite a chunk. If the corpus is not enough, the system refuses.
6. The client sets `document.documentElement.dir` from the locale.
7. Conventional Commits. No secrets and no real personal data in git. Corpus is synthetic or public.

---

## Layout

```
server/src/
  domain/            # entities, ports
  application/       # use cases, DTOs, agent schemas, orchestrator
  infrastructure/    # adapters and config
  presentation/      # Express routes, SSE
client/src/          # React UI, AR/EN, RTL
docs/
data/corpus/         # 32 synthetic AR/EN contracts + corpus_manifest.json
teaching/
```

Root `package.json` is an npm workspace (`client`, `server`).

---

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20+ (`.nvmrc`) |
| npm | 10+ |
| Git | 2.40+ |
| Docker | optional, for later services |
| Ollama or similar | optional, local model |
| Hosted API key | optional; never commit it |

Copy `.env.example` to `.env` before calling a provider.

---

## Quick start

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

| Script | |
| --- | --- |
| `npm run dev` | API `:3001` and UI `:5173` |
| `npm run dev:server` | API only |
| `npm run dev:client` | UI only |
| `npm run typecheck` | `tsc` on both packages |

What works today:

- `GET /health` — `{ "status": "ok", "variant": "D1T1" }`
- `GET /events` — SSE heartbeat
- `POST /reviews/:id/memo` — **403** `APPROVAL_REQUIRED` if Counsel has not approved
- Locale toggle — `dir="rtl"` / `dir="ltr"`

Clause extraction, retrieval, and memo text are not implemented yet.

---

## 5-minute demo path

Update this table when the vertical slice is real. Current script:

1. `npm run dev` — open the UI, switch AR/EN, confirm RTL.
2. Check `/health`.
3. `POST /reviews/demo/memo` — expect 403 until approval exists.

Later: ingest one synthetic EN contract and one AR contract, a cross-lingual question with citations, risk flags, Counsel approve/reject/edit, then the memo.

Do not demo on real client agreements.

---

## Docs

| File | |
| --- | --- |
| [docs/BRD.md](docs/BRD.md) | Requirements and traceability |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Target vs MVP gap |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | C4, sequences, ADRs |
| [docs/SECURITY.md](docs/SECURITY.md) | OWASP Web and LLM |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Golden set and bilingual metrics |
| [docs/AGENTIC-WORKFLOW.md](docs/AGENTIC-WORKFLOW.md) | Agents and repo rules |
| [docs/AI-USAGE-LOG.md](docs/AI-USAGE-LOG.md) | Where a coding assistant was used |

Teaching material: [`teaching/`](teaching/).

This is an assistive draft for Counsel. It is not legal advice.
