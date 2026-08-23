# Teaching pack (D1T1)

90-minute postgraduate session plus a lab on the **running** Agentic Legal Copilot — not slide-only theory.

| File | Use |
| --- | --- |
| [SLIDES.md](SLIDES.md) | Lecture outline (20 slides, ~90 minutes) |
| [LAB-SHEET.md](LAB-SHEET.md) | Four exercises, three stretch tasks, answer key |
| [TRAINEE-MISTAKES.md](TRAINEE-MISTAKES.md) | Five Agentic RAG misconceptions with code corrections |

## Variant reminder

| Input | Formula | Result |
| --- | --- | --- |
| Last two National ID digits `92` | `92 mod 7 = 1` | **D1** Legal contract review |
| Digit sum `49` | `49 mod 8 = 1` | **T1** Bilingual AR+EN, RTL, cross-lingual retrieval |

## How to run the session

1. `npm install` then `npm run dev`, **or** `docker compose up --build`.
2. Walk [SLIDES.md](SLIDES.md). Live-demo the UI at slide 12.
3. Trainees complete [LAB-SHEET.md](LAB-SHEET.md). Leave `OPENAI_API_KEY` empty.
4. Debrief with [TRAINEE-MISTAKES.md](TRAINEE-MISTAKES.md).

Golden set: `npm run eval` (see [docs/EVALUATION.md](../docs/EVALUATION.md)).
