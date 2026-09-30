---
name: help-search-prefix-overmatch
description: The chatbot's manual search treated a 4+ letter word as a prefix, so "screen" matched "Screencast"; and the 236-question corpus is a labelled retrieval test set nobody was grading against
metadata:
  type: project
---

Two things about `owa_help_search` (`tools/owa-devtools-mcp/help.mjs`) that are
not visible from the code, found 2026-09-01 by measuring rather than reading.

**A prefix is not a stem.** `countTerm` matched any term of four letters or more
against the START of a word with no bound on the rest — deliberate, for
"look"→"lookup" and "verse"→"verses". Unbounded it also gave 45 wrong-word pairs
live in this corpus, 229 occurrences, **10 of them in a page TITLE where a hit is
worth 14**: `screen`→`Screencast`, `copy`→`copyright`, `song`→`SongSelect`,
`back`→`background`, `down`→`download`, `stop`→`stopwatch`, `drop`→`dropdown`.
That is how `owa_help_search "show screen"` answered a question about the
projector with W-20, the keyboard screencast page, at score 84 over W-10 at 59.
The tail is capped at three characters now. If a legitimate match ever goes
missing, this cap is why — and the base word still matches, which is the trade
that was chosen: a wrong page costs more than a missed inflection.

**The question corpus is a labelled test set, and `help.mjs` has never seen it.**
`tools/owa-devtools-mcp/questions/*.json` pins every one of its questions to the
`W-xx` that answers it, so it grades retrieval without circularity. It said
**136/236 top-1 (58%)** before this work and 140 (59%) after — i.e. the search
hands the model the wrong page around 40% of the time, which is the ceiling on
answer quality and is filed as `EC-50`. Those absolutes are over the 236
questions the corpus held on 2026-09-01; it has grown since (252 across 11 pages
by the end of that day), so RE-MEASURE rather than comparing a new score to
them — a raw count here rots, which is why it is written as a date-stamped
measurement and not as the size of the corpus. Grade every retrieval change against it,
plus a **held-out** set (45 volunteer paraphrases written from recipe titles
only, in `test-results/chatbot-quality/`), because the corpus cannot honestly
grade a change that indexes the corpus.

Aggregate top-1 is the wrong headline for "the assistant answers irrelevant
things": these fixes moved it 2 points while removing a whole class of
catastrophic misses. Report the per-query delta (9 fixed / 3 broken) and the size
of the class, not the mean.

Related: [[claude-dir-edits-need-knowledge-rebuild]],
[[mcp-tool-edit-two-processes]], [[question-corpus-maintenance]],
[[chatbot-walkthrough-follows-first-search]].
