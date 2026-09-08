---
name: chatbot-recipe-id-scrub
description: A prompt rule against manual ids ("W-08") failed 2 of 2 on the same question; ids are now scrubbed in code at the excerpt and at the answer seam, replaced with the page title the tool watch learned
metadata:
  type: project
---

Measured 2026-09-08 (`EC-92`): Claude Sonnet 5, *Where is the button to
change the background?*, opened its answer with **"W-08 has exactly what you
need"** -- and, re-asked after the fix, with *"W-08 is the exact match"*. The
prompt has said "an id like W-06 -- not even in passing" since the first run.
The id came from the search HIT (its `id` field, and an excerpt reading
"(W-08 step 1)" / "see W-28"); the page tool had scrubbed page bodies since
`EC-21`, the excerpts were never scrubbed, and a two-round answer is written
from the excerpt.

**Why:** a rule the model can ignore is not a rule -- the frames (`OPTIONS:`,
`NEEDS:`, `SHOWS:`) learned this in `EC-43`, and ids are the same shape of
problem. The hit's `id` field cannot go (it is the handle `owa_help_page`
and `owa_guide_start` take), so the SINK has to read the answer once more.

**How to apply:** `scrubRecipeIds` (`tools/owa-devtools-mcp/help.mjs`) is the
one scrub for page bodies and excerpts; `scrubAnswerRecipeIds`
(`src/chatbot/recipeIdHelpers.ts`) runs in `askLlmBot` AFTER the three frames,
against `watch.pageTitles` (per ask, filled by `learnPageTitles` from every
search hit and opened page). Do not answer a new leak of this class with
another prompt sentence -- extend the scrub, and keep the NOT_AN_ID_SET
(`UTF-8`, `USB-3`) honest. The guide card's `stripInternalIds` is the
one-line sibling and must keep the `[a-z]?` for `W-01b`.
Related: [[chatbot-answer-options]], [[help-search-known-question]].
