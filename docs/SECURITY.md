# Security

**Scope:** Assessment MVP (local/dev + documented production intent)  
**Variant:** D1T1 — contracts may look sensitive even when synthetic; treat uploads as confidential  
**Stack:** Express API + React SPA

This document maps controls to **OWASP Top 10 (Web)** and **OWASP Top 10 for LLM Applications**. Fill **Control in this project** as features land. Until then, the column is the *intended* control.

---

## 1. Threat framing

| Asset | Risk if compromised |
| --- | --- |
| Uploaded contracts | Confidential commercial terms, possible PII |
| Memo drafts | Privileged legal analysis |
| API keys / `.env` | Account abuse, data exfil via provider |
| Vector index | Bulk reconstruction of corpus |
| Approval gate | Unauthorized “final” memo or export |
| SSE stream | Leak of intermediate agent text |

---

## 2. OWASP Top 10 (Web) — mapping template

| ID | Category | Relevance to D1T1 | Intended control | Control in this project | Owner |
| --- | --- | --- | --- | --- | --- |
| A01 | Broken Access Control | Paralegal vs Counsel; memo export | Role checks; Counsel-only approval and export | HITL 403 on memo; no auth yet | |
| A02 | Cryptographic Failures | Secrets in git; plaintext `.env` | `.gitignore`; no secrets in repo; TLS in deploy | `.gitignore` + `.env.example` only | |
| A03 | Injection | File names, prompts, JSON bodies | Typed schemas; parameterized DB; prompt/user isolation | JSON body limit 1mb | |
| A04 | Insecure Design | Autopilot memo send | HITL by design (`REQUIRE_COUNSEL_APPROVAL`) | Orchestrator + 403 | |
| A05 | Security Misconfiguration | CORS `*`, debug in prod | Restrict `CLIENT_ORIGIN`; `x-powered-by` disabled | CORS origin from env | |
| A06 | Vulnerable Components | LLM/vector SDKs, npm | Pin deps; `npm audit` later | package-lock after install | |
| A07 | Identification and Authentication Failures | Open API in demo | At minimum `DEMO_API_TOKEN`; production: real auth | Env placeholder only | |
| A08 | Software and Data Integrity Failures | Model/tool supply chain | Pin models; lockfile | npm workspaces | |
| A09 | Security Logging Failures | Need audit without logging secrets | Redacted audit log; never log API keys or full contracts | TBD | |
| A10 | Server-Side Request Forgery | Tooling that fetches URLs | No arbitrary URL-fetch tools in MVP | TBD | |

---

## 3. OWASP Top 10 for LLM Applications — mapping template

Adjust IDs if the course specifies a particular year.

| ID | Category | Relevance to D1T1 | Intended control | Control in this project | Owner |
| --- | --- | --- | --- | --- | --- |
| LLM01 | Prompt Injection | Contract text can contain “ignore previous instructions” | Treat document text as **untrusted data**; wrap in delimiters; no side-effect tools from extract/assess alone | TBD | |
| LLM02 | Sensitive Information Disclosure | Contracts + keys in prompts | Redact secrets; do not send full `.env`; minimize prompt | TBD | |
| LLM03 | Supply Chain | Model/provider swap | Ports + pinned model names in env; log `provider` + `model` | Factory stub | |
| LLM04 | Data and Model Poisoning | Untrusted corpus | Git corpus = synthetic/public only; ingest MIME allow-list | `.gitignore` on binaries | |
| LLM05 | Improper Output Handling | Memo rendered in React / exported | Encode output; citations required; no `dangerouslySetInnerHTML` from model | Client is text-only scaffold | |
| LLM06 | Excessive Agency | Draft/send without human | Orchestrator: Memo Drafter and side effects **blocked** without Counsel approval | `ApprovalRequiredError` | |
| LLM07 | System Prompt Leakage | Attackers ask for the prompt | Do not echo system prompts; least-privilege tools | TBD | |
| LLM08 | Vector/embedding weaknesses | Cross-lingual index poisoning or leakage | Auth on upsert; metadata `lang` from detector not user claim alone | TBD | |
| LLM09 | Misinformation | Hallucinated law/clauses | Citation validator; refuse uncited legal claims; eval golden set | TBD | |
| LLM10 | Unbounded consumption | Huge PDFs / SSE loops | `MAX_UPLOAD_MB`; max chunks; agent step limits | Env template; SSE heartbeat only | |

---

## 4. Bilingual / RTL notes

- RTL must not be used to spoof homoglyph URLs in citations; display raw URL separately from linked text.
- Do not auto-translate a citation’s source language without labeling it **translation**.

---

## 5. Secure development checklist (assessment)

- [ ] No API keys in git history
- [ ] `.env` not committed
- [ ] Corpus files are synthetic or public-domain
- [ ] Counsel gate covered by a test (`403` without approval)
- [ ] Prompt-injection fixture in golden set (at least one AR and one EN)
- [ ] Logging redaction reviewed before demo
- [ ] CORS origin is not `*` in any shared deploy
