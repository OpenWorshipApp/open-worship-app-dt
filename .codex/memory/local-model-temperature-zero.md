---
name: local-model-temperature-zero
description: "The chatbot sends temperature 0 to LM Studio, Ollama and llama.cpp; before that a local model sampled at its program's default and the wrong answers moved between askings"
metadata:
  node_type: memory
  type: project
  originSessionId: 5b07f182-3f35-46de-a795-58cdc0a98502
  modified: 2026-10-13T05:28:41.340Z
---

No request of the chatbot's carried a temperature until 2026-10-13, so a server
of the user's own sampled at its program's default. `LOCAL_TEMPERATURE` (0) in
`genCustomProvider` (`src/chatbot/llmBotHelpers.ts`) is now sent to LM Studio,
Ollama and llama.cpp; the paid providers and an unknown server are left alone.

**Why:** every supported question had been asked of a 4B model (gemma-4-e4b)
and the failing answers reworded page by page for a night, and the dense pages
never settled: about one running-order answer in seven wrong per asking, and
not the same ones twice. That was sampling, not wording. Measured through the
help window: at the default not one re-asked answer had come back in the same
words; at 0, 26 of 27 came back word for word, and the asking graded 19 right,
6 partly, 2 wrong against 14, 9, 4 the night before.

**How to apply:**

- A corpus run on a local model is now REPEATABLE: one asking is evidence
  about the next, and a wrong answer is a fixed target, not a moving one.
- **A page edit re-rolls every answer written from that page.** Ask all the
  page's rows again after an edit, not only the one the edit was for — the
  second wording of one step turned a right neighbour into a recitation of the
  whole page.
- **The same answer needs the same words, to the byte.** A page that fits used
  to ride with the page tool's foot note, which says the DAY of the copy:
  regenerating the manual under the next day's date, with no page edited,
  changed all 27 answers. The note no longer rides
  (`clipKnownPageParts`); never put a date, a version or a count into what a
  known question is asked with.
- The one answer that differed between two askings was whichever question came
  first after something else: the server's cached prefix differs and a
  near-tie falls the other way. Near-deterministic, not bit-exact.
- The kind of server is read before every question with a five-second wait;
  the kind it LAST said is kept (`lastServerKindMap`) so a look that runs out
  does not send that question out sampled.
- With it came a sentence in the hint for a row that names its `passage`:
  answer _in its own words — copy the sentences you use as they stand_
  (`genKnownQuestionHint`). A copied sentence cannot change its noun; see
  [[question-corpus-maintenance]] and [[custom-llm-servers]].
