# Agentic workflow (governed AI setup)

This project is built **with** AI assistance under explicit governance. The copilot we are building is also governed: three typed agents, an orchestrator, and Counsel in the loop.

---

## 1. What “governed” means here

| Rule | Practice |
| --- | --- |
| Architecture is non-negotiable | `.cursorrules` forbids domain/application from importing LLM SDKs, vector DBs, or Express |
| Providers are ports | Completions, embeddings, and tools go through TypeScript interfaces; hosted vs local is an adapter choice |
| Agents are typed | Clause Extractor, Risk Assessor, Memo Drafter speak schemas, not free-form chat |
| Humans own side effects | Persist, export, send, and **final memo drafting** require Counsel approval |
| Secrets stay out of git | Conventional Commits; `.env` never committed; no raw personal data |
| Work is logged | Every substantial AI-assisted session is recorded in `docs/AI-USAGE-LOG.md` |

---

## 2. Instructor / developer loop (how we use Cursor)

```
You (intent) → .cursorrules + docs → Cursor agent → diff review → you approve → commit
```

1. **Specify.** Point at BRD / SYSTEM-DESIGN / the current gap row, not “just build an app”.
2. **Constrain.** Keep hexagonal boundaries in the prompt (“ports in domain, Express only in presentation, React only in client”).
3. **Generate small.** Prefer one layer or one agent schema per step — this scaffold is step 1.
4. **Review as Counsel for code.** Check imports, secrets, and HITL. Reject any `domain` file that imports `express` or an OpenAI SDK.
5. **Log.** Append `docs/AI-USAGE-LOG.md` with decisions, not only “used ChatGPT”.
6. **Commit.** Conventional Commits (`feat:`, `docs:`, `chore:`). Never commit `.env`.

Suggested Cursor usage:

- Agent mode for scaffolding and boilerplate you will read.
- Ask mode for architecture questions against `docs/ARCHITECTURE.md`.
- Do not paste real contracts or live API keys into the chat.

---

## 3. Runtime agent graph (the product)

```
                    ┌──────────────────┐
                    │   Orchestrator   │
                    │ (application)    │
                    └────────┬─────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
   Clause Extractor    Risk Assessor     Memo Drafter
   typed clauses       severity+cites    bilingual memo
           │                 │                 │
           └────────┬────────┴────────┬────────┘
                    ▼                 ▼
             CompletionPort     ApprovalPort
                    ▼                 ▼
            infrastructure      Counsel (human)
                    ▼
              Express + SSE  →  React (RTL)
```

- Extractor and Assessor may run with retrieval (`VectorStorePort`) **without** creating an external side effect.
- Memo Drafter is **not** invoked until `ApprovalPort` returns approved.
- Orchestrator never “helpfully” emails a client.

---

## 4. Tool and model policy

- **Allowed in infrastructure only:** provider SDKs, HTTP clients, vector DB drivers.
- **Allowed in presentation only:** Express, CORS, SSE headers.
- **Allowed in domain:** entities, value objects, port *interfaces*, validation of citations — **zero npm framework imports**.
- **Swappable:** if `LLM_PROVIDER` changes, use cases stay the same.
- **Local fallback:** when hosted calls fail, the factory selects the local adapter; the user is told which provider produced the answer.

---

## 5. Prompt and data hygiene

- Contract body is **untrusted** (prompt-injection risk). Delimit it; never concatenate it as instructions.
- Prompts should demand JSON conforming to the agent schema; invalid JSON is a hard fail, not a retry loop without a cap.
- Evaluation queries live in `docs/EVALUATION.md` / later JSONL — not in production logs with full documents.

---

## 6. Definition of done for an AI-assisted change

- [ ] Matches the BRD row or gap-table id you named
- [ ] No new inner-layer framework imports
- [ ] No secrets in the diff
- [ ] HITL still enforced if the change touches memo/export
- [ ] `AI-USAGE-LOG.md` updated
- [ ] Tests or a manual check noted for bilingual/RTL if UI or retrieval changed
