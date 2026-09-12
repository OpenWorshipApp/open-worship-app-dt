---
name: kimi-free-tier-round-budget
description: "Kimi on Moonshot's free tier affords ~3 chatbot rounds a minute (~11k tokens a request against ~32k a minute) - a follow-up inside the minute is a 429 and the OFFLINE bot is what the user actually gets; grade on the user's own assistant and follow a chip through"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7e78f17c-0c5c-4a56-b18a-3a7634da32e6
  modified: 2026-09-08T20:05:06.516Z
---

Measured 2026-09-08 on the user's own Kimi account (`msh-gid: free` on the
429 response): every chatbot request is ~45 KB — 30 KB of tool schema (29
tools, ~7 300 tokens), a 13.5 KB system prompt (~3 300 tokens), the history —
so ~11k tokens a round, and the free tier allows roughly 32k tokens and 3
requests a minute. A two-round question followed by ANY message inside the
minute (the paste the *make a song* chip invites, a "yes") is refused: three
retries in 3.6 s (`retry-after: 1` — the SDK honours it, but the window is a
minute), then the offline manual bot. `EC-100` in the chatbot backlog holds
the numbers; `EC-96` made the offline bot draft a lyric paste itself, so that
one shape survives; every other follow-up still dies on the free tier.

**Why:** every scoreboard row before this one graded ONE question on Claude
Sonnet 5 with a paid key, where the chips pass. The user's window was set to
Kimi K2.6, and the failures were all on the SECOND message of the flow a chip
starts — a paste after the chip, a pill under a draft — which a single graded
answer on a paid key cannot see.

**How to apply:** an `/owa-enhance-chatbot` run grades on the assistant the
user's window is set to (read the head row), spaces Kimi asks ~60 s apart or
expects 429s, and follows each chip through to the press a volunteer would
make next. Kimi K2.6 also thinks for 15–60 s a question under the deliberate
6000-token budget; that is the model, not a hang. Related:
[[free-keyless-chatbot-provider]], [[kimi-third-llm-provider]],
[[chatbot-cdp-driver-gotchas]].
