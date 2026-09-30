---
name: chatbot-progress-log
description: The chatbot narrates the wait step by step; phrases are hand-written per tool and the step ids must be module-global
metadata:
  type: project
---

The chatbot's waiting line is a LOG of what it is doing, not one unchanging
`Looking it up…` sentence — `src/chatbot/progressHelpers.ts`, fed by
`AskExtraType.onProgress` through `runMcpTool` and both provider loops in
`llmBotHelpers.ts`, drawn by `RenderChatProgressComp`.

**Why:** a question that reads a web page and drafts a song takes most of a
minute, and one static line cannot tell a window that is working from one that
has hung — so the only strategy it taught a volunteer was to press Stop and
start again, which is the worst move 50 seconds into a 55-second job. Reported
from the app with a screenshot mid-answer (2026-09-04). It also answers a second
question nobody had asked out loud: *is it doing what I meant?* — a step reading
`Reading <some site>` or `Pressing "…"` is where a wrong turn becomes visible.

**How to apply:**

- A step's words are **hand-written per tool** in `describeToolStep`, never
  derived from the tool name. All 29 model-visible tools are mapped; an unmapped
  one falls back to `Looking something up`. A test fails on an underscore
  reaching the line — printing the tool name is the cheap implementation and it
  breaks the window's one rule (see [[knowledge-label-i18n-templates]] for the
  same rule applied to control labels). Adding a tool to the server means adding
  a phrase here.
- Step ids come from a **module-level** counter. One question builds two
  reporters (the `listTools` connect, then the provider loop) and a finishing
  step is matched to its start by id, so per-reporter counters both starting at
  zero make round 1 overwrite the connect line instead of following it.
- Open a step before the work and close it in a `finally`, or a round that
  throws leaves a line breathing under a finished answer.
- It rides its **own module store**, not `ChatbotAppComp`'s state: the line sits
  under the conversation and a twenty-step question would re-render the whole
  message list twenty times (see [[chatbot-ask-history-and-tips]], where the tip
  line is its own component for the same reason).
- Cleared when an ask starts, when the last one ends, and at a Stop
  ([[chatbot-stop-answer]]).
