---
name: lesson-goal-stops-at-95-percent
description: "The preaching-lesson goal is done at 95% Best -- 31 of a batch's 32 blind reads"
metadata:
  node_type: memory
  type: project
  originSessionId: 64c20cce-a53c-493c-b1f4-046abac8f766
  modified: 2026-11-14T13:06:29.661Z
---

2026-11-14, the user, mid-loop on the goal _chatbot completely smart enough
to help prepare a best preaching lesson_ (`owa-enhance-bible-note-chatbot`):
_stop at 95% rate of overall goal_.

The loop (a batch of the held-out asks on a scratch profile, read blind by
Sonnet and Opus against `references/lesson-rubric.md`, a fix, the next
batch) stops when the newest batch -- the current code, the current
held-out set -- is read Best in 95% of its reads: 31 of 32 (16 asks, two
readers). 30 of 32 is 93.8% and is not it.

**Why:** the user set the bar; every lesson Best from both readers is not
required, and each further fix had come to buy one lesson's sentence.

**How to apply:** after each blind read, count Best of 32 for the newest
batch once it is unblinded against `lesson-ab.mjs`'s key (the `after`
rows of both readers). At 31 or more, write its scoreboard row, push,
and stop the loop and say so; below it, keep fixing what the reads
name. Related: [[language-goal-finish-line]].
