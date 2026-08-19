# Corpus

Synthetic **D1T1** bilingual contracts for ingest, retrieval and risk evaluation. No real client matters and no real personal data.

Regenerate:

```powershell
npm run corpus:generate
```

Outputs:

- `data/corpus/D1T1-*.md` — 32 agreements (16 Arabic, 16 English)
- `data/corpus/corpus_manifest.json` — catalogue, clause tags, high-risk flags

Types: NDA, SLA, MSA, SaaS/licensing, employment & consulting. Each document includes confidentiality, liability/indemnity, termination/notice, governing law/disputes, and payment/penalties.

Five files carry intentional playbook deviations (see `high_risk` in the manifest) for the Risk Assessor. Do not treat those clauses as recommended market terms.

Binary dumps (`*.pdf`, `*.docx`, `*.txt`) stay gitignored.
