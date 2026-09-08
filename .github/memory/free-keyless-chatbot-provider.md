---
name: free-keyless-chatbot-provider
description: The chatbot answers with no API key via two public free services; free models are differently broken, not just weaker
metadata:
  type: project
---

The chatbot has a fourth provider, `Free`, that needs no API key: **LLM7**
(`api.llm7.io/v1`, the default) and **Kilo Code** (`api.kilo.ai/api/gateway`),
both keyless and both speaking OpenAI's protocol, so they ride the existing
`askOpenAiCompatible` loop. Added 2026-09-01 from `awesome-free-llm-apis`.

**Why:** every other provider was somebody's paid account, so a fresh install —
the state most churches stay in — had only the offline manual search, which
cannot converse, look at the app, or walk anyone through anything.

**How to apply:**

- The mechanism is `keyField` being UNSET on `LLM_PROVIDER_MAP.free`. Unset
  means always-available; the map's ORDER puts it last, so a real key still
  wins and a keyless install lands on it by itself. Do not "fix" that into a
  flag or a default.
- **The service is a property of the MODEL**, not of the user's choice —
  `getFreeService(model)` resolves it and `getInstance` takes the model. One
  memoised client per service; never one client with a swapped `baseURL`.
- Of the 17 providers on that list only three are keyless, and only two can
  call a tool at all — which is the only capability this bot cannot work
  without. **OVHcloud is unusable**: 2 RPM per IP, and it answers 429 while
  idle. Verify tool-calling with a real request before ever listing a model.
- Only `stepfun/step-3.7-flash:free` (Kilo) can see a picture. LLM7's keyless
  tier is text-only throughout.
- *More models…* is hidden for this provider on purpose: both hosts DO answer
  `models.list`, with catalogues that are mostly paid and mostly toolless.

**Free models are differently BROKEN, not merely weaker** — none of these
happen on a first-party API, and all three were found by grading the standing
corpus through the real 44-tool loop before wiring anything:

- A gateway leaks harmony channel markers INTO the function name
  (`owa_list_ui<|channel|>commentary`) — 4 calls in 8 questions, each a wasted
  round. `toCleanToolName` cuts at `<|`.
- Round exhaustion: one question spent all 10 rounds and ~79 000 prompt tokens
  producing NOTHING. Against a ~500 000-token daily allowance that is a sixth
  of the day. `maxToolRounds` is 6 for this provider.
- A 429 arrives MID-question, after the tools have already found the answer.
  Throwing discards it, so one tools-less salvage round runs instead.
- "ALWAYS answer in English" holds in the prose and fails in the `OPTIONS:`
  line — a live answer carried a button reading `请确认显示这个按钮`.
  `checkIsReadableReply` drops an option with **no Latin letter at all**, which
  deliberately keeps one naming a translated button
  ([[knowledge-label-i18n-templates]]).

The risk is stated, never assumed: a sticky warning at the top of the log (an
ordinary paragraph scrolled away after one exchange) and the same words in
Settings while no key is set. Both **name the services and link to their own
sites** off `FREE_SERVICE_MAP`, so they cannot drift apart — these are the only
providers the user has no account with. In Settings do NOT reuse
`RenderOpenPageButtonComp` for them: it `tran()`s its label and title, and
`tran()` THROWS on a missing key in dev, so a brand name or a URL through it
blanks the panel in Khmer ([[tran-missing-key-throws-in-dev]]). Related: [[agent-access-mcp-chatbot]],
[[kimi-third-llm-provider]], [[chatbot-answer-options]].
