# Agentic Legal Copilot

ITI Instructor Assessment — **D1T1**: legal contract review and research, Arabic and English (RTL and cross-lingual retrieval).

Counsel selects or uploads a contract. The copilot extracts clauses, flags risk against a playbook, retrieves supporting chunks in AR/EN, and drafts a memo. The memo is **not issued** until Counsel approves it.

**Stack:** Node.js and TypeScript (Express) on the server, hexagonal layers. React, Vite and Tailwind on the client, with RTL for Arabic.

This is an assistive draft for Counsel. It is **not legal advice**.

---

## Variant derivation (D1T1)

From the assessment rule: Domain = (last two National ID digits) mod 7, Twist = (sum of all digits) mod 8.

| Input | Formula | Result | Mapping |
| --- | --- | --- | --- |
| Last two digits `92` | `92 mod 7 = 1` | **D1** | Legal — contract review and research |
| Digit sum `49` | `49 mod 8 = 1` | **T1** | Bilingual AR + EN (RTL, cross-lingual retrieval) |

**D1.** Upload/select → segment clauses → compare to playbook → flag deviations (silent omission of liability / termination / jurisdiction / indemnity is Critical) → draft redline and risk memo. Agents: Clause Extractor, Risk Assessor, Memo Drafter. Counsel approves the memo.

**T1.** Arabic documents ingest and retrieve. Queries work across languages. The UI is RTL for Arabic. Retrieval quality for Arabic and cross-lingual items is measured on its own (`npm run eval`).

---

## Design rules

1. `server/src/domain` and `server/src/application` do not import LLM SDKs, vector clients, or Express (`npm run lint`).
2. Completions go through `CompletionPort`. Empty or placeholder `OPENAI_API_KEY` selects the **mock** adapter (deterministic agent fallbacks). No paid key is required to demo.
3. The three agents plus orchestrator use Zod schemas. Risk **severity is never LLM-scored** (`risk_calculator_tool`).
4. Side effects and **issuing** the memo require Counsel approval (HTTP 403 `APPROVAL_REQUIRED`).
5. Claims cite a chunk. If overlap is too weak, RAG refuses (`not_enough_information`).
6. The client sets `document.documentElement.dir` from the locale.
7. Conventional Commits. No secrets and no real personal data in git. Corpus is synthetic.

---

## Architecture (as shipped)

```
client (Vite :5173 / Docker nginx :3000)
  → presentation/  Express JSON + SSE
    → application/ orchestrator, 3 agents, DirectRag, HITL
      → domain/    entities, ports, chunker, bilingual retrieve helpers
    ← infrastructure/  mock/hosted/local completion, file catalog, in-memory stores
```

**Honest limits:** hosted completion and vector adapters are ports with stubs (they throw if selected). Live retrieval is **lexical** (token overlap + bilingual expansion), not hybrid dense+BM25. Uploads are **plain text** (the UI reads `file.text()`). Auth (`DEMO_API_TOKEN`) is not enforced.

---

## Layout

```
server/src/domain|application|infrastructure|presentation|evaluation
client/src/          # review workstation, AR/EN, RTL
docs/                # BRD, design, architecture, security, evaluation, AI log
data/corpus/         # 32 synthetic AR/EN contracts + corpus_manifest.json
teaching/            # slides, lab sheet, trainee mistakes
```

Root `package.json` is an npm workspace (`client`, `server`).

---

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20+ (`.nvmrc`) |
| npm | 10+ |
| Git | 2.40+ |
| Docker | optional — `docker compose up` |
| Hosted API key | optional; **leave empty** for classroom / CI |

Copy `.env.example` to `.env` only if you run locally. Never commit `.env`.

---

## Quick start

### Local (hot reload)

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

