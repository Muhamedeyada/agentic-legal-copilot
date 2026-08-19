# Agentic workflow

Two separate things live under this heading: how the **product** runs its three agents, and how **this repository** is built without the domain layer depending on SDKs.

---

## Product (runtime)

Review is not a single chat. An orchestrator calls three specialists with typed inputs and outputs:

1. Clause Extractor — clause list from the contract
2. Risk Assessor — severity and citations
3. Memo Drafter — bilingual memo, only after Counsel approval

```
Orchestrator
    → Clause Extractor
    → Risk Assessor
    → ApprovalPort (Counsel)
    → Memo Drafter
```

Extractor and Assessor may read the vector store. They must not send email, write files, or publish a memo. Memo Drafter does not run until `ApprovalPort` says approved. That is the human gate in D1.

---

## Repository rules (how the code is written)

Committed in `.cursorrules` so every change, with or without a coding assistant, is judged the same way:

| Rule | Why |
| --- | --- |
| `domain` and `application` never import Express, an LLM SDK, or a vector client | Provider swap is an adapter, not a rewrite |
| Completions and embeddings go through ports | Hosted vs local is configuration |
| Agents talk schemas, not free text | Evaluation and tests can fail a bad payload |
| Side effects and the final memo need Counsel | Matches D1 |
| No secrets or real personal data in git | Assessment non-negotiable |

I review imports on every change. If a domain file imports `express` or an OpenAI package, it is rejected.

Prompts for the product will live as versioned files under a later `prompts/` tree, not as string literals in use cases. Until then, there are no live model calls.

---

## Checks before I merge a change

- Matches a BR or a row in the system-design gap table
- No new framework import in domain/application
- Memo/export still blocked without approval
- This log updated if a coding assistant drafted more than a few lines
- RTL still works if the UI or retrieval changed
