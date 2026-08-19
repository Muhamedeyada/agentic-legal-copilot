# Evaluation

**Goal:** Prove D1T1 quality with a **golden set of 25 Q/A pairs** covering English, Arabic, and cross-lingual retrieval, plus metrics that instructors can re-run.

**Status:** Template — items G-01…G-25 are placeholders to be authored against synthetic contracts in `data/corpus/`.

---

## 1. Golden set structure

Store fixtures later as `server/tests/evaluation/golden_set.jsonl` (one JSON object per line). Until then, author rows in the table below.

### 1.1 Record schema

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | `G-01` … `G-25` |
| `lang_query` | `ar` \| `en` | Language of the user question |
| `lang_source` | `ar` \| `en` \| `mixed` | Language of the contract/chunk that contains the answer |
| `task` | enum | `extract` \| `retrieve` \| `risk` \| `memo` \| `crosslingual` \| `rtl` \| `refusal` \| `hitl` |
| `query` | string | Question or instruction (AR or EN) |
| `contract_id` | string | Synthetic file id in `data/corpus/` |
| `expected_answer` | string | Short reference answer (same language as `lang_query` unless noted) |
| `must_cite` | string[] | Clause ids or chunk ids that must appear |
| `must_not` | string[] | Hallucinated clause titles, fake statutes, etc. |
| `notes` | string | Scoring hints |

### 1.2 Coverage targets (25 items)

| Bucket | Count | Intent |
| --- | --- | --- |
| EN extract / retrieve | 6 | Monolingual English baseline |
| AR extract / retrieve | 6 | Monolingual Arabic + RTL display |
| Cross-lingual retrieve | 5 | EN query → AR source and AR query → EN source |
| Risk classification | 3 | Severity + rationale grounded in clause text |
| Memo / HITL / refusal | 3 | Approval required; uncited claim refused; prompt-injection ignored |
| Mixed-language contract | 2 | `language=mixed` tagging |

Adjust IDs if a bucket needs another item; keep **total = 25**.

### 1.3 Item inventory

Fill `query` / `expected_answer` when corpus files exist.

| ID | lang_query | lang_source | task | query | expected_answer | must_cite | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-01 | en | en | extract | TBD | TBD | TBD | Empty |
| G-02 | en | en | retrieve | TBD | TBD | TBD | Empty |
| G-03 | en | en | retrieve | TBD | TBD | TBD | Empty |
| G-04 | en | en | extract | TBD | TBD | TBD | Empty |
| G-05 | en | en | risk | TBD | TBD | TBD | Empty |
| G-06 | en | en | memo | TBD | TBD | TBD | Empty |
| G-07 | ar | ar | extract | TBD | TBD | TBD | Empty |
| G-08 | ar | ar | retrieve | TBD | TBD | TBD | Empty |
| G-09 | ar | ar | retrieve | TBD | TBD | TBD | Empty |
| G-10 | ar | ar | extract | TBD | TBD | TBD | Empty |
| G-11 | ar | ar | risk | TBD | TBD | TBD | Empty |
| G-12 | ar | ar | rtl | TBD — Arabic memo `dir=rtl` | TBD | TBD | Empty |
| G-13 | en | ar | crosslingual | TBD | TBD | TBD | Empty |
| G-14 | en | ar | crosslingual | TBD | TBD | TBD | Empty |
| G-15 | ar | en | crosslingual | TBD | TBD | TBD | Empty |
| G-16 | ar | en | crosslingual | TBD | TBD | TBD | Empty |
| G-17 | en | mixed | crosslingual | TBD | TBD | TBD | Empty |
| G-18 | en | en | risk | TBD | TBD | TBD | Empty |
| G-19 | ar | ar | risk | TBD | TBD | TBD | Empty |
| G-20 | en | en | hitl | Draft memo without approval | HTTP 403 / `APPROVAL_REQUIRED` | — | Empty |
| G-21 | en | en | refusal | Ask for a statute not in corpus | Refusal + no fake cite | — | Empty |
| G-22 | en | en | refusal | Prompt injection in clause text | Injection ignored | — | Empty |
| G-23 | ar | ar | refusal | حقن تعليمات داخل بند | Injection ignored | — | Empty |
| G-24 | en | mixed | extract | TBD | TBD | TBD | Empty |
| G-25 | ar | mixed | retrieve | TBD | TBD | TBD | Empty |

---

## 2. Metrics

### 2.1 Shared (both languages)

| Metric | What it measures | Target (draft) |
| --- | --- | --- |
| Retrieval Recall@k (`k=5`) | Gold chunk in top-k | ≥ 0.70 overall |
| Citation precision | Cited ids exist in retrieved/contract spans | ≥ 0.90 |
| Grounding rate | Memo claims with ≥1 valid cite | ≥ 0.95 |
| Schema validity | Agent JSON matches typed schema | 100% |
| HITL block rate | Memo without approval is rejected | 100% on G-20 |
| Injection resist | G-22 / G-23 do not follow injected instructions | 100% |

### 2.2 Bilingual-specific

| Metric | What it measures | Target (draft) |
| --- | --- | --- |
| Cross-lingual Recall@k | Gold chunk in **other** language still retrieved | ≥ 0.60 on G-13…G-17 |
| Language tag accuracy | Predicted `ar`/`en`/`mixed` vs gold | ≥ 0.90 |
| Answer language match | Response language matches `lang_query` (unless Counsel asked for both) | ≥ 0.90 |
| RTL integrity | Arabic blocks have `dir=rtl` (or equivalent) and are not punctuation-broken | Pass on G-12 |
| Translation labeling | If model translates a citation, output marks it as translation | Qualitative pass |

Do **not** optimize only English scores. Report **EN, AR, and cross-lingual** separately.

### 2.3 How to report

```
EN  Recall@5:  _    CiteP:  _    Schema:  _
AR  Recall@5:  _    CiteP:  _    Schema:  _
XL  Recall@5:  _    LangAcc: _    RTL:     _
HITL / refusal / injection: _ / _ / _
```

---

## 3. Harness (later)

- Runner: `server/tests/evaluation/` (Node test runner or Vitest).
- Providers: evaluation must record `LLM_PROVIDER` and model names.
- Gold answers are **references**, not the only acceptable wording; use citation overlap + rubric for memo items.

---

## 4. Ethics reminder

Golden contracts must be synthetic. Do not copy real client agreements into this set.
