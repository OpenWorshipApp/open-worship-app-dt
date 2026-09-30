---
name: chatbot-grade-panic-in-both-states
description: "A passing corpus stops measuring - grade the projector questions with the screen ON and holding content, and press the \"yes\" under the panic answer; the screens tool answers what each screen HOLDS since 2026-09-09"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 665fa4b2-bf51-48fa-9a5c-d2694912b632
  modified: 2026-09-09T17:07:21.816Z
---

Measured 2026-09-09: the standing chatbot corpus passed 12/12 on Claude
Sonnet 5, and every state question had only ever been graded with the
screen OFF, where "nothing is showing" is the whole answer. Re-asked with the
projector SHOWING a verse, the assistant said *"turning the screen on just
gives you a blank canvas"* (9 rounds, 36 s) and *"yes, the screen is on"*
with not a word about what; pressing **Yes, turn it on** under the panic
answer took 8 rounds, a wrong press (`0 Screen: 0`) and a doubled label.
`owa_list_screens` now answers `screens[]` (what each screen holds, showing
or not), `controls` (the exact words on its show/hide and Clear buttons) and
`previewCard` (where the Mini Screen panel is) — `EC-124` in the chatbot
backlog; the same asks pass and the "yes" is 3 rounds.

**Why:** a corpus that passes is a corpus that has stopped measuring. The
failure was one press away and one state away from every graded answer, and
"answered only by inference" was a missing FIELD, not a prompt rule.

**How to apply:** an `/owa-enhance-chatbot` run grades the panic shapes in
BOTH screen states (off with a slide held; on with a slide showing — put a
lyric slide on screen 0 first) and follows the offer through by pressing the
reply chip; the driver pattern is `ask-corpus.mjs` + `follow.mjs` in
[[chatbot-cdp-driver-gotchas]]. Verify the screens tool against the app's
own host (`isAnyShowing` alone is the OLD shape). Related:
[[click-reports-effect-not-action]], [[mcp-model-hidden-tools]].
