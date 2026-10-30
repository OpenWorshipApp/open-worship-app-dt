# Amazon Bedrock for the chatbot: which model, which host, what it costs

_Researched 2026-10-11 against AWS's own model cards, its endpoints page and
its pricing page, for the question "find the Bedrock model that is the best
fit for the chatbot at the lowest cost". Nothing here was measured on the
chatbot except where a run is named; prices are the Standard tier in the US
regions, per 1M tokens, as read that day. Re-read the cards before relying on
a number: this page is a snapshot, not a feed._

**Short answer: Claude Haiku 5.5.** It is the one Bedrock model of Claude's
class at an open-model price, it takes tools, pictures and prompt caching, and
with the chatbot's cached prefix a question costs a fraction of a cent. The
catch was that it was not on the route the app's Bedrock provider used, so
it needed a small code change (section 6) — done the same day.

## 1. Two hosts, and the app talks to one of them

| Host                                     | Who the app sends there                                                                                   | APIs                                                                                                        | Cross-region ids              | Key                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `bedrock-mantle.<region>.api.aws`        | the chatbot's Bedrock provider: `src/helper/ai/bedrockHelpers.ts`, the OpenAI SDK pointed at `/openai/v1` | Chat Completions, Responses, Anthropic Messages (`/anthropic/v1/messages`)                                  | no                            | the `ABSK…` key as `Authorization: Bearer` (`x-api-key` on the Anthropic route) |
| `bedrock-runtime.<region>.amazonaws.com` | Claude Haiku 5.5 since section 6: `src/helper/ai/bedrockClaudeHelpers.ts`, the Anthropic SDK at `/anthropic`                                                                                                | Converse, Invoke, Chat Completions (`/openai/v1`), Responses, Anthropic Messages (`/anthropic/v1/messages`) | yes: `global.`, `us.`, `eu.`… | the same key, or SigV4                                                         |

AWS's endpoints page says per-token prices are identical on both hosts and
that both run the same Mantle engine; the hosts differ in which models and
features they carry.

**The path trap on Mantle.** Gemma 4, the hosted GPTs and Grok answer under
`/openai/v1` and refuse `/v1`; Nemotron, gpt-oss, Qwen3, MiniMax, DeepSeek and
Mistral answer under `/v1`; Claude answers under `/anthropic`. The app memoises
ONE client per region and key at `/openai/v1`, so a model on another path needs
its own base URL (`client.withOptions({ baseURL })` in the OpenAI SDK, or a
second client).

## 2. Which model is on which host

| Model                             | Id                                                                                                   | `bedrock-runtime`                             | `bedrock-mantle`                        | API it takes                       | Tools          | Pictures             | Context      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------- | ---------------------------------- | -------------- | -------------------- | ------------ |
| Claude Haiku 5.5                  | `global.anthropic.claude-haiku-5-5` (runtime); `anthropic.claude-haiku-5-5` (Mantle)                 | cross-region ids only (`global.`/`us.`/`eu.`) | **GovCloud only**                       | Anthropic Messages                 | yes            | yes                  | 1M, 128K out |
| Gemma 4 31B / 26B-A4B / E2B       | `google.gemma-4-31b`, `google.gemma-4-26b-a4b`, `google.gemma-4-e2b`                                 | no                                            | yes, `/openai/v1`                       | Chat Completions, Responses        | yes            | yes                  | 256K         |
| GPT-5.6 Luna / Terra, GPT-6 Astra | `openai.gpt-5.6-luna`, `openai.gpt-5.6-terra`, `openai.gpt-6-astra`                                  | yes                                           | yes, `/openai/v1`                       | Chat Completions, Responses        | yes            | yes                  | long         |
| Grok 4.3 / 4.6                    | `xai.grok-4.3`, `xai.grok-4.6`                                                                       | 4.6 only                                      | yes, `/openai/v1` (4.6: us-west-2 only) | Chat Completions, Responses        | yes            | yes                  | long         |
| Nemotron Nano 3 30B               | `nvidia.nemotron-nano-3-30b`                                                                         | yes, `/openai/v1`                             | yes, `/v1`                              | Chat Completions, Converse, Invoke | client-side    | **no**               | 256K, 8K out |
| gpt-oss-20b / 120b                | `openai.gpt-oss-20b`, `openai.gpt-oss-120b`                                                          | yes                                           | yes, `/v1`                              | Chat Completions, Responses        | yes            | no                   | 128K         |
| Nova Micro / Lite / Pro / 2 Lite  | `amazon.nova-micro-v1:0`, `amazon.nova-lite-v1:0`, `amazon.nova-pro-v1:0`, `amazon.nova-2-lite-v1:0` | yes                                           | **no**                                  | **Converse and Invoke only**       | yes (Converse) | 2 Lite yes, Micro no | 128K–1M      |

Haiku 5.5's card lists `bedrock-mantle` availability in `us-gov-west-1` and
nowhere else; outside GovCloud it is on `bedrock-runtime` with no in-region
id, only the `global.` and geo ids. The Global id is served from all four
regions the app's Settings picker offers (us-west-2, us-east-1, us-east-2,
eu-central-1). AWS's launch post says the same: in GovCloud it is on both
hosts.

