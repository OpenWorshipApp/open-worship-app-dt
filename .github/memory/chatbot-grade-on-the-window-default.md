---
name: chatbot-grade-on-the-window-default
description: "Grade the chatbot on the provider its window is SET to before picking a key by hand - the default was a dead ChatGPT key for a week and every question took the degraded path; a dead key now hands the question to the next key of the user's own (askLlmBot standIn)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ab1d0b32-ecdb-4353-9854-1d44934793d5
  modified: 2026-09-10T02:07:01.980Z
---

The help window's stored default assistant (`chatbot-llm-provider`) was a
ChatGPT key out of credit from 2026-09-02 to 2026-09-09. Eleven scoreboard
rows in between were graded on Claude Sonnet 5 picked by hand in the driver,
so none of them saw what a volunteer got: three identical 41 KB posts on
`insufficient_quota`, 3–5 s, then the offline bot under an apology, on
EVERY question, with a live Claude key one option along.

**Why:** the degraded path is where the worst answer lives, and a corpus
graded on the best key stops measuring it. Since 2026-09-09 `askLlmBot`
stands in with the next provider whose key is set on a provider fault
(401/403/429/5xx, never a 400 or a no-network error), the tab moves to it and
the note says so; Free is never on either side of the stand-in. The
OpenAI-shaped loop posts with `maxRetries: 0`.

**How to apply:** the first ask of an `/owa-enhance-chatbot` run goes to the
window as found (`ask-corpus.mjs` with no `--provider`); read the head row
and the note on the first answer before choosing a provider to grade on. To
reach the offline bot with live keys present, cut the chatbot window's
`fetch` for every host off the machine (`--offline` in the driver) — a
no-status error is the one failure the stand-in deliberately does not take.
An offline-bot fix must be re-asked through the window: the manual bolds
its control names (`**Documents** list`), and a test written in plain words
passes where the live answer misses. Related:
[[chatbot-cdp-driver-gotchas]], [[chatbot-grade-panic-in-both-states]],
[[chatbot-wrong-window-route-is-a-page-fact]].
