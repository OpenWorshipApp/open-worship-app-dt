---
name: help-search-known-question
description: owa_help_search treats an exact corpus question as a LABEL (its filed recipe first, isKnownQuestion true) because the search got the app's own chips wrong 43% of the time; the corpus ranker is worse, not better, so never make it corpus-first
metadata:
  type: project
---

`searchHelp` (`tools/owa-devtools-mcp/help.mjs`) looks the query up in
`questions/*.json` by normalised text first; an exact corpus question gets
its `resources.recipe` first with `isKnownQuestion: true`. The chatbot window
does the model-side twin: `findKnownQuestion` / `genKnownQuestionHint`
append the page and live tools to the ASK when the typed text is a corpus row
(the model rewrites every query, so the server lookup never fires for it).
`MIN_HELP_HIT_SCORE = 6` is the floor under which a hit is not an answer.

**Why:** measured 2026-09-03 on all 258 corpus questions with a recipe: search
top-1 57%. The two rankers agree 28% of the time; when they disagree the
search is right 47% and the corpus 19% — corpus-first would REGRESS. Right and
wrong hit scores overlap from 6 to 160, so no threshold above 6 is safe.

**How to apply:** quote held-out paraphrases (22/45), never corpus top-1
(258/258 by construction now). A retrieval change is graded with
`grade-retrieval.mjs` (scratchpad pattern: import `help.mjs` with
`OWA_KNOWLEDGE_DIR` set, iterate `flattenQuestions(loadQuestionPages())`).
Related: [[help-search-prefix-overmatch]], [[question-corpus-maintenance]],
[[chatbot-builtin-commands]].