## 3. Prices (Standard tier, US regions, per 1M tokens)

| Model                       | Input         | Output        | Cache read               | Cache write (5 min) | Note                                                                                                           |
| --------------------------- | ------------- | ------------- | ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Claude Haiku 5.5, Global id | $0.10         | $0.50         | $0.01                    | $0.125              | prompts ≤100K tokens; over it $0.50 / $2.50, read $0.05; the `us.` geo id is $0.11 / $0.55; 1-hour write $0.20 |
| Claude Sonnet 5.5           | $2.00         | $10.00        | $0.20                    | $2.50               | Anthropic's list price; Bedrock's page not read for it                                                         |
| Claude Haiku 4.5            | $1.00         | $5.00         | $0.10                    | $1.25               | ten times Haiku 5.5                                                                                            |
| Gemma 4 31B                 | $0.14         | $0.40         | none published           | none                | Frankfurt about 20% more                                                                                       |
| Gemma 4 26B-A4B             | $0.13         | $0.40         | none                     | none                |                                                                                                                |
| Gemma 4 E2B                 | $0.04         | $0.08         | none                     | none                | a tiny model                                                                                                   |
| Nemotron Nano 3 30B         | $0.06         | $0.24         | none                     | none                | Flex and Batch tiers $0.03 / $0.12 (aggregator figure)                                                         |
| Nemotron 3 Super 120B       | $0.15         | $0.65         | none                     | none                |                                                                                                                |
| gpt-oss-20b / gpt-oss-120b  | $0.07 / $0.15 | $0.20 / $0.60 | none                     | none                | reasoning models                                                                                               |
| GPT-5.6 Luna                | $0.22         | $1.32         | $0.022 on Responses only | $0.275              | no cached rate on Chat Completions, which is what the app sends                                                |
| GPT-5.6 Terra               | $2.20         | $13.20        | $0.22 on Responses only  | $2.75               |                                                                                                                |
| Nova Micro                  | about $0.035  | about $0.14   |                          |                     | aggregator figures; Converse only                                                                              |
| Nova Lite                   | about $0.06   | about $0.24   |                          |                     | aggregator figures; Converse only                                                                              |
| Nova 2 Lite                 | about $0.30   | about $2.50   |                          |                     | aggregators disagree ($0.33 / $2.75 on some); Converse only                                                    |
| Mistral Ministral 8B / 14B  | $0.15 / $0.20 | $0.15 / $0.20 |                          |                     | tool calling not checked                                                                                       |
| Qwen3 Next 80B A3B          | $0.15         | $1.20         |                          |                     |                                                                                                                |
| MiniMax M2.5                | $0.30         | $1.20         |                          |                     |                                                                                                                |
| DeepSeek V3.2               | $0.62         | $1.85         |                          |                     |                                                                                                                |

## 4. What a question costs here

Assumptions, from what was measured on Sonnet 5 on 2026-09-08: the tool
schemas and the system prompt are about 13k tokens and byte-identical on
every round; a round is about 16k input tokens; the corpus median is two
rounds, a how-do-I with a page read three; a question writes about 600 output
tokens in all. Haiku 5.5's tokenizer may count up to a third more than that.

| Model                                                                                | 2 rounds                                                                                       | 3 rounds      | Why                                                          |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------ |
| Claude Haiku 5.5, cache cold                                                         | about $0.0025                                                                                  | about $0.003  | the 13k prefix is written once at $0.125, then read at $0.01 |
| Claude Haiku 5.5, cache warm (a follow-up, or a second question inside five minutes) | about $0.001                                                                                   | about $0.002  | everything but the new words is a read                       |
| Gemma 4 31B                                                                          | **$0.004 measured** (27k tokens)                                                               | about $0.008  | every round at full price                                    |
| Gemma 4 E2B                                                                          | about $0.0015                                                                                  | about $0.002  |                                                              |
| Nemotron Nano 3 30B                                                                  | about $0.002                                                                                   | about $0.0035 |                                                              |
| GPT-5.6 Luna                                                                         | about $0.008                                                                                   | about $0.013  |                                                              |
| Sonnet 5 on an Anthropic key, the graded reference                                   | $0.023 average measured; a cold first ask about $0.04, a warm one-round follow-up about $0.004 |               | 12 of 12 on the standing questions                           |

At the spend guard's default of $1 an hour, Haiku 5.5 allows several hundred
questions an hour before it pauses.

## 5. Why Haiku 5.5 is the pick

- **Fit.** The chatbot is a tool loop: 26 tools, three rounds, an answer that
  must name real controls. Sonnet 5 is the graded GOOD model (12 of 12);
  Haiku 4.5 answered the same kind of question correctly at $0.02; Haiku 5.5
  is a step up from 4.5 on agent tasks at a tenth of its price. Gemma 4 31B
  has one correct run; nothing else on Bedrock has been measured here at all.
