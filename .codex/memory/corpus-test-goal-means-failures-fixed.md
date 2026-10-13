---
name: corpus-test-goal-means-failures-fixed
description: "for \"test all chatbot questions\", the user's goal is met when the failing answers are fixed and re-tested, not when they are graded and filed — plan test → fix → re-test, and ask \"is the goal met?\" with the numbers"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5b07f182-3f35-46de-a795-58cdc0a98502
  modified: 2026-10-12T21:43:05.030Z
---

When the user sets the goal _test all chatbot questions_ (all pages, a named
assistant), asking and grading every corpus row is the first half. The goal
is met when the answers that FAIL have been fixed where a fix exists — code,
passage labels, the missing guide text — and asked again. Filing them in the
backlog is not the end of it.

**Why:** 2026-10-12, the user was asked twice. To _what should count as
done?_ they chose _Asked, graded, filed_. To _under that bar, is your goal
met?_, put with the numbers a few minutes later (415 of 415 asked and
graded, 36 failing and filed), they chose _No, fix failures first_. The
second answer stands. (The session's own reading: the first question read
as "what is this run's output", the second as "may you stop" — and only the
second is the one that matters to them.)

**How to apply:** plan such a run as test → fix → re-test from the start,
and budget for the fixing. When a goal check and the request can be read
two ways, ask ONCE, early, and ask whether the goal would be MET — with the
figures — rather than what the bar is. Rows that act on the app are part of
"all": run them, put back what they make with the app's own undo, and for
anything on a screen get the user's word first. See
[[corpus-run-in-a-shared-dev-app]].
