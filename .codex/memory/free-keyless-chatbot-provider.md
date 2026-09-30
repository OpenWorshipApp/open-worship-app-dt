---
name: free-keyless-chatbot-provider
description: The chatbot answers with no API key via Kilo Code's free models; free models churn and are differently broken, not just weaker
metadata:
  type: project
---

The chatbot has a fourth provider, `Free`, that needs no API key: **Kilo Code**
(`api.kilo.ai/api/gateway`), keyless and speaking OpenAI's protocol, so it
rides the existing `askOpenAiCompatible` loop. Added 2026-09-01 with LLM7
(`api.llm7.io`) as the default; **LLM7 was dropped 2026-09-12** when its
anonymous catalogue went paid (`gpt-oss` → `model_unavailable`,
`minimax-m2.7` → 429 after one call) and every keyless question fell to the
offline guide.

**Why:** every other provider was somebody's paid account, so a fresh install —
the state most churches stay in — had only the offline manual search, which
cannot converse, look at the app, or walk anyone through anything.

**How to apply:**

- The mechanism is `keyField` being UNSET on `LLM_PROVIDER_MAP.free`. Unset
  means always-available; the map's ORDER puts it last, so a real key still
  wins and a keyless install lands on it by itself. Do not "fix" that into a
  flag or a default.
- **Free catalogues churn inside weeks.** Before listing a model, drive it
  through the REAL loop (the ~21 model-visible tools, read-only tools against
  the live app, six rounds) on several corpus questions — a one-tool ping
  passes models that then return empty answers under the full schema. The
  2026-09-12 list: Nemotron Lightning 7/7 (first), Nex Pro 7/7, Step Flash 6/7
  (kept: the only one that sees a picture). Routers (`kilo-auto/free`,
  `openrouter/free`) hand each question to a different model and scored 4/7 and
  a raw `<tool_call>` answer — leave them out. Every id must end `:free`; an
  unsuffixed Kilo id is paid and refuses anonymous requests (a test holds it).
- **A saved model name outlives the list.** Tabs and `chatbot-llm-model-free`
  kept posting `gpt-oss` after it was withdrawn. `toUsableLlmModel` resets a
  keyless name the list no longer carries to the first choice (at
  `getLlmModel`, window load, `askLlmBot`); a keyed provider's off-list name is
  a *More models…* pick and is kept. Removing a free model needs nothing more.
- **"The assistant service" is the app's OWN MCP host, not the provider.** A
  host 500 is a `ToolHostError` (`mcpClient.ts`) said in its own sentence; its
  status rides `hostStatus`, never `status`, or `readLlmIssue` reads it as a
  provider 5xx and hands the question to another key. Before blaming a
  provider for a failed answer, read the chatbot window's console for which
  URL failed — on 2026-09-12 a host 500 and a dead free model looked alike.
- Only `stepfun/step-3.7-flash:free` can see a picture.
- *More models…* is hidden for this provider on purpose: Kilo DOES answer
  `models.list` (377 names, 21 free), mostly paid and partly toolless.

**Free models are differently BROKEN, not merely weaker** — none of these
happen on a first-party API, and all were found by grading the standing corpus
through the real loop before wiring anything:

- A gateway leaks harmony channel markers INTO the function name
  (`owa_list_ui<|channel|>commentary`). `toCleanToolName` cuts at `<|`.
- Round exhaustion: one question spent all 10 rounds and ~79 000 prompt tokens
  producing NOTHING. `maxToolRounds` is 6 for this provider.
- A 429 arrives MID-question, after the tools have already found the answer.
  Throwing discards it, so one tools-less salvage round runs instead.
- "ALWAYS answer in English" holds in the prose and fails in the `OPTIONS:`
  line. `checkIsReadableReply` drops an option with **no Latin letter at all**,
  which deliberately keeps one naming a translated button
  ([[knowledge-label-i18n-templates]]).

The risk is stated, never assumed: a sticky warning at the top of the log and
the same words in Settings while no key is set. Both **name the service and link
to its own site** off `FREE_SERVICE_MAP`, so they cannot drift apart. In
Settings do NOT reuse `RenderOpenPageButtonComp` for it: it `tran()`s its label
and title, and `tran()` THROWS on a missing key in dev, so a brand name or a URL
through it blanks the panel in Khmer ([[tran-missing-key-throws-in-dev]]).
Related: [[agent-access-mcp-chatbot]], [[kimi-third-llm-provider]],
[[chatbot-answer-options]].
