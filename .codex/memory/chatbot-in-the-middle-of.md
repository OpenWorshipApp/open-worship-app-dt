---
name: chatbot-in-the-middle-of
description: "The assistant knows what the user is in the MIDDLE of since 2026-09-09 — the selected document, its slides and the next one ride owa_app_state, a slide card is pressed by its own aria-label, and Claude Sonnet 5 thinks out of max_tokens by default"
metadata: 
  node_type: memory
  type: project
  originSessionId: 80c1f239-1ff0-498d-90b6-ab52c79809aa
  modified: 2026-09-09T19:44:28.270Z
---

Measured 2026-09-09 on Claude Sonnet 5 after the standing corpus passed
12/12: with *Amazing Grace* highlighted in the Documents list and a Khmer
hymn on the off screen, *which song is selected?* was answered with the
hymn (the only document any tool had named), and *show the next slide* ran
to the ten-round cap — six `owa_list_ui` hunts for slide cards that had NO
accessible name, a 200-row dump (34 574 tokens into the cache), a press on a
slide's `Index: 5` badge that changed the projector, then *"I could not find
an answer for that"*. Per-round content captured off the wire showed WHY the
last line: every Sonnet 5 round carries a `thinking` block by default, and
the final round spent the whole 2 000-token `MAX_TOKENS` thinking with no
text.

Now `owa_app_state` on the Presenter carries `selectedDocument` (name, kind,
slides with number / name / first words / `onScreens`, and `onScreen` /
`next` / `previous` the arrow keys' way) over the `owa-agent-presenter`
relay (`src/helper/agentPresenterHelpers.ts`, lazily imported; a song read
through its stage-0 instance — the base `LyricAppDocument` has empty
canvases and no attachment slide); every slide card carries `aria-label`
(`toSlideAccessibleName`, one function for the DOM and the field's `find`);
`owa_click "Slide 5: …"` PRESENTS that slide; `/selected`, `/next`,
`/previous` do it with no model; the offline bot answers from the field.
The Anthropic loop has `ANTHROPIC_MAX_TOKENS` 6 000 + `effort: "low"` and an
honest "ran out of room" fallback. `EC-128`, `EC-129` in the chatbot
backlog; `EC-130`–`EC-135` filed.

**Why:** "answered only by inference" is a missing FIELD, not a prompt rule
(the lesson of [[chatbot-grade-panic-in-both-states]] again), and a card with
no accessible name is invisible to every tool that lists controls. A budget
set before a model thought by default silently becomes a thinking budget.

**How to apply:** an `/owa-enhance-chatbot` run that grades the rung-5
shapes sets the selection to DIFFER from what the screen holds (click another
song, keep the screen's slide) before asking *which song is selected* / *show
the next slide*, and follows the confirmation through. The driver
(`ask-corpus.mjs` in [[chatbot-cdp-driver-gotchas]]) records each round's
content block types — read them whenever an answer is the fallback sentence.
A control an agent must press needs an accessible name the state hands over
verbatim. The run sheet is the next field of this shape (`EC-132`). Related:
[[click-reports-effect-not-action]], [[mcp-model-hidden-tools]].
