---
name: bedrock-llm-provider
description: "Amazon Bedrock in the chatbot — nine models on one /openai/v1 route, per-vendor request rules, per-model regions, and why an agent must not handle the key; which host serves Claude (bedrock-runtime, not Mantle), Nova (neither) and the open models (/v1 vs /openai/v1) — Haiku 5.5 is the best fit at the lowest cost"
metadata:
  node_type: memory
  type: project
  originSessionId: 029805b0-9f47-4d9c-b38b-fed0e2ab561c
  modified: 2026-10-11T21:19:33.920Z
---

Amazon Bedrock became the fifth chatbot provider on 2026-10-09
(`src/helper/ai/bedrockHelpers.ts`, the OpenAI SDK pointed at
`bedrock-mantle`), first for Gemma 4 31B and the same day for every chat model
the user's catalogue showed. Read off each model's AWS card that day, not
remembered:

- **One route, `/openai/v1`.** Most models on `bedrock-mantle` answer under
  `/v1`, but every one in the list — Gemma 4, GPT-6 Astra, GPT-5.6 Terra/Luna,
  GPT-5.4, Grok 4.3/4.6 — is served under `/openai/v1`, and `/v1` refuses
  them ("isn't supported on this route"). Palmyra Vision 7B is the odd one
  (`/v1`) and is LEFT OUT anyway: a 4K context cannot hold the tool list.
- **No *More models…***: `/openai/v1/models` answers 404 with an empty
  body (measured live 2026-10-09), and `/v1/models` would name models this
  route refuses — so the list is closed (`isModelListClosed`, like Free) and
  a new model is a new row in `BEDROCK_MODEL_LIST`.
- **Each vendor brings its own request rules**, told apart by the id prefix
  so a row added later gets them with no new code: `openai.*` refuses `max_tokens`
  (→ `max_completion_tokens` + `reasoning_effort: low`); `xai.*` names
  `max_completion_tokens` on its card and reasons at `low` by default;
  `google.gemma-4*` takes ONE tool call per turn (`parallel_tool_calls:
  false`, sent beside `tools` only — OpenAI refuses it on a tool-less last
  round), and E2B wants `reasoning_effort: high` or its reasoning leaks into
  the answer.
- **Each model is served in its own regions**, and the user picks ONE:
  Grok 4.6 is us-west-2 only, GPT-6 Astra skips us-east-2, Frankfurt has the
  Gemmas only. `findModelProblem` refuses a mismatch BEFORE the round is
  paid for, as a 400 (so no stand-in key hides it) naming the region to pick.
  us-west-2 is the default because it serves all nine.
- **The region list and the CSP move together**: each region is its own host
  in `html/chatbot.html`'s `connect-src` (never `*.api.aws`, which is every
  AWS service); `aiHelpers.test.ts` reads the HTML and fails on a region the
  CSP does not name.
- **Ordered by recommendation, not capability**: on this route OpenAI models
  get no prompt caching on Chat Completions (Responses only), a round is
  ~16 000 tokens, and the spend guard stops at $1/hour — so GPT-6 Astra
  ($11/$55) sits sixth. Not yet graded on the question corpus.
- Prices are the US Standard In-Region rates; where AWS publishes no cached
  rate a cached token is priced as a full one (errs high).
- The key is a bearer, no SigV4: long-term `ABSK` + base64 (`BedrockAPIKey-…`
  or `MantleApiKey-…` inside), short-term `bedrock-api-key-` + a presigned
  URL. Both are in the firewall's `SECRET_PATTERNS`; `sk-` never matched them.

**"Could not be reached" is any error with no HTTP status**, a JavaScript
one included — not only the network. The first live Bedrock ask failed that
way while `llmBotHelpers.ts` was being edited under the dev server's hot
reload (a call landed before its import did); the route itself answered fine.
And the chatbot renderer runs with `webSecurity` off in dev, so CORS is not
what a dev failure is; `fsServe.ts` also rewrites CORS headers on every
external response (Bedrock's preflight `allow-headers: *` does not cover
`Authorization` by itself).

**An agent must not materialise or send a user's API key itself.** Given a
key in chat, writing it to a scratch file and `curl`-ing the endpoint with it
were both blocked by the harness (credential materialisation / exfiltration).
The key goes in through Settings → Others → **Amazon Bedrock API Key**, typed
by the person, into `appSecureStorage`; the app makes the call.
Related: [[kimi-third-llm-provider]], [[secure-storage-safestorage]],
[[free-keyless-chatbot-provider]], [[chatbot-spend-guard]].

