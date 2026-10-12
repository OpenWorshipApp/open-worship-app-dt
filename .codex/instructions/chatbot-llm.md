---
paths:
  - 'src/chatbot/llm*.ts'
  - 'src/chatbot/usage*.ts'
  - 'src/chatbot/spendGuard*.ts'
  - 'src/chatbot/providerIssue*.ts'
  - 'src/chatbot/providerPick*.ts'
  - 'src/chatbot/cancel*.ts'
  - 'src/chatbot/mcpClient*.ts'
  - 'src/helper/ai/**'
  - 'tools/owa-devtools-mcp/modelTools.mjs'
  - '.claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs'
---

# Chatbot model loop: providers, tools, cost

What the chatbot sends a provider, what it withholds, what it costs and what
happens when a provider fails. The window itself: `chatbot-window.md`.

- **The chatbot's model sees the app's own `owa_*` tools and nothing of
  chrome-devtools' at all** — 34 of 60 withheld, declared ONCE in
  `tools/owa-devtools-mcp/modelTools.mjs` (no `node:fs`, so the renderer
  bundles the module the audit script reads). All 60 stay registered on the
  server, so the developer's door is whole — what is withheld is withheld from
  the MODEL, which is the untrusted party. Same two enforcement points as the
  firewall and for the same reason: `askLlmBot` filters the list, and
  `runMcpTool` REFUSES the call, because these tools are named in the app's own
  manual and a filtered list alone is a suggestion. Every refusal says what to
  use instead. Six groups: the three the window presses itself
  (`owa_screenshot`, `owa_pick_element`, `owa_highlight_selector`) plus
  `take_screenshot`, which quietly undid that same decision; the acting tools
  aimed by a snapshot uid (`click`, `fill`, `fill_form`, `drag`, `hover`,
  `type_text`) — `owa_click`/`owa_type` say what they press, in the user's own
  language, and are what the interlock reads; **the two acting tools that carry
  no label at all** (`press_key`, `handle_dialog` — 2026-09-08: asked _Nothing
  is showing on the projector_, Sonnet 5 rang the wrong control, then pressed
  F5 through `press_key` on two windows and the congregation's screen came on
  with nobody having asked; a key has nothing the destructive interlock can
  read, and F5/F6 ARE the projector); the window openers (`new_page`,
  `close_page`, `navigate_page`, against `owa_goto_page`); the page readers
  (`take_snapshot`, `list_pages`, `select_page`, `wait_for`, the two console
  and two network readers — the same day, _the words no come out big screen_
  took three `take_snapshot`s at ~8 000 tokens each, read the console, ran to
  the ten-round cap and answered "I could not find an answer" after 72 s and
  225 000 tokens; no graded answer had ever called one of these and passed,
  and `owa_list_ui`/`owa_app_state` answer the same questions in the words on
  the user's screen — the Report button reads the console for itself through
  `callTool`, which the filter never sees); and the developer instruments
  (`emulate`, `resize_page`, `lighthouse_audit`, three `performance_*`).
  Measured 2026-09-08: **the host bill and the model's bill are different
  numbers** — 48 tools / ~11 113 per round at the host, 19 / ~5 503 to the
  model (was 29 / ~7 366).
  `audit-mcp-tools.mjs` reports both and prints a withheld tool as `(name)`;
  reporting only the total is how a tool added "for the developer" ends up
  billed to every volunteer. Since 2026-10-10 five `owa_*` tools are the
  developer's too — `owa_press_key`, `owa_drag`, `owa_menu`, `owa_scroll`,
  `owa_media_file` (`MC-50`, `MC-56`) — so "the model sees every `owa_*` tool" is no longer the rule;
  `modelTools.mjs` is, and it says what to use instead of each. **A custom
  server is sent 14 of those 26** (`LOCAL_TOOL_NAME_LIST`,
  `OpenAiCompatProviderType.filterTools`, 2026-10-10): 4 234 tokens of
  schemas a round instead of 8 322, because a local server pays for every
  schema in prompt-processing TIME — measured 11 tokens/s on the user's
  laptop under Ollama (a 4B model), 1 000 on their LM Studio box; memory
  `custom-llm-servers`. **A general question's thinking is OFF on LM Studio
  and Ollama** (2026-10-10, `genCustomProvider` with the server's kind:
  `reasoning_effort: "none"`, measured to be honoured by both — a plain
  model too, Ollama answering gemma4 and qwen3 200 with it; qwen3.5-9b had
  spent 1 069 generated tokens and 27.5 s thinking about what the Bible is,
  150 of them the answer), never in the tool loop (the same model reasons
  30-120 tokens a round there and a call may need them) and never to
  llama.cpp or an unknown kind, unmeasured — **except as the one retry of
  an answer that was all thinking** (EC-211, 2026-10-10: gemma-4-12b on the
  user's LM Studio spent 697 of 700 completion tokens reasoning about a
  5.7k-token ask and said nothing, and answered the same ask in 14 s with
  the field; `canTurnReasoningOff` on the custom provider, `isReasoningOff`
  in the loop, only when the answer is empty and ran out of budget or
  carried reasoning). **A tool call written as WORDS
  is read as the call** (`src/chatbot/textToolCallHelpers.ts`, in
  `askOpenAiCompatible` for every OpenAI-shaped provider): a small model
  drifts into another tool-call grammar once the context fills — measured on
  qwen3.5-9b at 16k, round 5, a `<function=owa_help_search>` block printed as
  the answer — so `<tool_call>` JSON, `<function=…><parameter=…>` XML,
  `[TOOL_CALLS]` and a bare or fenced JSON object are parsed (only a name the
  request offered; values by the tool's own schema), sent on as a real
  `tool_calls` turn with the words around them kept, and the loop goes on;
  on the LAST round it is the no-answer error, which `describeLlmError` now
  words as _it wrote no answer this time_ — a plain Error has no status, and
  no status read as _could not be reached_. **A server that refuses the
  TOOLS is asked once more without them** (2026-10-10, GPT4All 3.10 on the
  user's server PC: 400 `'tools' is not supported` to EVERY request that
  carries them, so the assistant could not answer there at all while the
  guide page a known question carries was already in the ask):
  `checkIsToolsRefused` (`customServerClientHelpers.ts`, the same
  `NO_TOOLS_ERROR_LIST` patterns — GPT4All's, `--jinja`, _does not support
  tools_ — read off the message whatever the status) turns the first round's
  refusal into the salvage round with no tools, the ask gets a line saying
  the tools are gone (`appendToolsRefusedNudge`, so the model neither claims
  to have looked nor writes a call as words), and the answer opens with
  `TOOLS_REFUSED_NOTE` — nothing was checked in the window, use LM Studio,
  Ollama or llama.cpp for presses. Only the first round, only once. **The lean set leaves the song
  tools out, so the song-by-title chip is drafted with no model on a custom
  server** (`handleAsking` → `answerLyricTitle`, the guide's own finder, the
  same Create button): asked, gemma-4-e4b wrote the steps for an EMPTY file
  in 43k tokens. **The shared LLM registry** (2026-10-10, the user's ask —
  _as an admin I want to store any available llm endpoints so owa app should
  be able to use it freshly real-time_): `https://www.openworship.app/llm/info.json`,
  shape in `docs/llm-registry/README.md` + `info.schema.json`, validated by
  `toValidLlmRegistry` (version 1, slug ids prefixed `registry-`, http(s)
  address, at least one model, row ids made from the model name so a tab
  keeps its model across reloads), held in MAIN (`llmRegistryHelpers.ts`:
  read once after `initAi`, never on a timer, 8 s, 256 KB; a failed read
  keeps the last list and says why), handed to a window without keys over
  `LLM_REGISTRY_GET_CHANNEL` / `LLM_REGISTRY_RELOAD_CHANNEL`, accepted by the
  relay by id with the registry's own key, and listed through
  `getAllCustomServers` (`getCustomServers` stays the saved list, so
  Settings never edits a registry row — it LISTS them, read-only, in a
  **Shared servers** group of their own under Custom servers, with a ↻:
  `SettingOthersSharedServersComp`, fed by `useLlmRegistry`). `OWA_LLM_REGISTRY_URL` points a dev
  app at a stand-in; `extra-work/local-llm/s3-push-llm-registry.mjs` validates and
  publishes (`www/llm/info.json`, `max-age=60`, CloudFront invalidated). The
  admin kit beside it (`extra-work/local-llm/`, its README): `llm-tunnel.mjs`,
  a key-checking door behind a Cloudflare quick tunnel that looks at itself
  every minute and can publish its own address, and `llm-tunnel-startup.mjs`,
  which starts it with the computer on Linux, macOS and Windows.
- **The Anthropic loop is prompt-cached** (2026-09-08, `askAnthropicCompatible` in
  `src/chatbot/llmBotHelpers.ts`). Measured first with no caching at all: the
  standing corpus, 12 questions, 44 rounds, **813 000 input tokens every one
  at full price**, ~15 900 of the ~16 000 a round costs being the tool schemas
  and the system prompt — byte-identical for every round of every question
  about the same window. Two breakpoints: an explicit `cache_control` on the
  system block (the provider renders tools → system → messages, so that one
  marker caches both, and makes them a READ for the next question inside five
  minutes, not only the next round), and the request-level automatic one the
  API moves to the last block of the growing conversation. A write bills
  1.25×, a read 0.1×; the corpus median is two rounds. Two rules fall out:
  **nothing that changes per question may enter the system prompt** (a date,
  the screen state — the prefix breaks at that byte and both reads are lost),
  and the last round keeps its tools with `tool_choice: none` rather than
  dropping them, because dropping them changes the prefix at byte zero.
  `usage.cache_read_input_tokens` is the only proof it still holds; the
  corpus driver (`chatbot-cdp-driver-gotchas` in memory) reads it off the
  response body. OpenAI caches a ≥1 024-token prefix on its own; whether
  Moonshot does for Kimi was not measured.
- **Every answer says what it cost, and the tab keeps the running total**
  (2026-09-10, `src/chatbot/usageHelpers.ts`; asked for by the user — _as a
  user I want to see how many credit used per chat session_). Every model
  round comes back with a `usage` block and the window threw it away, so a
  volunteer was spending the church's API credit with nothing on screen
  saying how much — the one figure that decides whether the assistant is
  cheap enough to use freely could only be read off the wire by a developer.
  Now `AskExtraType.onUsage` is PUSHED once per round from both loops (like
  `onProgress`, and for the same reason: a question stopped after three
  rounds, or one that fails on its fourth, has still paid for three, and a
  total summed onto the answers that arrived would read under the bill every
  time), normalised by `toAnthropicRoundUsage` / `toOpenAiRoundUsage` — the
  OpenAI shape reports the WHOLE prompt and the cached part inside it, so the
  full-rate part is the difference — and priced per round on the model that
  ANSWERED (a stand-in key's rounds are priced on the stand-in). The window
  folds each round into the tab (`ChatSessionType.usage`, kept on the tab
  because the messages are capped at sixty and the sixty-first's rounds are
  still spent) and stamps the ask's own tally on the answer
  (`ChatMessageType.usage`); both survive a restart through `toValidUsage`,
  which drops a hand-edited total whole. Drawn twice: a quiet figure at the
  end of the answer's Copy line and a **Credit used** row under the three
  pickers, only once there is a bill, both with the sums and the caveat on
  the hover. **The dollars are an estimate from the list price** — the one
  table in `usageHelpers` (`MODEL_PRICE_MAP`, checked against the providers
  2026-09-10: Anthropic cache reads a tenth and writes 1.25×, the GPT-5 family
  and Kimi K3 cached input a tenth), which `toPriceLabel` also prints on the
  model picker's hover so the two cannot drift — a free service reads _free_
  (priced at zero, a fact, not "unknown"), a model with no row reads _price
  not known_ with the tokens still counted, and a mixed tab says both.
  **`/credit`** (also `/cost`, `/usage`, `/spent`, `/tokens`) answers from the
  tab's own total with no model, handed in as `BuiltinRunContextType.usage`:
  no tool reads the window, and a free model asked _how much has this chat
  cost?_ quoted the manual's sample figure back as the answer — so the recipe
  carries no quotable number now and says the assistant cannot read it.
  Measured on the standing corpus the same morning: twelve questions on
  Sonnet 5 ≈ $0.28 in all, a cache-cold first ask ≈ $0.04 and a cache-warm
  one-round follow-up ≈ $0.004.
- **The assistant cannot run up the bill on its own** (2026-09-10,
  `src/chatbot/spendGuardHelpers.ts`; asked for by the user — _I don't want
  to mistakenly get stuck in an infinite loop of programmatic error that eats
  all my credit or floods the bill_). Every cap the loop had was per ASK —
  ten rounds, Stop — and a runaway is a bounded ask repeated: a window
  re-asking on every render, a card rescuing the same step for ever, a
  relaunch loop, a script driving the window. The guard is a circuit breaker
  with a LATCH on the one seam every model call goes through: `askLlmBot`
  wraps `onUsage` so every round is written to a rolling-hour ledger
  (`chatbot-spend-ledger`, through `appLocalStorage`, so a reload or relaunch
  arrives already paused) whoever the caller is, and BOTH provider loops
  call `throwIfSpendLimitReached()` beside `throwIfCancelled()` before a
  round is bought — the round that would go over is the round never posted.
  Two caps: the **money cap** the user sets (`chatbot-spend-limit`, default
  $1 an hour, the **Limit per hour** picker after MODEL in the picker row
  — it had a row of its own beside CREDIT USED until 2026-09-11, a head line
  spent on one small select — `/limit 2`,
  `/limit off`; the value in force is always an option, because a `<select>`
  whose value matches no option shows its FIRST) and a fixed **pace cap** of
  150 model calls an hour that holds whatever the money cap says — the only
  thing that bounds a free or unpriced model (`EC-156`). At the cap the
  latch sets and is lifted by NOTHING but a person: **Allow more** (a pseudo
  tool like the report's Send, `SPEND_ALLOW_TOOL_NAME`, in the pause note,
  the head row and `/limit more`) restarts the hour and re-asks the question
  with no second echo; time passing does not lift it, nor a restart — a
  runaway merely waited out starts again at the top of the next hour.
  `SpendLimitError` is its own class, like the cancellation, so
  `describeLlmError` cannot read it as the internet being down and the
  stand-in cannot hand the runaway a second key; the window answers the
  paused question from the OFFLINE guide under the note, because saying no
  must cost nothing, and the note is plain text (the first draft carried
  `**Allow more**` and the asterisks showed). Past four fifths of the cap the
  figure turns amber and the answer that crossed carries a one-time
  *Heads-up*. Proven live: seeded $0.21, cap $0.25, one real question paid one
  round and was paused before its second; 150 seeded calls refused the next
  ask with zero provider requests on the wire. **The research driver is a
  runaway by this definition** — five corpus runs in an hour is the pace cap;
  `/limit more` or the head-row button lifts it, and a driver that seeds the
  ledger file must reload the window first (the ledger is held in memory
  after its first read).
- **A dead key hands the question to another of the user's own** (2026-09-09,
  `askLlmBot` in `src/chatbot/llmBotHelpers.ts`). Measured by opening the help
  window on its OWN default rather than a hand-picked Claude: it was a ChatGPT
  key a week out of credit, and all twelve corpus questions posted the same
  41 KB request three times (the OpenAI SDK retries a 429 whatever kind it
  is; this one was `insufficient_quota`), waited 3–5 s, and answered from
  the offline bot under _"ChatGPT could not answer"_ — with a live Claude key
  one option along in the head row. Now a failure that is the PROVIDER's
  (`checkIsProviderFault`, now by `readLlmIssue`'s kind: 401/403, 429, 5xx and
  an empty account's 402 or 400 — not an ordinary 400 and never a no-status
  network error, which another key would share) is retried ONCE on
  the best other provider whose key is set (`getStandInLlmProvider`), and
  the answer carries `standIn`; the window writes the note naming both and
  the reason and moves the TAB to the stand-in (the stored new-tab default
  is left as the user set it, so a topped-up key is back without a setting
  having changed behind them). **Free is on neither side**: never the
  stand-in for a paid key (a public service getting a paid question's words
  and attachments because a card declined) and never stood in for (a paid
  key spent on the free tier's behalf); with no other key the offline bot
  answers as before. The OpenAI-shaped loop posts with `maxRetries: 0` — a
  busy-service 429 is handled by its own salvage pass past round one and by
  the stand-in or the offline bot on round one; the Anthropic loop keeps the
  SDK default. The same measurement fixed two offline answers: `nearMisses`
  in `domMatch.mjs` no longer scores filler words (_to_, _the_ made a verse
  row outrank the **Background** panel), and a Presenter recipe answered on
  the Reader leads with the 🖥️ **Go Back to Presenter** route
  (`genBackToPresenterRoute`, ONE source for the prompt and the offline bot;
  the manual's `**bold**` is stripped before its panel names are looked for).
- **An unusual answer from a provider comes with the door to it** (2026-09-10,
  `src/chatbot/providerIssueHelpers.ts`; asked for by the user — _if there
  any unusual response from api then give buttons for user to go to the api
  dashboard_). Measured first through the real window on the ChatGPT key
  that has been out of credit since `EC-83`: the note read _"out of credit
  or being rate-limited"_ with the body saying `insufficient_quota` in plain
  sight, and nothing under it a volunteer could press. The window had read
  only the HTTP STATUS, and a status is not enough: an OpenAI 429 is an
  empty account (`insufficient_quota`, now also `credit_balance_exhausted`)
  as often as a rate limit; a Kimi 429 can be `engine_overloaded_error`,
  the service's fault; and **an Anthropic empty account is a 402, or a 400
  whose only clue is "credit balance is too low"** — which
  `checkIsProviderFault` (401/403/429/5xx, never a 400) had never once
  handed to the stand-in key. `readLlmIssue` now reads the body as well
  (the code or type every provider documents — read off each provider's
  own error page that day, never remembered — and the words it used, with
  a body left only in `error.message` parsed back out) into a KIND, and the
  kind decides both the sentence (`describeLlmError`) and the buttons
  (`genProviderIssueActions`): an empty account gets _Open ChatGPT
  billing_, a refused key _Open AI settings_ + _Open Claude API keys_, a
  rate limit the limits page, a bare 429 both doors, a busy service its
  status page; the keyless provider gets the settings panel, because the
  way out of a busy free pool is a key of one's own. The buttons are two
  pseudo tools caught in `handleActing` like the report's Send
  (`OPEN_PROVIDER_PAGE_TOOL_NAME`, `OPEN_AI_SETTING_TOOL_NAME`) and
  registered nowhere; **a button carries a provider and a page NAME, never
  an address** — `getLlmProviderPageUrl` resolves it at the press out of
  `PAID_PROVIDER_PAGE_MAP`, the ONE table of console pages (Settings' _Get
  key_ buttons read it too), so nothing a model says and nothing a
  hand-edited session file carries can open a page. They ride the
  stand-in note (named for the provider that FAILED), the offline-fallback
  note, a rescue's one line and the report's _I could not look into it_.
  The Anthropic console answers on `platform.claude.com` now; Kimi
  documents no billing page, so its console home stands in rather than a
  guessed deep link. Re-asked on the same dead key: _"the AI account is out
  of credit"_ and **Open ChatGPT billing**, the press opening the page and
  saying so in the transcript.