- **The loop already exists.** `askAnthropicCompatible` in `src/chatbot/llmBotHelpers.ts`
  caches the prefix (an explicit marker on the system block plus the
  request-level one), keeps the tools on the last round under
  `tool_choice: none`, and leaves effort at the provider's default. Haiku 5.5
  runs adaptive thinking by default at effort `medium` and shares the 6000
  `max_tokens` with it, exactly as Sonnet 5 does.
- **It sees pictures and has a 1M context**, so the 📷 attachment and a long
  tab both work.
- **Not measured yet.** The first live asks must prove the caching (section 6).

## 6. What wiring it in takes

_Done the same day, 2026-10-11, at the user's ask: `src/helper/ai/bedrockClaudeHelpers.ts`
is the client, `askAnthropicCompatible` in `src/chatbot/llmBotHelpers.ts` the shared
loop, the row is first in the Bedrock list as "Claude Haiku 5.5 (best recommended)",
the price row and the four CSP hosts are in, and the unit tests hold it to the
Anthropic shape. Step 5 is still open: nobody has pressed Ask on it yet, so the
cache reads and the key header are unproven on the wire._

1. **A client.** The Anthropic SDK with the stored Bedrock key as `apiKey`
   (the SDK sends it as `x-api-key`, which AWS's own sample relies on) and
   `baseURL: https://bedrock-runtime.<region>.amazonaws.com/anthropic`; the SDK
   adds the `anthropic-version` header itself. If the key is refused that way,
   `authToken` sends it as `Authorization: Bearer`, which AWS's API-key page
   documents. Keep `dangerouslyAllowBrowser: true` and memoise on region + key
   like the other clients.
2. **The model id** `global.anthropic.claude-haiku-5-5`. Global is served from
   every region in `BEDROCK_REGION_LIST`, so `findModelProblem` needs no new
   region rule. The `us.` id would keep the data in the US for a cent more.
3. **A row that uses the Anthropic loop, not the OpenAI-shaped one.** Either a
   provider of its own beside Bedrock in `LLM_PROVIDER_MAP` (and in
   `chatSessionHelpers`' provider record, which must not import the SDKs), or a
   per-model switch inside the Bedrock provider. A price row in
   `usageHelpers.MODEL_PRICE_MAP`: input 0.10, cacheRead 0.01, cacheWrite
   0.125, output 0.50. `toAnthropicRoundUsage` already prices by model id.
4. **The chatbot CSP.** `html/chatbot.html`'s `connect-src` names each Bedrock
   host; add the four `bedrock-runtime` hosts (never `*.amazonaws.com`).
   `aiHelpers.test.ts` reads the HTML and holds it to the region list.
5. **Verify on the wire before grading.** Round 1 must report
   `cache_creation_input_tokens` near the prefix, round 2
   `cache_read_input_tokens` at least the prefix; a tool call must go through
   and a 📷 picture be accepted. Then run the standing corpus and add the run
   to `model-benchmarks.json` the same day.

## 7. Nemotron Nano 3 30B, if a cheaper OpenAI-loop option is wanted

The cheapest unmeasured candidate for the existing OpenAI-shaped loop:
$0.06 / $0.24, 256K context, client-side tool calling on Mantle, in-region in
us-west-2, us-east-1 and us-east-2. It sits on Mantle's `/v1` path (or the
runtime host's `/openai/v1`), so its row needs its own base URL; it is text
only, so `canSeeImages` stays off and `checkCanSeeImages` refuses a picture
before the call; no cached rate, so every round is full price. The family's
free cousin, Nemotron Lightning on Kilo Code, answered 7 of 7 through the
app's own tool loop (2026-09-12), which is the only hint it would cope.

## 8. Nova, and why not

Every Nova model is Converse and Invoke only: no Chat Completions, nothing on
Mantle. Reaching one means a Converse client with its own message shape
(`toolConfig`, `inferenceConfig`), and Nova caps cached tokens at 20K. Nova 2
Lite costs more than Gemma 4 31B anyway, and Nova Micro's 128K context and
summarisation-grade training make it a poor tool caller. Not worth the client.

## 9. Measured on Bedrock so far

- Gemma 4 31B, 2026-10-10, "Is anything showing on the projector?" through
  the tool loop: correct, about $0.004, 27k tokens (`model-benchmarks.json`).

## Sources

- [Claude Haiku 5.5 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html)
- [Endpoints supported by Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html)
- [Endpoint availability by model](https://docs.aws.amazon.com/bedrock/latest/userguide/models-endpoint-availability.md)
- [Inference using the Anthropic Messages API](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-messages-api.html)
- [Use an Amazon Bedrock API key](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.md)
- [Nemotron Nano 3 30B model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-nvidia-nemotron-nano-3-30b.html)
- [Nova 2 Lite model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html) · [Nova Micro model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-micro.html)
- [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
- [Introducing Claude Haiku 5.5 on AWS](https://aws.amazon.com/blogs/machine-learning/introducing-claude-haiku-5-5-on-aws/) · [Haiku 5.5 Bedrock prices on launch day](https://dev.classmethod.jp/en/articles/bedrock-claude-haiku-5-5/)
- [Bedrock Mantle for Claude Desktop](https://claude.com/docs/third-party/claude-desktop/mantle) (the `/anthropic` base URL and bearer auth)