**Which Bedrock host serves what** (read off AWS's own model cards and the
endpoints page, 2026-10-11, asked _find aws bedrock the best fit the chatbot
and lowest cost_). Bedrock has TWO hosts and the app uses one:
`bedrock-mantle.<region>.api.aws` (the chatbot's `/openai/v1` client) and
`bedrock-runtime.<region>.amazonaws.com`. Both take the same `ABSK` key
(`Authorization: Bearer`; `x-api-key` on the Anthropic route) and bill the
same per token; only the runtime host does cross-region (`global.`/`us.`) ids.

- **Claude is NOT on the route the app has.** Every Claude model is served on
  the Anthropic Messages API — `…/anthropic/v1/messages` — never on Chat
  Completions, and Haiku 5.5, Sonnet 5.5 and Fable 5.1 are on `bedrock-mantle`
  in GovCloud ONLY. Everywhere else they are `bedrock-runtime`, cross-region ids
  only: `global.anthropic.claude-haiku-5-5` (Global ✓ from all four regions the
  app lists; `us.`/`eu.` geo ids too), the Anthropic SDK at
  `baseURL: https://bedrock-runtime.<region>.amazonaws.com/anthropic` with the
  ABSK key as `apiKey` (AWS's own sample). Prompt caching (512-token minimum;
  system, messages and tools), tools, vision and adaptive thinking (effort
  default `medium`) are all on that route, so `askAnthropic` would serve it as
  it is; the chatbot CSP needs the four `bedrock-runtime` hosts added.
  **Haiku 5.5** (launched 2026-10-07): $0.10 in / $0.50 out per 1M tokens
  (Global; US geo $0.11/$0.55), cache read $0.01, 5-minute write $0.125, for
  prompts ≤100K; 1M context, 128K output. About $0.002–0.004 for a three-round
  question with the prefix cached — the best fit at the lowest cost on Bedrock
  for this window (the one model of Claude's class at Gemma's price). Not yet
  measured on the corpus; the first live ask must show
  `cache_read_input_tokens` on round 2 and confirm the key header.
  **Wired the same day** (the user: _add to model list for me_, then _name
  it as best recommend_): `src/helper/ai/bedrockClaudeHelpers.ts` is the
  Anthropic SDK at that base URL with the Bedrock key as `apiKey`, its own
  module so Settings never pulls the SDK; `askAnthropic` became
  `askAnthropicCompatible(provider, …)` over an `AnthropicCompatProviderType`
  (`ANTHROPIC_PROVIDER`, `BEDROCK_CLAUDE_PROVIDER`), and the Bedrock entry of
  `LLM_PROVIDER_RUNTIME_MAP` sends a `BEDROCK_CLAUDE_PATTERN` id down that
  loop and everything else down the OpenAI one; the row is FIRST in
  `BEDROCK_MODEL_LIST`, labelled _Claude Haiku 5.5 (best recommended)_, with
  `regions: BEDROCK_ALL_REGIONS` (Global id), a `MODEL_PRICE_MAP` row, the
  image map widened, and `html/chatbot.html` naming the four
  `bedrock-runtime` hosts (the CSP test holds them beside the Mantle ones).
  Unit-tested on a fake client; NOT yet asked live — that press is the
  user's, and its usage line is the proof (round 2 reads, the key accepted).
- **Nova (Micro, Lite, Pro, 2 Lite) is Converse/Invoke on `bedrock-runtime`
  only** — no Chat Completions, no Mantle — so it would need a whole Converse
  client, and Nova 2 Lite ($0.30/$2.50) costs more than Gemma 4 31B anyway.
- **The open models on Mantle sit on two paths**: Gemma 4, the GPTs and Grok on
  `/openai/v1`; Nemotron, gpt-oss, Qwen3, MiniMax, DeepSeek and Mistral on
  `/v1` (the OpenAI SDK's `withOptions({ baseURL })` can pick it per model).
  Nemotron Nano 3 30B (`nvidia.nemotron-nano-3-30b`, $0.06/$0.24, 256K,
  client-side tool calling ✓, text only, us-west-2 in-region) is the cheapest
  unmeasured candidate for the OpenAI loop; Gemma 4 31B stays the cheapest
  measured one ($0.004 a question, one run). Related: [[chatbot-cost-measured-on-the-wire]].