- UI: [http://localhost:5173](http://localhost:5173) (Vite proxies `/api` → `:3001`)
- API: [http://localhost:3001/health](http://localhost:3001/health)

### Docker (clean machine)

```powershell
docker compose up --build
```

| Port | Service |
| --- | --- |
| **3000** | nginx SPA (same-origin `/api` proxy) |
| **3001** | Express API |
| **5173** | Same SPA as 3000 (compose maps both to nginx) |

Leave `OPENAI_API_KEY` unset in compose — mock mode.

---

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | API `:3001` and Vite `:5173` |
| `npm run dev:server` / `dev:client` | One side only |
| `npm run lint` | Hexagonal import boundaries |
| `npm run typecheck` | `tsc` on server and client |
| `npm run test` | Server unit tests |
| `npm run eval` | FR-3 golden set (no paid API) |
| `npm run corpus:generate` | Regenerate synthetic `data/corpus/` |
| `npm run build` / `start` | Compile; `node server/dist/main.js` |

There is **no** `npm run ingest` on this tree. Hybrid index work lives on `feat/ingestion-and-hybrid-retrieval` and is not merged.

---

## Environment variables (what the process actually reads)

From `server/src/infrastructure/config.ts` and the Vite client:

| Variable | Role |
| --- | --- |
| `PORT` / `HOST` | API bind (Docker must use `HOST=0.0.0.0`) |
| `CLIENT_ORIGIN` | CORS; comma-separated (`http://localhost:5173,http://localhost:3000`) |
| `LLM_PROVIDER` | `openai` (default) or `local` |
| `OPENAI_API_KEY` | Empty / `sk-your-…` → mock adapter |
| `OPENAI_BASE_URL` / `OPENAI_CHAT_MODEL` | Hosted (adapter not wired to HTTP yet) |
| `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL` | Local provider |
| `REQUIRE_COUNSEL_APPROVAL` | Default `true` |
| `DEFAULT_LOCALE` | `en` \| `ar` |
| `CORPUS_DIR` | Override corpus path |
| `RATE_LIMIT_PER_MINUTE` | HTTP 429 |
| `MAX_PROMPT_CHARS` / `MAX_COMPLETION_CHARS` | Completion caps |
| `MAX_UPLOAD_CHARS` | HTTP 413 |
| `VITE_API_URL` | Client API prefix; **empty** under Docker nginx |
| `VITE_DEFAULT_LOCALE` | First paint locale |

`.env.example` also lists embedding / Chroma / Qdrant / `DEMO_API_TOKEN` placeholders for a later phase. **This process does not start those services.**

---

## HTTP surface (working)

| Method | Path | |
| --- | --- | --- |
| `GET` | `/health`, `/api/health` | `{ status, variant: "D1T1" }` |
| `GET` | `/api/contracts` | Corpus + uploads |
| `GET` | `/api/contracts/:id` | Full text |
| `POST` | `/api/contracts/upload` | JSON `{ title, language, text }` |
| `POST` | `/api/chat` | Lexical RAG; 404 if refuse |
| `POST` | `/api/workflow/run` | `{ runId }` immediately |
| `GET` | `/api/workflow/stream/:runId` | SSE agent events |
| `POST` | `/api/workflow/:runId/approve\|reject\|edit-and-approve\|cancel` | HITL |
| `POST` | `/reviews/:id/memo` | **403** until Counsel approves |
| `GET` | `/events` | Legacy SSE heartbeat only |

---

## 5-minute demo path

Synthetic contracts only.

1. `npm run dev` or `docker compose up --build`.
2. Open the UI. Toggle AR/EN — `html` `dir` flips to `rtl` / `ltr`.
3. Select **`D1T1-EN-NDA-003`** (unlimited liability). Click **Run review**.
4. Watch the stepper and open **Trace** (`AGENT_START`, `TOOL_EXEC`, `RISK_FOUND`). Expect a **Critical** liability finding.
5. Open a risk or redline card (**Compare with playbook**). Confirm category, similarity %, and the side-by-side contract vs golden clause. **Apply playbook clause** inserts fallback text into the Counsel memo draft; **Copy reference text** shows a toast.
6. Filter clauses (**All** / **Critical risks** / **Missing clauses**). **Print / Save PDF** for a formal memo layout (signature line). Markdown **Export** stays disabled until Approve.
7. Before Approve, `POST /reviews/{runId}/memo` → **403** `APPROVAL_REQUIRED`.
8. Counsel **Approve**. Snapshot moves to `COMPLETED`.
9. Optional: select `D1T1-AR-SLA-002`, ask in English “What is the termination notice period?” — citation should include `يوم تقويمي واحد`.
10. `npm run eval` — EN / AR / XL printed separately; adversarial refusals pass.

Do not demo on real client agreements.

---

## Docs

| File | |
| --- | --- |
| [docs/BRD.md](docs/BRD.md) | Requirements and traceability |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Target vs shipped MVP |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | C4, sequences, ADRs |
| [docs/SECURITY.md](docs/SECURITY.md) | OWASP Web and LLM |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Golden set and bilingual metrics |
| [docs/AGENTIC-WORKFLOW.md](docs/AGENTIC-WORKFLOW.md) | Agents and repo rules |
| [docs/AI-USAGE-LOG.md](docs/AI-USAGE-LOG.md) | Where a coding assistant was used |

Teaching pack: [`teaching/`](teaching/) — [slides](teaching/SLIDES.md), [lab](teaching/LAB-SHEET.md), [mistakes](teaching/TRAINEE-MISTAKES.md).
