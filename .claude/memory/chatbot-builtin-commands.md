---
name: chatbot-builtin-commands
description: "A line starting with / in the chatbot's ask box is a built-in command run through the app's own tools with NO model, no key and no history; the button under its answer is a pseudo tool a model cannot fire. The one exception is `/btw <words>`, a general question put to the model with no tools"
metadata:
  node_type: memory
  type: project
  originSessionId: 16780dd5-d3fa-4663-8b19-127ebf319066
  modified: 2026-10-10T15:06:55.940Z
---

The chatbot window takes **commands** (2026-09-02,
`src/chatbot/builtinActionHelpers.ts`): `/screen`, `/screen-show`,
`/screen-hide`, `/clear-all` … `/clear-foreground`, `/find <words>`,
`/goto <page>`, `/here`, `/help <words>`, `/commands`, plus aliases such
as `/presenter-screen-show` — and since 2026-09-10 `/lyric <address>` (a
song from a page, no model; see [[chatbot-lyric-command]]). `handleAsking` runs them BEFORE any provider is
looked at — no model round, no history, attachments left in the box, ~1.6 s.
Typing `/` lists them in the same suggestion list as the questions
(`SuggestRowType`; a command with no argument asks on the press).

**`/btw <words>` is the one slash line that DOES go to a model** (2026-10-10,
the user's ask: _add command `/btw` to let assistant know it about asking
general question, e.g. `/btw "what is holy bible"`_). `readGeneralQuestion`
reads the words (quotes taken off) and `handleAsking` takes the ordinary
model road with `AskExtraType.isGeneral`: the ask is the words plus a frame
in the USER turn (`toGeneralQuestionAsk` — never the cached system prompt),
ONE round, NO tools (the MCP session is not opened, so no _Connecting to the
app_ step and no tool schemas), no known-question hint, no reader-button
shortcut. The transcript shows what was typed. With no assistant, or one
that fails, the answer says a general question needs an assistant and
offers **Open AI settings** — the guide never answers it. The bare `/btw`
runs as a command and says how to use it; `/commands` names it as the
exception; aliases `/general`, `/anything`.

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
