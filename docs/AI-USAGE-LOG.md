# AI usage log

Required by the assessment. Notes on where a coding assistant was used, what I kept, and what I still have to verify. No secrets or real contracts in this file.

## How I log

Date, what I asked for, what I changed after review, open risks.

## 2026-08-19 — layout and first docs

I set the variant to D1T1 from the National ID derivation in the README. Stack is Node.js / Express (TypeScript) and React, hexagonal layers, Counsel approval before any memo.

A coding assistant in the IDE helped with the first folder layout, npm workspaces, and first-pass markdown. I kept:

- domain ports with no Express or SDK imports
- memo path returning 403 until approval
- AR/EN toggle setting `dir` on `html`

I did not keep a Python layout. Agents and retrieval are not built yet; I will not describe them as working in the README.

Next: synthetic AR and EN contracts, then ingest and retrieval, reviewed file by file.
