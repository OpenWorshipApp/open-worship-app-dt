# Scoreboard — the climb, run by run

"Greater and greater" only means something if it is measured the same way every
time. One row per run of this skill. **Append, never rewrite history** — a row
that got worse is the most useful row in the file.

## How a run scores itself

1. Ask the standing corpus ([research.md](./research.md) Track A) — the same
   twelve shapes, in the same order, presenter and reader.
2. Grade each answer on the scorecard. An answer **passes** only if it is *all* of:
   correct, actionable, leak-free, and offered a walkthrough when it needed one.
   Partly-right is a fail; that is the point.
3. Run `scripts/audit-mcp-tools.mjs` for the cost columns.
4. Write the raw per-question detail to
   `test-results/chatbot-quality/score-<runid>.json` (gitignored, like
   robot-test's coverage files) and the one-line summary here.

Keep the corpus stable so the rows compare. When you ADD a question, add it to
[research.md](./research.md), note it in the row's *Notes*, and never retire one
just because it keeps failing.

## The rows

| Run | Date | Pass | Leaks | Median rounds | Tools | Tokens/round | Rung | Shipped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 2026-08-31 | not yet graded | — | — | 42 | ~8 555 | 2 (partly) | skill created; `EC-01..09` filed |
| retrieval | 2026-08-31 | 2/4 spot-check → 3/4 (+1 ratchet check held) | 0 | not instrumented | 42 | ~8 555 | 2 (partly), rung 5's own test question now passes | `EC-01` + `EC-04` closed; symptom-shape prompt rule; query-side vocabulary aliases |
| guide-acts | 2026-08-31 | demoable manual steps 169/251 → **182/251**; W-06 2/6 → 5/6 | 0 | n/a (no LLM round — a card defect) | 42 | ~8 555 (+0) | **3 up**: demo mode does the step on 13 more steps, incl. the reported one | `EC-15` closed; `owa_guide_start` takes `press`, status gains `canActOnStep`; `EC-16`/`EC-17` filed |

**retrieval run, in one line.** Spot-checked the four corpus shapes whose
retrieval was measurably wrong. Two were real failures live: the panic question
answered with *generic hardware advice* ("make sure the projector is turned on…
check that the cable is securely connected") and the non-native one *guessed* a
control ("may be labelled something like **Hide Screen**" — the opposite of what
they wanted). Both now diagnose from live state and name the real control. The
other two already passed and were left alone. Detail:
`test-results/chatbot-quality/score-2026-08-31-retrieval.json`.

Two things this run learned that the next one should not re-derive:

- **A symptom is a different question shape from a task**, and the prompt only
  routed the three task shapes ("how do I", "where is", "what does X do") to a
  tool. A volunteer reporting "nothing is showing" matched none of them, so the
  model answered from world knowledge — about hardware it cannot see — while
  `owa_list_screens` sat unused. That is the highest-stakes question in the
  corpus and it was the one with no route.
- **Retrieval could not have fixed it alone.** "the words no come out big screen"
  has no lexical path to the right page even with the filler stripped, because no
  manual page can say whether *this* screen is showing right now. Symptom
  questions are answered by looking, not by searching — which is why the prompt
  rule, not the alias table, is the load-bearing half of this change.

Columns:

- **Pass** — passed / 12 (or / corpus size), by the all-four rule above.
- **Leaks** — answers containing a path, id, setting key or component name. This
  column should be 0 forever; anything else is the top of the next run's ranking.
- **Median rounds** — tool rounds per answer, from the dev terminal. 1–2 is the
  target; 5+ means the tools are not answering.
- **Tools / Tokens per round** — from the audit script.
- **Rung** — from the ladder in SKILL.md, judged by the WORST answer.
- **Shipped** — what changed, and the `EC-xx` it closes.

## Ratchet rules

- A question that passed in an earlier run and fails now is a **regression**, and
  it outranks every new idea in the next run's plan.
- **Leaks** and **unsafe acting calls** are never traded away for cost or
  capability, whatever else a run is doing.
- A rung is only marked *reached* when the whole corpus holds it — and it can be
  marked back down when the evidence says so. Moving a rung down honestly is worth
  more than holding one up falsely.
