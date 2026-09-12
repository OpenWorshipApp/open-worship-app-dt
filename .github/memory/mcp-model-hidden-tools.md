---
name: mcp-model-hidden-tools
description: "The chatbot's model is offered the 19 owa_* tools and NOTHING of chrome-devtools' (29 of 48 withheld by tools/owa-devtools-mcp/modelTools.mjs) — filtered AND refused; the last ten went after press_key put the projector on unasked"
metadata: 
  node_type: memory
  type: project
  originSessionId: bf38e379-ea3a-4f16-a163-451460ad6c66
  modified: 2026-09-01T22:37:09.530Z
---

**The host's tool bill and the model's tool bill are different numbers.**
`tools/owa-devtools-mcp/modelTools.mjs` is where that split is declared — plain
ESM with no `node:fs`, so the renderer bundles the module the audit script
reads, the same pattern as `botFocus.mjs` and `questionMatch.mjs`. It was
`CLIENT_ONLY_TOOL_MAP` inside `llmBotHelpers.ts` with 3 names until 2026-09-02.

Measured that day: **44 tools / ~9 468 tokens per round at the host, 25 /
~5 721 to the model** — ~32 000 tokens off a worst-case ten-round question.
Everything stays registered on the server, so the developer's stdio door is
whole; what is withheld is withheld from the MODEL, which is the untrusted
party.

Two things that were only visible once someone looked:

- **A filter is not a rule until the call is refused too.** `runMcpTool` called
  whatever name the model returned, and these tools are named in the app's own
  manual — which the model can read. So "the assistant does not get to reach
  for a camera on its own" was a comment, not a rule. It now refuses with a
  sentence saying what to use instead, the same shape the firewall answers
  with, and `llmBotHelpers.test.ts` holds both halves.
- **Check for the sibling.** `owa_screenshot` was withheld for a stated reason
  while `take_screenshot` sat in the list beside it doing the same job.

The six groups and the reason each gets told live in that file. `owa_click`
and `owa_type` must never join them — they are the model's only way to act, and
the only presses the interlock can read ([[mcp-uid-interlock]]).

**2026-09-08: nothing of chrome-devtools' reaches the model any more** (29 of
48 withheld; 19 `owa_*` offered). The last ten — `press_key`, `handle_dialog`,
`take_snapshot`, `list_pages`, `select_page`, `wait_for`, the two console and
two network readers — were kept "in case", and the standing corpus showed the
case: asked *Nothing is showing on the projector*, Sonnet 5 pressed **F5
through `press_key` on two windows** and the screen came on with nobody
asking; asked *the words no come out big screen*, it took three
`take_snapshot`s (~8 400 tokens each), read the console, ran to the ten-round
cap and answered "I could not find an answer for that" after 72 s and 225 000
tokens. A grep of every score file: no chrome-devtools tool had ever been
called on an answer that PASSED. Two things to keep straight: the Report
button still reads the console for itself through `callTool`, which the model
filter never sees; and this is a denylist held by `modelTools.test.mjs` and
the audit script, so a chrome-devtools-mcp upgrade that adds a tool offers it
to the model until it is named there — run the audit after any upgrade.
`owa_click` also now refuses a match that is not called what was asked (the
guide card's `isPressSafe` bar): "show screen" had matched the Bible Lookup's
save-and-present button, and a press there would have put a verse on the
wall.

`audit-mcp-tools.mjs` reports both bills and prints a withheld tool as
`(name)`; reporting only the host's total is how a tool added "for the
developer" ends up billed to every volunteer.

Related: [[agent-access-mcp-chatbot]], [[chatbot-attachments]].
