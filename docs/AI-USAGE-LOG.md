# AI usage log

Log **each session** that used an AI assistant (Cursor, hosted models, etc.). Record intent, what was generated, what you accepted, and decisions a reviewer cannot see from git alone.

Do not paste secrets, API keys, or real contract text into this file.

---

## Entry template

```
### YYYY-MM-DD — <short title>
- Tool / model:
- Operator:
- Intent:
- Actions:
- Decisions:
- Accepted as-is vs edited:
- Files touched:
- Risks / follow-ups:
```

---

## Entries

### 2026-08-19 — Initial D1T1 scaffold (Node.js + React, hexagonal)

- **Tool / model:** Cursor Grok 4.6 (agent mode), operating against `.cursorrules`
- **Operator:** Project student (local workspace `agentic-legal-copilot`)
- **Intent:** Scaffold folders, npm workspaces, hexagonal Express/TS backend, React RTL client, and assessment documentation. No live LLM calls.
- **Actions:**
  - Removed the earlier Python `src/` layout so the repo matches the TypeScript stack in `.cursorrules`
  - Created `server/src/{domain,application,infrastructure,presentation}` with ports, stub adapters, orchestrator, `/health`, SSE `/events`, and Counsel-gated `POST /reviews/:id/memo`
  - Created `client/` (Vite + React + TypeScript + Tailwind) with AR/EN locale toggle and `dir="rtl"`
  - Root npm workspaces, `.gitignore`, `.env.example`, `.nvmrc`
  - Wrote documentation templates: BRD, SYSTEM-DESIGN (Part A + Part B gap table), ARCHITECTURE (C4 + sequence + four ADRs), SECURITY (OWASP Web + LLM mapping), EVALUATION (25 Q/A + bilingual metrics), AGENTIC-WORKFLOW, this log
- **Decisions:**
  - Variant locked as **D1T1** (Legal Contract Review & Research; bilingual AR+EN, RTL, cross-lingual retrieval)
  - Backend: **Express + TypeScript** (Fastify not used) at the presentation edge only
  - Frontend: **React + Vite + Tailwind**, RTL via `document.documentElement.dir`
  - Three agents (Clause Extractor, Risk Assessor, Memo Drafter) + `ReviewOrchestrator`; Counsel HITL on memo (`ApprovalRequiredError` → 403)
  - Provider settings named in `.env.example` (hosted + local fallback); adapters are stubs
  - Git corpus will be synthetic/public only; real PDFs/DOCX ignored by `.gitignore`
  - Evaluation will report EN, AR, and cross-lingual metrics separately (25 golden items)
- **Accepted as-is vs edited:** Scaffold generated in-repo for this step; student should read every doc and the hexagonal import boundaries before the next implementation step
- **Files touched:** `server/**`, `client/**`, `package.json`, `README.md`, `.gitignore`, `.env.example`, `docs/*.md`
- **Risks / follow-ups:**
  - `npm install` required before `npm run dev`
  - Agents throw `not implemented`; demo path beyond health/RTL/403 is a placeholder
  - Traceability matrix and golden-set queries are empty by design
  - Next step (recommended): implement Clause Extractor against synthetic TXT + keep HITL intact — still no domain imports of Express or SDKs
