---
name: bedrock-llm-provider
description: "Amazon Bedrock in the chatbot — nine models on one /openai/v1 route, per-vendor request rules, per-model regions, and why an agent must not handle the key"
metadata:
  node_type: memory
  type: project
  originSessionId: 029805b0-9f47-4d9c-b38b-fed0e2ab561c
  modified: 2026-10-09T16:32:23.568Z
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
