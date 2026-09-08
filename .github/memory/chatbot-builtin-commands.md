---
name: chatbot-builtin-commands
description: A line starting with / in the chatbot's ask box is a built-in command run through the app's own tools with NO model, no key and no history; the button under its answer is a pseudo tool a model cannot fire
metadata:
  type: project
---

The chatbot window takes **commands** (2026-09-02,
`src/chatbot/builtinActionHelpers.ts`): `/screen`, `/screen-show`,
`/screen-hide`, `/clear-all` … `/clear-foreground`, `/find <words>`,
`/goto <page>`, `/here`, `/help <words>`, `/commands`, plus aliases such
as `/presenter-screen-show`. `handleAsking` runs them BEFORE any provider is
looked at — no model round, no history, attachments left in the box, ~1.6 s.
Typing `/` lists them in the same suggestion list as the questions
(`SuggestRowType`; a command with no argument asks on the press).

**Why:** measured on the standing corpus the afternoon three of the four
providers answered 429 within an hour — the offline bot the window fell back
to got 4 of 12 and could describe the screen but not touch it. The user asked
for "built-in actions so the user does not have to ask the LLM".

**How to apply:** a new command goes in `BUILTIN_ACTION_LIST` and must
(1) read the effect back after acting (screens before AND after), (2) never
let a tool's error text reach the user, (3) never be startable by a model —
`BUILTIN_TOOL_NAME` (declared in `helpBotHelpers`, because the offline bot
offers *Turn the screen on* itself) is a pseudo tool the server never
registers, caught in `handleActing`. Typing the command IS the consent, so the
offered-never-done rule for the congregation's screen does not apply to it.
Related: [[click-reports-effect-not-action]], [[chatbot-answer-options]],
[[chatbot-cdp-driver-gotchas]].
