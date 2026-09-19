---
name: chatbot-cost-measured-on-the-wire
description: "Measure the chatbot's cost off the provider's usage fields, not the audit's estimate — the audit counts ~7 400 tokens of schema a round, Anthropic billed ~15 900 for the prefix; since 2026-09-08 the Anthropic loop is prompt-cached and cache_read_input_tokens is the only proof it still is"
metadata:
  type: project
---

Measured 2026-09-08 on the standing corpus (Claude Sonnet 5, 12 questions):
**44 rounds, 813 445 input tokens, every one billed at full price** — $1.63 at
list — with ~15 900 of the ~16 000 tokens a round costs being the tool
schemas plus the system prompt, byte-identical across every round of every
question about the same window. The audit script
(`.claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs`) had put
the model's schema at ~7 400 tokens a round: its chars-per-token estimate
undercounts the provider by about half. After prompt caching (`askAnthropic`
in `src/chatbot/llmBotHelpers.ts`: an explicit `cache_control` on the system
block, which caches tools + system for the NEXT question too, plus the
request-level automatic breakpoint for the growing conversation; the last
round keeps its tools under `tool_choice: none` so the prefix does not change
at byte zero) the same corpus was 31 rounds, 62 full-price tokens, 41 613
written at 1.25× and 401 601 read at 0.1× — $0.18. Moonshot caches Kimi's
prefix on its own (`prompt_tokens_details.cached_tokens: 8192` on round 2);
OpenAI caches a ≥1 024-token prefix on its own.

**Why:** an estimate cannot show a regression. The healthy signature is round
1 reading ~13 000 and writing ~85 (the question), round n reading everything
so far and writing only the last delta; `cache_creation_input_tokens` near
the whole prefix on EVERY round means something per-question got into the
system prompt (a date, the screen state) or the tool list stopped being
deterministic, and nothing else will say so — the requests keep succeeding,
the bill is just higher.

**How to apply:** the corpus driver (`ask.mjs`, [[chatbot-cdp-driver-gotchas]])
captures `usage` off each provider response over CDP `Network.getResponseBody`;
any `/owa-enhance-chatbot` run quotes those fields for a cost claim, and any
change to `genSystemPrompt` or the tool list re-checks that round 2's
`cache_read_input_tokens` is still ≥ the prefix. Related:
[[mcp-model-hidden-tools]], [[kimi-free-tier-round-budget]].
