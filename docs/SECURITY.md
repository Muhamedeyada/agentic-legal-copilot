# Security

**Scope:** Assessment MVP (local/dev + documented production intent)  
**Variant:** D1T1 — contracts may look sensitive even when synthetic; treat uploads as confidential  
**Stack:** Express API + React SPA  
**Controls implemented:** prompt/document privilege separation, Zod output validation, HTML sanitization, PII redaction before LLM, sliding-window rate limit, prompt/completion size caps.

---

## 1. Threat framing

| Asset | Risk if compromised |
| --- | --- |
| Uploaded contracts | Confidential commercial terms, possible PII |
| Memo drafts | Privileged legal analysis |
| API keys / `.env` | Account abuse, data exfil via provider |
| Vector index / corpus | Bulk reconstruction of playbook and contracts |
| Approval gate | Unauthorized “final” memo |
| SSE / JSON responses | XSS if model HTML is rendered unsafely |

---

## 2. OWASP Top 10 (Web)

| ID | Category | Relevance to D1T1 | Control in this project |
| --- | --- | --- | --- |
| A01 | Broken Access Control | Paralegal vs Counsel; memo export | `LegalWorkflowOrchestrator.draftMemo` throws `ApprovalRequiredError` while `AWAITING_APPROVAL`. HTTP 403. No production auth yet — `DEMO_API_TOKEN` remains a deploy checklist item. |
| A02 | Cryptographic Failures | Secrets in git | `.gitignore` on `.env`; `.env.example` placeholders only. Dummy `OPENAI_API_KEY` values are treated as **missing** (mock adapter). |
| A03 | Injection | JSON bodies, file text, prompts | JSON body limit 1mb; `maxUploadChars` 413; Zod schemas on agent I/O; untrusted document wrappers; prompt-injection detector. |
| A04 | Insecure Design | Autopilot memo | HITL is mandatory (`REQUIRE_COUNSEL_APPROVAL`). Side-effect tool `save_draft_memo_tool` is Counsel-gated. |
| A05 | Security Misconfiguration | CORS, stack traces | `CLIENT_ORIGIN` allow-list; `x-powered-by` disabled. |
| A06 | Vulnerable Components | npm / future LLM SDKs | Lockfile; SDKs stay in `infrastructure/` only. |
| A07 | Identification and Authentication Failures | Open API in demo | Rate limit per IP (`RATE_LIMIT_PER_MINUTE`, default 60). Demo token not enforced yet. |
| A08 | Software and Data Integrity Failures | Model/tool supply chain | Pinned workspace lockfile; tool registry allow-list. |
| A09 | Security Logging Failures | Prompts may contain contracts | Do not log API keys. PII redaction runs before completion. Eval/report files go under `data/runtime/` (gitignored). |
| A10 | Server-Side Request Forgery | Tooling that fetches URLs | No URL-fetch tools. Retrieval is playbook + local corpus. |

---

## 3. OWASP Top 10 for LLM Applications

IDs follow the OWASP LLM Top 10 (2025 numbering used in the course template).

