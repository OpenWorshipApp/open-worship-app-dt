---
name: mcp-model-hidden-tools
description: "19 of the 44 MCP tools are withheld from the chatbot's model by tools/owa-devtools-mcp/modelTools.mjs — filtered AND refused, because a filtered list alone is only a suggestion"
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

The four groups and the reason each gets told live in that file. `owa_click`
and `owa_type` must never join them — they are the model's only way to act, and
the only presses the interlock can read ([[mcp-uid-interlock]]).

`audit-mcp-tools.mjs` reports both bills and prints a withheld tool as
`(name)`; reporting only the host's total is how a tool added "for the
developer" ends up billed to every volunteer.

Related: [[agent-access-mcp-chatbot]], [[chatbot-attachments]].
