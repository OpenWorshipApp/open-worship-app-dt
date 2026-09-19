---
name: guide-stuck-step-rescue
description: A walkthrough step the card cannot press asks the chatbot over a DOM-event relay; the answer lands on the CARD, and the model is held to a `DO:` frame because a prohibition alone does not hold
metadata:
  type: project
---

A guide step the card cannot perform no longer apologises. It fires an
`owa-guide-help` DOM event → `all:app:guide-help` (`src/helper/domHelpers.ts`)
→ `askGuideHelp` (`electron/electronHelpers.ts`) → the chat window, which asks
the model with the live app in front of it and sends one line back the same way.
68 of the manual's 251 steps (27%) used to end at that apology — a double-click,
a drag, something only to be watched, a control not on screen yet.

Three things that are decisions, not details, and will look wrong if you assume
otherwise:

- **The answer is drawn on the CARD, and the chat window is never restored to
  deliver it.** That window is minimised for the length of a walkthrough
  ([[guide-tucks-help-window]]) and the user is looking at the app; bringing it
  back would cover the control the answer is pointing at. The transcript keeps
  the exchange for afterwards.
- **The model is held to `DO: <instruction>` and the code parses the marker
  out.** Told plainly not to report its own looking, Haiku 4.5 still opened
  three answers in four with "I can see the verse …", and one spent its whole
  answer on it. This is [[knowledge-label-i18n-templates]]'s and EC-21's lesson
  one layer up: enforce in code, do not ask. Missing marker keeps the whole
  text — half an answer on a card is worse than a wordy one.
- **What the model is TOLD is not what the user is SHOWN.** `handleAsking` takes
  `shownText` (the human summary that goes in the transcript) and `formatAnswer`
  (applied once, so the card and the chat bubble say the same words). Both were
  added after live runs leaked the machine prompt and then the raw `DO:` frame
  into the window. Any future turn the app asks on the user's behalf needs both.

The steering all rides the rescue QUESTION, not `genSystemPrompt` — a user turn
costs nothing on the other 99% of questions, while the system prompt is re-sent
on every round of every one. No new MCP tool: the card talks over the app's own
relay, so the tool surface stayed at 44 and 0 extra tokens/round
([[agent-access-mcp-chatbot]]).

Two things a rescue must NOT inherit from an ordinary question, both found by
measuring rather than by reading:

- **The tab's chat history** (`withoutHistory`). It fills with earlier rescues,
  and the model repeats its own previous answer instead of looking.
- **The offline manual bot** (`withoutOfflineFallback`). With the Anthropic key
  out of credit every rescue threw and fell through to it; handed a
  machine-written prompt it matched "nothing on screen" and answered *"No
  presentation screen is showing right now"* — identically, 10 times out of 10,
  drawn on the card as the answer. A rescue the model cannot answer now reports
  `unavailable` and the card's own plain instruction stands. **An assistant that
  degrades must degrade toward silence, not toward confidence** — and a 100%
  failure rate is as likely to be billing as it is to be the model.

Failure rate is tracked, not eyeballed:
`.claude/skills/owa-enhance-chatbot/scripts/rescue-failure-rate.mjs`.

Fires from `act()` only — the **Do it** press. Ordinary "show me" mode has the
same dead end with no button to hang it on (backlog `EC-40`).