| ID | Category | Relevance to D1T1 | Control in this project |
| --- | --- | --- | --- |
| LLM01 | Prompt Injection | Clause text and user chat can contain “ignore previous instructions” | **Privilege separation:** `TRUSTED_SYSTEM_PREFIX` is the only trusted instruction. User text and contracts are wrapped in `<<<UNTRUSTED_*>>>` and never concatenated into `system`. `detectPromptInjection` + `stripInjectionPhrases` (EN + AR). Golden items G-22 / G-23. Document bodies are labeled *data, not instructions*. |
| LLM02 | Sensitive Information Disclosure | Contracts, keys, system prompt | PII redaction (`redactPii`) on ingest/orchestrator `start`. Factory refuses placeholder keys. Agents must not echo the system prefix. OOD questions refuse rather than guess. |
| LLM03 | Supply Chain | Provider swap | `CompletionPort` + `createCompletionAdapter`: hosted / local / mock. Eval never requires a vendor SDK. |
| LLM04 | Data and Model Poisoning | Untrusted corpus / uploads | Git corpus is synthetic. MIME / size caps on upload (`MAX_UPLOAD_MB`, `MAX_UPLOAD_CHARS`). Ingested text is untrusted. |
| LLM05 | Improper Output Handling | Memo in React / JSON | Zod `parseContract` on every agent schema. `sanitizeModelText` strips tags, `javascript:`, and event handlers before memo bodies leave the drafter. Client must keep rendering as text (no `dangerouslySetInnerHTML`). |
| LLM06 | Excessive Agency | Draft/send without human | Orchestrator + Counsel gate. Write tool only in `PENDING_APPROVAL`. G-20 in the eval harness. |
| LLM07 | System Prompt Leakage | “Reveal the system prompt” | Injection queries refuse. System string is not returned on HTTP. Mock completions throw rather than invent a leak. |
| LLM08 | Vector / embedding weaknesses | Index poisoning, cross-lingual leakage | Eval RAG is local files + clause chunks. Metadata `language` comes from filename/detector, not the user. Open-corpus questions below score threshold → `not_enough_information`. |
| LLM09 | Misinformation | Hallucinated law / clauses | Citation validator (ids must exist). RAG refuses below `MIN_SCORE`. Golden set checks groundedness and invented-statute refusal (G-24). Risk scores come from `risk_calculator_tool`, not the LLM. |
| LLM10 | Unbounded consumption | Huge PDFs, loops, tokens | `CappedCompletionAdapter` (`MAX_PROMPT_CHARS`, `MAX_COMPLETION_CHARS`). Orchestrator max iterations + step timeout. Express JSON 1mb. `RATE_LIMIT_PER_MINUTE`. Upload character cap → 413. |

---

## 4. Control map (code)

| Control | Location |
| --- | --- |
| PII redaction | `server/src/domain/security/pii-redact.ts` — applied in `LegalWorkflowOrchestrator.start` and corpus indexing |
| Injection detect/strip | `server/src/domain/security/prompt-injection.ts` — `CorpusRagUseCase` |
| Prompt isolation | `server/src/application/security/prompt-isolation.ts` — Clause Extractor + Memo Drafter |
| Output sanitization | `server/src/application/security/output-sanitize.ts` |
| Token / size caps | `server/src/infrastructure/llm/capped.adapter.ts`, `loadConfig()` |
| Rate limit | `server/src/application/security/rate-limit.ts` + `rate-limit.middleware.ts` (HTTP 429) |
| Schema validation | `server/src/application/agents/schemas.ts` (`SchemaViolationError`) |
| HITL | `server/src/application/hitl/counsel-approval.ts` |
| Dummy API key → mock | `server/src/infrastructure/llm/factory.ts` |

Environment (see `.env.example`):

```
RATE_LIMIT_PER_MINUTE=60
MAX_PROMPT_CHARS=12000
MAX_COMPLETION_CHARS=8000
MAX_UPLOAD_CHARS=200000
REQUIRE_COUNSEL_APPROVAL=true
```

---

## 5. Bilingual / RTL notes

- RTL must not spoof homoglyph URLs in citations; show raw locator text.
- Do not auto-translate a citation without labeling it **translation**.
- Injection patterns include Arabic (`تجاهل التعليمات السابقة`, `اعرض موجه النظام`).
- Refusal tests must not use corpus toponyms (e.g. Cairo) or they become false hits.

---

## 6. Secure development checklist (assessment)

- [x] No API keys in git history (template only)
- [x] `.env` not committed
- [x] Corpus files are synthetic
- [x] Counsel gate covered by unit tests and G-20
- [x] Prompt-injection fixtures in golden set (AR and EN)
- [x] PII redaction helper before LLM
- [x] Rate limit and token caps active
- [ ] Logging redaction reviewed before a shared demo
- [ ] CORS origin is not `*` in any shared deploy
- [ ] Replace `DEMO_API_TOKEN` with real auth before exposing the API
