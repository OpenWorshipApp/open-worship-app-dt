---
paths:
  - 'src/chatbot/llm*.ts'
  - 'src/chatbot/usage*.ts'
  - 'src/chatbot/spendGuard*.ts'
  - 'src/chatbot/providerIssue*.ts'
  - 'src/chatbot/providerPick*.ts'
  - 'src/chatbot/autoAssistant*.ts'
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
  chrome-devtools' at all** — 36 of 65 withheld (and three offered only to the kinds of ask `MODEL_ON_ASK_TOOL_MAP` and `MODEL_ASK_SHARED_TOOL_MAP` name), declared ONCE in
  `tools/owa-devtools-mcp/modelTools.mjs` (no `node:fs`, so the renderer
  bundles the module the audit script reads). All 65 stay registered on the
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
  the user's screen — the Report button reads the console for itself, from the main
  process (`main:app:recent-console`), which the filter never sees); and the developer instruments
  (`emulate`, `resize_page`, `lighthouse_audit`, three `performance_*`).
  **And since 2026-10-18 the chat box's input aid**, `owa_bible_suggest`,
  which the WINDOW asks on a debounce as a person types a reference or a
  name; its reason says to answer with `owa_find_verse` / `owa_lookup_record`
  (`agent-tools.md`).
  **And since 2026-11-05 the language plugins**, `owa_language`: the help
  window checks the language a conversation turns to and offers its install
  as buttons the PERSON presses (`chatbot-bible-import.md`); a language
  plugin is code the app runs, so no model stands in for that press, and the
  model's list and its ratchet did not move (26 tools, ~8 348 a round).
  Measured 2026-09-08: **the host bill and the model's bill are different
  numbers** — 48 tools / ~11 113 per round at the host, 19 / ~5 503 to the
  model (was 29 / ~7 366).
  `audit-mcp-tools.mjs` reports both and prints a withheld tool as `(name)`;
  reporting only the total is how a tool added "for the developer" ends up
  billed to every volunteer. Since 2026-10-10 five `owa_*` tools are the
  developer's too — `owa_press_key`, `owa_drag`, `owa_menu`, `owa_scroll`,
  `owa_media_file` (`MC-50`, `MC-56`) — so "the model sees every `owa_*` tool" is no longer the rule;
  `modelTools.mjs` is, and it says what to use instead of each. **One tool
  is offered to ONE kind of ask** (2026-10-16, `MODEL_ON_ASK_TOOL_MAP`):
  `owa_find_verse` goes to a verse-finding conversation (and, shared, to the
  Bible Reader's asks since 2026-10-18 and the lookup's since 2026-10-19), under its own
  prompt, with `owa_read_website` beside it (`MODEL_ASK_SHARED_TOOL_MAP`,
  `pickAskToolList`) and nothing else -- so the ordinary list, the ratchet's
  8 350, did not grow; the audit prints it as `[owa_find_verse]`, ~356 a
  round to that ask (2026-10-29; ~280 when added). Not refused elsewhere: it reads a Bible and opens a
  verse in the lookup. **A second one, 2026-10-18**: `owa_lookup_record`
  goes to a conversation opened from a Lookup Detail panel's 🤖 (and, shared,
  to the Resources and the Bible Reader's asks)
  (kind `lookup`, `owa_read_website` and, since 2026-10-19 (`EC-372`),
  `owa_find_verse` beside it, `LOOKUP_SYSTEM_PROMPT`,
  five rounds; `chatbot-window.md`), and to a custom server's lean list
  for that ask only. **A third, 2026-10-17**: `owa_resource_file` goes to
  a question asked while a file from a Resources folder is open in the tab
  (kind `resources`, `owa_lookup_record` and `owa_read_website` beside it,
  `RESOURCES_SYSTEM_PROMPT`, five rounds; `chatbot-window.md`), on the
  lean list too. The Resources **Read** range is pre-read through
  `owa_lookup_record` and put on the ask so even a small model cannot complete
  or truncate its main verses from memory; this changes only Resources asks,
  not the ordinary model list. **A fourth, 2026-10-18**: `bible-reader` -- a TYPED
  question in a Reader tab that names a chapter or a verse -- offers all
  three of `owa_lookup_record`, `owa_resource_file` and `owa_find_verse`
  plus the web read (`MODEL_ASK_SHARED_TOOL_MAP`), under
  `BIBLE_READER_SYSTEM_PROMPT`, six rounds; the ordinary list and its
  ratchet did not move, and a plain line under the answer stays in the
  conversation (`isBibleReaderAnswer`, `chatbot-window.md`). **A tool can answer with PICTURES** (the same day):
  `callToolWithPictures` keeps a result's image blocks, `runMcpToolCall`
  holds them on `ToolWatchType.pictures`, and both loops put them in
  front of the model after the round's tool results -- Anthropic as image
  blocks after the `tool_result`s in the same user message, the
  OpenAI-shaped loop as a user turn of its own after the `tool` legs
  (`TOOL_PICTURES_TEXT`, with any addition in it rather than a second
  turn) -- and let go of them. To a model that cannot see
  (`AskExtraType.resources.canSeePictures`, `checkCanSeeImages` at the
  ask) they are left out with a sentence saying so, never sent to a 400. **A custom
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
  in 43k tokens. **And the song-by-LINK chip, since 2026-10-12** (`EC-254`;
  `readSongLinkAsk` → `answerLyricLink`, the link read before the title, as
  the guide reads them): it had gone to the local model, which said _I
  apologize, but I cannot create a lyric file directly from this chat
  window_ -- to words the guide drafts by itself when no assistant answers. **The shared LLM registry** (2026-10-10, the user's ask —
  _as an admin I want to store any available llm endpoints so owa app should
  be able to use it freshly real-time_): `https://www.openworship.app/llm/info.json`,
  shape in `docs/llm-registry/README.md` + `info.schema.json`, validated by
  `toValidLlmRegistry` (version 1, slug ids prefixed `registry-`, http(s)
  address, at least one model, row ids made from the model name so a tab
  keeps its model across reloads), held in MAIN (`llmRegistryHelpers.ts`:
  read once after `initAi`, never on a timer, 8 s, 256 KB; a failed read
  keeps the last list and says why), handed to a window without keys **and,
  since 2026-10-12, without addresses** (the user's ask: _hide endpoint and
  api key, to avoid easily copy and use_ — `toPublicRegistryServers` puts a
  stand-in on `shared-server.invalid` with the real path in `baseUrl` and
  tells a local-network server as `isFree`; no failure sentence quotes a
  shared server's address, and the relay takes the real host out of what a
  server writes back; memory `llm-registry`) -- but WITH the `note` of the
  server and of each model since 2026-10-17, shown to the person choosing
  (_slow, but it saves us the cost of usage_; a string or one per language,
  the host taken out; a line under the pickers, the model hover, Auto's
  waiting line, Settings) -- over
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
  **A registry entry can take REPORTS instead of questions** (2026-10-13,
  the user's ask; memory `llm-registry`): `isAcceptingReport: true` needs a
  name and an address and no model, and `toValidLlmRegistry` keeps it APART
  (`reportServers`, the first three) — never in `servers`, so no picker, no
  Auto pick and no Settings list can show it, and `toPublicRegistryServers`
  never sees it. An entry with the mark AND models is both: an assistant in
  `servers` and a report address in `reportServers` (one tunnel carrying
  an LLM server and the inbox, `llm-tunnel.mjs --with-reports`), the report
  half told to no window. `electron/llmReportHelpers.ts` is its one door
  (`LLM_REPORT_POST_CHANNEL`): the help window's **Send report** hands over
  the report's TEXT and its FILES, and main POSTs them — the entry's
  key as the bearer, to `baseUrl` exactly as written, on the relay's own
  session, no redirect followed — to each such entry in turn until one
  answers 2xx. **The body is JSON** (the same day, the user again: _the
  posting endpoint maybe have to accept json instead of raw text …
  `{"prompt":"…", "attachments":["base64 data", …]}` … and accept files like
  markdown pdf_; it was the text alone, `text/plain`, for a few hours):
  `genReportPostBody` in `customLlmProtocol.ts` is the one place that
  writes it — `{version, reference, prompt, attachments: [{name, mimeType,
  data}]}`, `attachments` always there. A file's kind is read off its NAME
  in main (`REPORT_FILE_TYPE_MAP`: pictures, PDF, text kinds; nothing that
  runs, no `.html` / `.svg`), never taken from the window, and
  `toValidReportFiles` refuses a name with a path in it, bytes that are not
  base64, more than 8 files, one over 5 MB or 12 MB together. When none
  takes it, or none is known, the registry is read ONCE
  more and whatever is new in it tried (a quick tunnel's address changes per
  start). **A report whose server is AWAY is kept and sent later**
  (2026-10-15, `electron/llmReportQueueHelpers.ts`): when every try ended
  `unreachable` or `timeout` — nobody said no — `handleLlmReportPost`
  writes the very body that was to go into `<userData>/pending-reports/`
  and answers `queued: true`; `sendQueuedReports` posts them (oldest
  first, through the same `deliverReportBody` a Send uses) a minute after
  start, every half hour, and at once after any Send that went through;
  stops at the first that still meets an absent server, lets go of one a
  server can never take (`too-large`, `not-allowed`) and of one a week
  old; five reports and 60 MB at most; nothing while AI is off. Found on
  2026-10-14: the admin's inbox, a quick tunnel on a laptop, slept for a
  day and a half and every report pressed then was _nothing was sent_. Ten seconds an address, forty in all — plus, for a body past 64 KB,
  a second for every 32 KB up to three minutes (`toReportUploadAllowance`:
  a picture and a PDF over a church hall's uplink) — five reports in ten
  minutes, 204 800 characters (200 × 1 024) of text; a failure comes back as a sentence
  written in main — never the server's words, never an error that names the
  host. Three answers are read apart: **413** is `too-large`, said first
  whoever else was asked, and the window sends the words alone; a **2xx
  whose JSON says `ok: false` or carries an `error`** is NOT sent (an LLM
  server answers an unknown POST with 200 and an error object, and an entry
  mis-set onto one must not read as _Sent_ — only the first 4 KB is looked
  at); and a registry that **could not be read** with no server known is
  _the list of report servers could not be read_, not _no report server is
  shared_. What takes it on the admin's side is the kit's
  `llm-report-inbox.mjs` (Node's own SQLite; the same three numbers and the
  same kinds, held together by a test), put online by `llm-tunnel.mjs
  --reports --publish`.
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
- **A lookup conversation's record is its FIRST turn** (2026-10-23,
  `EC-418`, `withRecordTurn` in `llmBotHelpers.ts`). A server of the
  person's own (Ollama, LM Studio, llama.cpp) keeps what the start of a
  conversation was and reads only what follows it; the record (~8 600
  characters for Genesis 8 with its cross references) had ridden at the end
  of every question, read afresh each time. Now the window passes it as
  `AskExtraType.lookup.record` and the loop puts it ahead of the history,
  with a fixed one-line reply (`RECORD_TURN_ACK`) so the turns alternate;
  the question carries one line naming its subject. Measured on a local
  Ollama, the second question's prompt processing went from 112 s to
  4.4 s. Same rule as the cached prefix above: the record turn must be
  byte-identical question after question -- nothing per question goes in
  it; what a question reads (`toLookupContextText`) goes under that
  question.
- **The prompt is per APP language; a question's language rides in the user
  turn** (2026-10-16, memory `chatbot-follows-app-language`). The language
  the app is shown in is fixed for a window's life (Apply reloads every
  window), so `genSystemPrompt(focus, isSeparateWindow, langCode)` keeps the
  cached-prefix rule above: English carries one bullet (_answer in English
  unless the end of their message names another language_), every other
  language ONE template filled from its `assistant.json` (answer in it,
  plainly, for older readers who may read NO English -- no English word, not
  in brackets, a Bible book by its own name, the app as "this app", only a
  key cap as printed (2026-10-17, `EC-289`: it had allowed English Bible
  references and the app's name); search the guide in ENGLISH words; keep
  `OPTIONS:` / `SHOWS:` / `NEEDS:` / `DO:` / `TRY THIS:` in English and a
  `REPORT:` in English; its own digits named, never used for steps). What a
  QUESTION is in changes per question, so it goes at the end of the ask
  (`genReplyLanguageLine`, appended in `askLlmBot`): nothing for English in
  an English app, `(Answer in Khmer.)` in a Khmer one, a sentence when they
  wrote in another language -- any language a person may type, by name
  (an installed language's `typed.json`), saying to name every button exactly as the tools
  and the guide give it and to write what follows `OPTIONS:` in that language
  (2026-11-03, `EC-449`: told _They wrote in French_ of a Spanish line, a
  model renamed the Font Size slider _Taille de police_ on an English screen,
  and the free tier wrote English options under Chinese answers). Only for an ask that carries `askedText` or
  `replyLang` -- the verse translation asks a model for ENGLISH and gets no
  line; the report passes the language of the person's complaint. **All of
  this is now for a Gemma 4 model only, or when nothing can translate**
  (2026-10-17, `chatTranslateHelpers.ts`, `chatbot-window.md`): any other
  model is asked in English under the ENGLISH prompt (`appLang: 'en'`, a
  second cached prefix), a Gemma 4 sub-assistant putting the question into
  English and the answer back (`isTranslation`: its own short
  `TRANSLATION_SYSTEM_PROMPT`, one round, no tools, `TRANSLATION_MAX_TOKENS`
  4 000 on a server of the user's own, where a Khmer answer is several times
  the English's tokens).
- **Waiting-input interpretation is a machine reply** (2026-10-18).
  Its current task facts take precedence over earlier chat. The imported
  Bible's selected language is separate from the interface and from detected
  languages; the facts follow history in the prompt so old choices cannot
  masquerade as the current selection. The live Gemma retest initially made
  that mistake, then answered Khmer correctly after this distinction.
  `isWaitingInput` selects a short JSON-specific system prompt, forces the
  general one-round/no-tools path, and returns the raw answer before prose
  framing/scrubbing. `waitingInputHelpers` validates the whole response;
  help text inside JSON must not be truncated at literal `OPTIONS:` words.
  The normal usage, cancellation and spend guard still apply.
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
  after its first read). A run over the WHOLE corpus reaches the cap in
  about forty-five minutes (2026-10-12, 404 questions at three rounds each):
  the kept driver counts its own rounds and waits (`corpus-run.mjs
  --pace=135`), marks the rows the guide answered while paused to be asked
  again, and leaves the press to the person. **The note says what paused it,
  not the hour as it now stands** (same day, `checkIsCapStillReached`):
  nothing is spent while paused, so the rolling hour empties under a latch
  time does not lift, and of 1 111 guide answers given under the note in that
  run not one named a count that reached the cap — 894 read _it has made 0
  model calls in the last hour, which is more than a person would ask for_.
  Once the hour no longer shows what set the latch, the note reads _it made
  150 model calls within one hour_ (or _within one hour it reached the $1
  limit_) and the head row _paused · limit reached_; the latch, the caps and
  the ledger are as they were.
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
- **Auto asks the best assistant that costs nothing, chosen again for every
  question** (2026-10-12, `src/chatbot/autoAssistantHelpers.ts` — the policy,
  no SDK and no store, every rule a test — and
  `autoAssistantSourceHelpers.ts`, which reads the live lists and asks the
  servers; the user's ask with the space under **Free** circled: _add `Auto`
  option, the chatbot should choose best no cost for user … check which one
  not busy and smarter and no cost then use it in asking_, then _keep `Auto`
  selected but do dynamic endpoint+model_). **Auto is not a provider**: it is
  `isAuto` on the tab and `chatbot-llm-auto` for a new one, because a seventh
  name in `LlmProviderType` is a crashed lookup in every exhaustive
  `Record`; the tab's `provider` / `model` hold whoever was asked LAST (a
  guess, `guessAutoPick`, until the first question), so everything that reads
  them still has one. **No cost**: the candidates are the custom servers
  `checkIsNoCostCustomServer` prices at nothing (this computer, the church's
  network, a registry server marked `isFree` — the ONE test `genCustomProvider`
  prices an answer by too) and the keyless models; a paid key is never spent
  by a choice nobody made, and a server on the internet that does not say it
  is free is out. **Not busy**: before the ask each server is asked
  `GET /models` and its own lists at once, 4 s for the lot
  (`checkIsCustomServerAnswering` — `readCustomServerModelInfo` cannot say
  it: a machine that is on with no server running refuses every door at once
  and reads there as "some other program"); one that answers nothing is out
  and is not asked again for five minutes (the ↻ beside the list forgets
  that); one this window is already asking in another tab
  (`PendingAskType.assistantKey`, the whole server), and one that failed or
  took over three minutes in the last ten (`markAutoSetback`), go to the BACK
  rather than out — when they are all there is, the best of them is still
  asked. No server says how long its queue is through the doors the relay
  forwards, so "busy" is those three things and no more. **Smarter**: the
  bigger model first, read off the size in its name (`readModelSize`: `9b`,
  `e4b`, `270m`; never a `128k` context) — the name is all there is to go
  by. The keyless models count as `FREE_MODEL_SIZE` 8, the one constant that
  draws the line between the user's own server and the public service, set
  from `extra-work/local-llm/model-benchmarks.json`: the free models 7 of 7
  in 8-20 s, a 9B on the church's card right in 20-30 s, a 4B right on 26 of
  47. So an 8B-or-bigger server model is asked before Free (as good, and the
  words stay in the building) and a smaller or unnamed one after it — there
  for the Sunday the internet is down. **A server's CLOUD model goes before
  all of them** (2026-10-17, `checkIsCloudModel`, the user's picture of their
  Ollama list with `gemma4:31b-cloud` and `gemma4:cloud` circled, then the
  order in so many words: _cloud/strongest -> cloud/stronger -> cloud/strong
  -> cloud -> non-cloud/strongest -> ..._): a model whose id or shown name
  ends in `cloud` (Ollama's `:cloud` / `-cloud` tags, run in Ollama's data
  centre on the owner's own sign-in) ranks above every other candidate,
  Free included, the bigger first and a size-less one last among them --
  after setbacks, busy servers, an unloaded LM Studio and a
  `preferModelPattern`, so a translation still goes to a Gemma 4 first and,
  among those, to its cloud rows. Its words leave the building, as Free's
  do; the manual says so. **And in a language other than English, the
  language's models go before the size order** (2026-10-20, the user's
  picture of the Auto picker and the order in so many words: _`gemma4:cloud`
  (from any assistant) -> `Nemotron Super VL` (from Free) -> `gemma4:31b` ->
  `gemma4:12b` -> any model in `Free`_ — _gemma4 … support well for language
  like Khmer_, _apply the ranking for non-english app language setting
  only_): `LANGUAGE_TIER_LIST` / `readLanguageModelTier` in the policy, five
  tiers read off the model's id AND shown name, and
  `AutoRankOptionsType.languageModelsFirst`, which the source helpers default
  from `getAppLangCode() !== 'en'` (a caller's own option always wins). A tier
  decides only among the models that CAN answer — setbacks, busy servers and
  an unloaded LM Studio still go first, and a model that cannot see still
  loses a picture question; a candidate no tier names falls through to the
  ordinary cloud-then-size order. **LM Studio serves what is loaded**:
  while one of its models is loaded only loaded ones are candidates, and with
  none loaded its rows are the last resort — its list is every file ever
  downloaded (a 27B beside an 8 GB card on the user's own server), and a
  model it loads by itself comes up at 4k. Ollama and a llama.cpp router
  load on the question and offer every row at its size. A model loaded under
  `CUSTOM_CONTEXT_MIN` is out (the ask would refuse it) except for `/btw`,
  and a question with a picture is put only to a model that sees.
  **A verse remembered in another script asks Gemma 4 first**
  (2026-10-16, `preferModelPattern` with `VERSE_TRANSLATION_MODEL_PATTERN`,
  the user's word: _for any translation attempt please prefer Gemma 4
  models_): ranked after setbacks, busy servers and an LM Studio with
  nothing loaded, before size -- so a loaded gemma-4-e4b answers a Khmer
  verse search ahead of the free service it ranks under by size, and the
  words stay in the building.
  **One that fails before answering hands the question on**
  (`askWithAutoAssistant`, three attempts): never after a model round came
  back — the model may have pressed something by then — and never for a
  Stop, the spend guard's pause or the app's own tool host. Each attempt's
  hint is worked out for the provider ASKED (`genKnownHint`: a local
  server's lean tool list). The answer carries a note only when somebody
  could not answer or the pick changed (`genAutoAnswerNote`); the wait says
  _Auto is checking which assistants can answer_ then _Auto picked …_.
  Report asks Auto's first pick once. Seen live 2026-10-12: eight servers,
  one answering (LM Studio with gemma-4-e4b loaded at 32k), four timing out
  at 4 s — _Auto picked Free · Nemotron Lightning_.
- **A server or free model the TAB names hands the question on too**
  (2026-10-22, the user, with a picture of _Local Ollama could not answer —
  nothing answered at http://localhost:11434/v1_ over a verse card the guide
  had written: _when one server provider fail it should try next one_). In
  the window's named branch, a failure before any model round came back
  (Auto's own rule: never after a round, never a Stop, the spend guard's
  pause or the tool host) asks `resolveHandOnPicks`
  (`autoAssistantSourceHelpers.ts`): Auto's candidates looked at and ranked
  with the SAME options as Auto's look (`genAutoRankOptions` — pictures for a
  Resources ask, the Gemma 4 preference, the busy keys), the failed one left
  out, and — when it was a server in the building (`checkIsLocalNetworkUrl`
  of its address; a shared server's stand-in address never is) — the
  building's other servers first (`orderHandOnPicks`, pure). Then
  `askWithAutoAssistant`, three attempts. Only a pick Auto could have made is
  handed on: a paid key keeps `getStandInLlmProvider` and nothing else, and a
  server on the internet that does not say it is free keeps its failure. The
  answer's note is `genHandOnAnswerNote` — who could not answer and why, who
  else was tried, who answered; the waiting line says _… could not answer —
  looking for another assistant that costs nothing_ then _Asking … instead_.
  **The tab KEEPS its pick**, unlike the paid stand-in: a server switched off
  is switched back on, and the next question asks it first again (its
  failure then costs the 4 s look at most — a server that answered nothing is
  remembered as away for five minutes). When nobody could, the note over the
  guide's answer names the tab's own failure and everyone tried after it
  (`describeSkippedAssistants`). This ends the old _never stands in or is
  stood in for_ of a custom server, and with it a promise: Auto's notice had
  said picking a server of your own keeps every question in the building; it
  now says that server is asked first and the question goes on to the other
  servers and then to the free service. **A question whose tools can only
  READ is handed on even after a round came back** (`canHandOnAfterRound`,
  on Auto and named alike): a Resources ask (`owa_resource_file`,
  `owa_lookup_record`, `owa_read_website`) and a general one (no tools). Seen
  the same day on Auto: _Explain it in simple words_ under `MAT.18.pdf`, Free
  · Nemotron Super VL _wrote no answer_ after 34.7k tokens and the guide
  answered; a model that wrote nothing pressed nothing either. Every other
  ask keeps the old rule -- **except an answer of NOTHING with no tool
  called in the whole ask** (2026-11-07, `genNoAnswerError` marks it
  `isNothingDone`, `checkIsNothingDoneError` reads it on the error or its
  `cause`, because `askLlmBot` rewraps every failure in a sentence): it
  pressed nothing, so it is handed on like a failure before any round, on
  Auto and from a named server alike. Seen live on a slide ask with a
  picture: the shared gemma4:cloud answered nothing three times of four,
  each time the end of the question; the same model on the user's own
  Ollama made the slides. **And the cause, measured the same night:** a
  tool call the server could not parse is DROPPED -- the reply comes back
  with ~170 tokens generated, no text, no call, `stop`. Replayed straight to
  both Ollama servers with the slide ask and the tab's history in front, it
  happened about one reply in six, at temperature 0 too and on the user's
  own server as well. So the OpenAI-shaped loop asks the SAME round once
  more when a reply came back empty with tokens generated while tools were
  on offer (`isDroppedReplyRetried`, once an ask, never on the last round);
  a second empty reply is the model's, thrown as before. **And the relay's failures are said
  in the window's language** (`describeRelayFailure` in
  `customServerClientHelpers.ts`, EC-385): _its server is not answering …_,
  _it went quiet …_ and _took too long_, whole sentences through the
  chatbot's `tran`; Settings keeps `describeCustomLlmFailure`'s English.
  **No sentence in the help window names a server's ADDRESS** (2026-10-22,
  the user, with `http://localhost:11999/v1` circled in the note: _should
  not show endpont to user_): the server's name is already in front of it,
  and a wrong path says to check the address in Settings, where Test shows
  it (`genWrongAddressText`). **The hand-on note offers the change**
  (the same day: _should provide user the option to change provider … like
  use another free or use `Auto`_): **Use <who answered> for this chat**
  and **Use Auto for this chat** under the answer
  (`genAssistantSwitchActions`, the pseudo tool `USE_ASSISTANT_TOOL_NAME`,
  caught in `handleActing`). The press moves THIS tab only and asks nothing
  again; `readAssistantSwitch` takes only `custom` / `free` and a model
  still listed, so a saved button can never name a paid key. Seen live on the
  dev chatbot in Khmer: the note with no address, both presses moving the
  head row.
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
- **A local program is asked at temperature 0** (2026-10-13,
  `LOCAL_TEMPERATURE` in `genCustomProvider`, `EC-258`). No request of the
  chatbot's carried a temperature, so a server of the user's own sampled at
  its program's default — and that, not the wording of any one page, is why
  asking every supported question of a 4B model more than once kept moving
  the wrong answers about: a reworded page ended the answer it was written
  for and another went wrong at the next asking (27 running-order questions,
  about one answer in seven wrong per asking, never the same ones). Measured
  on the user's LM Studio (gemma-4-e4b at 32k), the 27 asked twice through the
  window: at the default, not one of the 28 answers re-asked the night
  before had come back in the same words (some of those across a reworded
  page); at 0, on an unchanged page, **26 of 27 were word for word the
  same** —
  the 27th being whichever question is asked first after something else (the
  server's cached prefix differs, and a tie in the arithmetic falls the
  other way). Graded, that asking was 19 right, 6 partly, 2 wrong, against
  14 right, 9 partly, 4 wrong on the same pages the night before; and the
  two still wrong were now the SAME two at every asking, so they could be
  ended — their page reworded and the hint's own-words sentence
  (`agent-knowledge.md`): 18 right, 9 partly, 0 wrong. The job
  here is to say what a page says; a draw from the model's distribution is
  the wrong tool for it, and at 0 a fix to a page STAYS fixed and one asking
  is evidence about the next. Sent to LM Studio, Ollama and llama.cpp only
  (`LOCAL_TEMPERATURE_KIND_SET`): an unknown server may be a gateway in
  front of a model that fixes its own temperature and refuses the field.
  The kind is read in front of every question with a five-second wait, so
  the kind a server LAST said is kept (`lastServerKindMap`, one word a
  server) — a look that ran out once must not send that one question out
  sampled. The paid providers are left alone: the GPT-5 family and the
  thinking models take no temperature but their own. **What it does not
  do**: make a small model right. The same answer every time is the same
  WRONG answer every time until the page or the hint changes — and a change
  to a page re-rolls every answer written from it, so a page edit is
  followed by asking that page's rows again, not only the one it was for.
  **And the same answer needs the same words to the byte**: the foot note
  that rode with a page said the day of the copy, and a regenerated manual
  with no page edited changed all 27 answers — it no longer rides
  (`agent-knowledge.md`, _nothing that changes with a release may ride_).
- **A Retry asks a step harder, on purpose** (2026-11-10, `EC-476`,
  `AskExtraType.retryAttempt` from the window's rotate icon,
  `answerRetryHelpers.ts`): the one ask that sets the dials above aside.
  `genRequestExtra(model, retryAttempt)` -- GPT-5, Kimi K3 and Bedrock's
  OpenAI models step `reasoning_effort` low → medium → high; Claude 5
  (`askAnthropicCompatible`) gets `output_config.effort` one level a try
  above the model's own default (medium on Haiku 5.5 / Opus 5.5, high on
  the rest), never `max`, and none to Haiku 4.5, which refuses it;
  `max_tokens` / `max_completion_tokens` is doubled for the thinking (a
  server of the user's own too); a local program (`genCustomProvider`) is
  sampled at 0.7, then 1.0, and a general question is let think. Seen in
  the requests a live help window sent to OWA Shared (a non-pausing
  conditional breakpoint in `relayFetch`, the relay forwarding the body
  unchanged): plain `gemma4:cloud` / temperature 0 / 2 000; first Retry
  `gemma4:31b` / 0.7 / the hint; second Retry `gemma4:cloud` / 1 / 4 000.
  And to api.openai.com (an invalid key, no cost, the window's requests
  read over CDP): gpt-5 `reasoning_effort` low / 6 000, then medium /
  12 000, then high / 12 000, the hint on both retries. Free and an unknown server get no new
  field. A translation's sub-ask never carries it. An ordinary ask is
  byte for byte as before, so the cached prefixes and the graded defaults
  hold. And a retry is asked of SOMEONE ELSE where there is one -- Auto's
  line with the assistant that wrote the answer last, or a paid key's next
  model -- for that question alone; `chatbot-window.md` has the rule.
- **An answer written from a CUT question is not shown** (2026-10-16,
  `EC-271`, `askCustomServer` + `genContextCutText`). Ollama loads a model
  on the question at its own default context and, at 0.40.3, cuts a longer
  question down to fit and answers it without a word: `gemma4:e4b` at 4 096
  read 2 051 tokens of a ~13 000-token ask, twice, through Auto. The refusal
  before a round sees only a model already loaded under 16k. So a model that
  was NOT loaded is read once more after the answer, and a context under
  `CUSTOM_CONTEXT_MIN` throws: the note says it answered from part of the
  question and gives the setting to change, and the guide answers. Never for
  `/btw`, which fits 4k. Not done the other way round (remembering the context
  to refuse up front): a setting fixed while the model is unloaded would be
  refused for good.
- **The free list is the gateway's, and it moved** (2026-10-16, `EC-267`):
  Kilo withdrew Nex Pro and Step Flash (404 _does not exist_), so two Free
  rows of three failed every question and no free model saw a picture. It is
  Nemotron Super VL (sees pictures), Nemotron Super, Nemotron Lightning now,
  each asked seven corpus questions through the window first, and Free has
  its own `FREE_MAX_TOKENS` (6 000): the new models think out of the cap, and
  at the old 2 000 one answer was cut mid-sentence and one came back empty.
- **The model removes ONE of the person's things an answer**
  (2026-10-17, `EC-299`, `MAX_MODEL_REMOVALS_PER_ASK` in `runMcpToolCall`).
  Told _delete everything, I'm fed up_ and then _yes, really, delete!_ in
  Khmer, the free model moved TEN things to the trash in one answer — a song,
  four Bible lists, five notes files, the Default ones among them — until the
  firewall's removal budget (10 in 5 minutes, every door) refused the next.
  Each went to the trash with an undo id and was put back, but an elderly
  volunteer would not know there is an undo. Now any `delete…` / `remove…` /
  `trash…` action after the first in one ask is refused with a sentence
  (say what was removed, that it can be put back, ask which ONE is next, by
  its name). The firewall's budget is still the backstop; this is the
  chatbot's own rule, beside the refused Bible `import`.
- **A model that thought its budget away starts the next asks with thinking
  off** (2026-10-17, `EC-308`, `rememberReasoningOff` /
  `checkIsReasoningOffRemembered` in `askOpenAiCompatible`). EC-211's retry
  stays as it was -- an answer that was all thinking is asked once more with
  `reasoning_effort: "none"` -- and the model it happened to is then asked
  with thinking off from its FIRST round for half an hour (one entry a model
  and server, the gone ones dropped at every write). Measured on the user's
  LM Studio, the whole corpus asked in Khmer of gemma-4-12b: every question
  thought its budget away, so each was two rounds of ~12 000 tokens and
  ~95 s for the one answer the second round wrote; with the memory, one
  round and 6-9 s. Thinking is still on for a model that has not shown it,
  the tool-loop decision above.
- **A reply in a shape nobody can use goes back ONCE** (2026-10-17,
  `EC-304` / `EC-305`, `findAnswerShapeNudge` in both loops beside
  `checkIsStepsWithoutPage`, `isShapeNudged`): a reply that is only its
  frames (_Can you start a 5 minute countdown?_ started one on two screens
  that were OFF and came back as two chips under no words) and one that ran
  away into one letter (_សេវាកម្ម_ and then _ម_ nineteen hundred times, to
  the round's 2 000 tokens) -- the second kept in the conversation only up
  to where it broke. A run that still reaches the last round is cut where it
  started (`cutRunawayAnswer`), and a model's own control token printed as
  words (_ច<audio|> View_, gemma-4-12b) is taken out of the words and the
  chips (`dropModelTokens`, which also draws a LaTeX `$\rightarrow$` as →).
  **And one in the wrong language** (2026-11-04, `EC-460`): a Thai
  question in a Khmer window, told _answer in Thai_, came back wholly in
  Khmer once of twice. An answer that must be in a language with a script
  of its own (`toAnswerScript`, never Latin) and holds none of its letters
  in 30 or more goes back once (`checkIsWrongScriptAnswer`). **And a note
  change claimed and never made** (2026-11-09, BN-53, the elder run: _draw a
  big star next to the important bits_ -- Free's Nemotron called no tool and
  answered that it had added a gold star, centred and larger): an answer in
  a note ask that says it changed the note (_I've added_, _not saved yet_,
  _Undo this change puts it back_ -- a bare _I put_ is also an offer, so not
  that) while no `owa_note_edit` edit changed it, no note was made and no
  undo or redo stepped (`isNoteStepped`) goes back once with
  `NOTE_CLAIM_NUDGE`: make it now, or say plainly it was not done
  (`checkClaimsUnmadeNoteChange`). And an edit that changed nothing answers
  _Nothing was changed: the note already reads that way. Tell them so --
  never that you changed it_: asked to lay a drawing out across that
  already was, gemma4:cloud had answered "I've updated the drawing".
  **And a lesson of its own goes into a NEW note** (BN-55, the same run):
  _make me a whole lesson about forgiveness_ in the conversation about a
  Good Shepherd lesson had been written over it. `NOTE_SYSTEM_PROMPT` says
  the note changes only when the words ask for something in it (a greeting
  had a misspelt line corrected), that words written for this lesson go into
  it, and that a lesson on another subject or for another group is a new
  note; and a typed ask for one carries `NOTE_NEW_LESSON_HINT`
  (`checkIsNewLessonAsk` in `noteChatHelpers.ts`, added by `toNoteAsk`),
  a line that only greets or asks -- no word for anything done to the
  note -- `NOTE_QUESTION_HINT` (`checkIsNoteQuestionOnly`): _HELLO CAN YOU
  HELP ME_ had the note's misspelt line corrected, unasked. And a worry
  right after a change (_the letters went all big suddenly_, _everything is
  blue now_) is put back with `undo`, never a new change that only looks
  like it -- it had been Clear Formatting on every block, the headings made
  plain lines (BN-57).
- **Steps written with NOTHING looked up go back once too** (2026-10-17,
  `EC-311`, `checkIsStepsWithoutPage` with `ToolWatchType.toolCallCount` /
  `canSearchGuide`): the Khmer stress run on gemma4:cloud wrote every list
  of a pasted story and of a ten-turn chat from memory — _the show button
  with an eye on it_ — because the rule waited for a search. Now numbered
  steps with no tool called at all, in an ask that can search the guide (not
  a verse search, a `/btw` question or a translation), are handed back with
  `genOpenPageNudge`'s _written from memory_ sentence. A state answer, which
  read the app first, still keeps its steps.
- **The menu bar is English in every language, and the prompt says so**
  (2026-10-17, `EC-313`, `genLanguageRule`): told to write no English word,
  a model put the menu bar's Help into Khmer (_ជំនួយ → គន្លឹះទាំងអស់_) —
  the ? button's word, a menu with no tips in it. File, Edit, View, Tools,
  Window and Help, and a menu item the page writes in English, are written
  as the page writes them.
- **A model the server could not LOAD is said so** (2026-10-17, `EC-309`,
  `modelLoad` in `providerIssueHelpers.ts`): LM Studio's 400 _Model loading
  was stopped due to insufficient system resources_ had matched the
  no-credit words on "insufficient", and a person was told in Khmer that
  their account was out of money. Read before the money words; the sentence
  says to pick a smaller model or close another one on that computer.
- **An answer from a named page part is read once more for the job's
  steps** (2026-10-18, `EC-330`, `genCompletenessNudge` /
  `pickCheckedAnswer` in both loops, `ToolWatchType.canCheckCompleteness`).
  Fresh passes of the whole list in Khmer on gemma4:cloud levelled at 88-89%
  right, the rest stopping before the step that finishes the job with it
  quoted. A known question whose hint named the part that answers goes back
  once: add the missing step in the page's words, or reply KEEP and the
  first answer stands. A custom server or Free only -- a paid key is not
  billed a round nobody chose -- never on the last round. Beside it,
  `checkIsDoneWithoutTool` (`EC-325`) hands back an ask to put something up
  that ended without the tool that does it: gemma4:cloud had said a
  countdown was started having called nothing.

- **A fifth tool offered to one kind of ask** (2026-11-06): `owa_lyric_edit`
  goes to a `lyric` ask -- a question while a `.owl` is open in the tab
  (attached now or still open), unless the typed words are a corpus row --
  under `LYRIC_SYSTEM_PROMPT`, six rounds, the song read fresh into the user
  turn (`toLyricAsk`), and on a custom server's lean list. ~519 tokens to
  that ask alone; the ordinary list and its ratchet did not move (~8 348 of
  8 350). The WINDOW turns the song's name into its path
  (`resolveLyricEditFile` in `runMcpToolCall`), a path the model writes is
  refused, and outside a lyric ask the tool is refused. On Auto a
  translation prefers a Gemma 4 model (`checkIsLyricTranslateAsk` →
  `preferModelPattern`).

- **A sixth tool offered to one kind of ask** (2026-11-07): `owa_slide_edit`
  goes to a `slide` ask -- a question while a `.ows` is open in the tab --
  under `SLIDE_SYSTEM_PROMPT` (`src/chatbot/slideChatHelpers.ts`), eight
  rounds, the document read fresh into the user turn as plain lines
  (`toSlideDocumentText`, every box's words whole), any picture attached
  riding with it, and on a custom server's lean list. ~758 tokens to that
  ask alone; the ordinary list and its ratchet did not move (~8 343 of
  8 350). The WINDOW turns the document's name into its path
  (`resolveSlideEditFile`, the song's `resolveAttachedDocumentFile`), a
  path the model writes is refused, and outside a slide ask the tool is
  refused. The prompt's two rules that a first live run needed: words the
  slides already hold (a translation, a fix, a title) are not new words --
  _add above the khmer text_ had been answered _I need the English words_
  -- and a request with one sensible reading is done, not asked about,
  because every change is undone by one press.

- **Another tool offered to one kind of ask** (2026-11-07):
  `owa_presenting_flow_edit` goes to a `flow` ask -- a question while a
  `.owpf` is open in the tab -- under `FLOW_SYSTEM_PROMPT`
  (`src/chatbot/flowChatHelpers.ts`), eight rounds, the sheet read fresh
  into the user turn as plain lines with the Documents names, actions,
  foreground widgets and screens, any picture riding with it, and on a
  custom server's lean list. ~1 070 tokens to that ask alone; the ordinary
  list and its ratchet did not move (~8 343 of 8 350, measured with
  `audit-mcp-tools.mjs --stdio --ratchet`); `owa_presenting_flow` is still
  on it for the ordinary question.
  The WINDOW turns the flow's name into its path (`resolveFlowEditFile`),
  a path the model writes is refused, and outside a flow ask the tool is
  refused. The prompt's rules: many changes in ONE `update-lines`, lines
  named by their number as given and never renumbered, a document only by
  a name the Documents list has (never a made-up song), a Next: Timeout CC
  on a song for "move on by itself", a change kept at once with no Save.
  The card's buttons each carry a hint saying the job (`readFlowButtonHint`,
  the English or the window's own words).

- **And one for a Bible note** (2026-11-07, the user: _add `Open in
  Chatbot` for bible-note … goal: chatbot can help modify and answer
  everything on bible-note_): `owa_note_edit` goes to a `note` ask -- a
  question while ONE note of a `.own` file is open in the tab
  (`ChatAttachmentType.noteId`) -- under `NOTE_SYSTEM_PROMPT`
  (`src/chatbot/noteChatHelpers.ts`), eight rounds, the note read fresh from
  its editing head into the user turn as numbered blocks in a light mark-up
  (`toNoteDocumentText`), on a custom server's lean list, and with
  `owa_help_search`, `owa_help_page` and `owa_find_verse` shared to it
  (`MODEL_ASK_SHARED_TOOL_MAP.note`): how the note EDITOR works is its own
  guide's, and `runMcpToolCall` aims every `owa_help_search` of a note ask
  at `focus: 'bibleNote'`, the one search that sees the guide's pages
  (`agent-knowledge.md`); a guide page offers no walkthrough outside the
  note window (`genGuideActions`). ~489 tokens to that ask alone; the
  ordinary list and its ratchet did not move (~8 343 of 8 350,
  `--stdio --ratchet`). The WINDOW turns the note's NAME into its file and
  id (`resolveNoteEditTarget`); a `file` or `id` the model writes is
  refused, so is a note that is not attached, and outside a note ask the
  tool is refused. **Two attached notes never share a name** (2026-11-08:
  notes are titled by the day, and the first of two of a name had been the
  one changed): `findNoteAskFiles` puts the file's name after a shared
  title (`Sunday (Youth)`), and its number in the file when that is shared
  too (`#7`); a name that still fits two is refused, never guessed. The
  prompt also says a verse token names its Bible (`[^(KJV) John 3:16]`),
  that another Bible's verse is written that way in place of the old
  token, and to report only the Bible the summary names
  (`agent-tools.md`). The prompt's rules: every change in ONE `edit`, block
  numbers as read, mark-up and mention tokens kept, a verse never the
  model's words (a `passage` block or a new `[^ref]` token, read by the app
  from the installed Bible), a tidy that keeps every block's words, a verse
  named plainly in the answer. **One rule a live run needed** (2026-11-08,
  gemma4:cloud): asked to tidy, it turned a paragraph into a heading of
  OTHER words and the paragraph was gone; a change that gives a block
  another kind and fewer than half its own words is refused now
  (`checkLosesWords` in `agentNoteBlockHelpers.ts`), and asked again it
  added the heading as a new block. `owa_bible_note` stays on the ordinary
  list (the `write-a-note` row needs it), and is shared to a note ask for a
  NEW note only (the bullet below). **Text size** (2026-11-08, the
  user: _check why chatbot can't help increase text size_ -- _make text
  bigger_ had been answered with the toolbar's steps, and the two
  walkthrough buttons under that guide page both failed): a change takes
  `size` ("larger" / "smaller" / px 8-72), and the short English asks the
  slide card reads (`readSlideSizeAsk`: _make the words larger_, _make text
  bigger_, _make the words 20 px_) are done by the WINDOW with no model
  (`genNoteSizeChanges` → one `size` change a block, `genNoteSizeDoneText`),
  like the slides'. Measured live: no assistant asked, the h1 24 → 30 px,
  the lines 15 → 19; _make only the heading bigger_ went to gemma4:cloud,
  which sized the heading alone. **The whole toolbar** (2026-11-08, the
  user: _make chatbot able to use all toolbar operations_): the prompt
  says the toolbar is the model's to USE, never to explain, lists its
  fields and the Insert kinds, and shows ONE change as an example --
  without it gemma4:cloud, asked to make one word red, sent bold and
  alignment for the whole line, no colour, and said it had; with it,
  one right call. The note read carries a `Fonts:` line. The tool is
  ~1 021 tokens to a note ask (was ~489; ~878 before the drawing, the
  example, block links, the ¶ and a code block's language joined); the
  ordinary list and its ratchet did not move (8 343 of 8 350). A style
  for the WHOLE note in a short English line is the window's, like the
  size (`readNoteStyleAsk`, `genNoteStyleChanges`,
  `genNoteStyleDoneText`), and the ¶'s answer (`view`) carries **Undo
  this change** as an edit's does. **In every language** (2026-11-08, the
  user's goal _work great for all languages_; five languages run live on
  a scratch profile, each with a Bible of its own): a note ask put into
  English for an assistant that is not a Gemma 4 carries the TYPED words
  beside their English (`toNoteOwnWordsHint`, put on the ask by the
  window's `withLyric` on the English path) -- a word of the note, or words to
  write in, do not survive a translation, and _make the word … red_ had
  come to the model as an English word the note does not hold; the window
  hands `verseLang` (the language asked in, when not English) on
  `AskExtraType.note`, and the loop fills a NEW verse's `bible` with an
  installed Bible of that language when the Lookup's is not one, looked up
  once an ask (`owa_find_verse` with no arguments) and only for an edit
  that adds a verse (`checkAddsNoteVerse`, `findNoteVerseBible`; BN-26:
  asked in Khmer, John 1:1 had come from the KJV the Lookup was on). The
  hint says the words put INTO THE NOTE are theirs and the ANSWER stays
  English (BN-29: told "words you write for them" were Khmer, Free's
  Nemotron answered in broken Khmer, which skipped the translation back),
  and the question's translator keeps words they want WRITTEN somewhere as
  written (`toQuestionTranslationAsk`, every translated ask: with the hint
  alone the model still wrote its own Khmer for a typed line, 3 of 4 runs;
  with the translator keeping it, the typed line exactly, 2 of 2; with
  neither, English, 2 of 2). A note named a letter out -- a Khmer subscript
  written with its look-alike -- is the ONE attached note
  (`resolveNoteEditTarget`, BN-30). Words they TYPED to go into the note
  go in letter for letter: the window hands the typed words with the ask
  (`AskExtraType.note.typed`), and each `owa_note_edit` change's `text`
  and a new `title` are put back to them where only a pair of look-alike
  letters a language names differs (`restoreTypedWords`,
  `listLookAlikePairs`; BN-37: Free's Nemotron wrote a typed Khmer line
  with TA's subscript for DA's -- the same on screen, not to a search). The size and whole-note style
  shortcuts above read any language too, from its
  `assistant.json` (`textSizeAsks`, `noteStyleAsks`, `colorWords`;
  `languageEditAskHelpers.ts`, BN-16), and every other installed language's
  `typed.json` carries the size (larger, smaller) and bold for the whole
  note (BN-31, 85 languages) -- what it does not say goes to the model.
  **A change made and THEN a failure is answered with the change**
  (2026-11-08, BN-36, `genChangedWithoutAnswer` in `askLlmBot`'s catch):
  on Free's Nemotron, three typed lines of twelve went into the note --
  once with a stray _Test line_ of the model's own -- and the model then
  wrote nothing or the service failed, and the window said only _Free could
  not answer_, no word of the change and no button to take it back. Any
  ask whose tools changed a song, slide document, run sheet or note
  (`watch.editedLyric`) now answers such a failure _"<name>" was changed,
  but the assistant stopped before saying what it did. Undo this change
  puts it back._ with **Undo this change** and **Show it in the list**,
  as a finished change has; a Stop and the spend guard's pause are thrown
  as before. Auto never hands such an ask on (a round came back), so no
  second assistant makes the change again. Seen live with a stand-in
  model that changes the note and then answers nothing: the sentence, the
  two buttons, and Undo putting the note back.

- **A NEW note, from any conversation that teaches** (2026-11-08, the
  user, with a Bible Reader chat that answered _make a bible note for me_
  with words to copy and paste: _chatbot should be able to create new bible
  note (not allow delete), after create should open the note and attach to
  the chatbot session_, then the goal _chatbot can put a lesson to a new
  bible note for user_). The line under a Reader answer was a
  `bible-reader` ask, offered four reading tools and nothing that writes.
  `owa_bible_note` is now shared to the `bible-reader`, `lookup`,
  `resources` and `note` asks (`MODEL_ASK_SHARED_TOOL_MAP`, ~304 tokens a
  round to those asks alone; the ordinary list already carried it and its
  ratchet did not move, 8 343 of 8 350), and the first three prompts carry
  `NOTE_CREATE_PROMPT` (`src/chatbot/noteCreatePromptHelpers.ts`, a leaf):
  make it at once, the `title` and `text` the model's own, a lesson given
  whole, `#` / `-` / `**` and `[^Genesis 2:7]` for a verse; never ask what to
  write -- told only that it could, gemma4:cloud answered "what would you
  like the title and the text to be?"; `NOTE_SYSTEM_PROMPT` says the same
  for a new note beside the attached one. The window reads the note an `add`
  made off its RESULT (`readCreatedNote`: `added`, `id`, the `filePath` the
  app answered with -- never a path the model wrote), the answer carries it
  (`LlmBotAnswerType.createdNote`) with **Undo this change** and **Show it
  in the list** (`genCreatedNoteUnder`, after a Reader's or a lookup's own
  buttons, `withCreatedNoteUnder`), and `ChatbotAppComp`'s
  `openCreatedNoteRef` opens the note's window (`noteWindowOpenHelpers.ts`,
  the row's own **Open**) and attaches it to the tab it was asked in through
  the very path a row's Open in Chatbot takes (`attachHandedFileRef`: the
  chip, Bible Note, the note's window, its card). **Never a removal**: a
  model's `delete` / `delete-file` of `owa_bible_note` is refused in every
  ask (`NOTE_REMOVAL_MODEL_REFUSAL` names the row's own Delete), and in a
  note ask everything but `add`, `list` and `read`
  (`NOTE_ASK_BIBLE_NOTE_REFUSAL`) -- `update` writes a note back as plain
  paragraphs, and the attached note is `owa_note_edit`'s. **And an answer
  goes INTO the attached note** (the same day, the user's picture of a note
  chat answering _new page_ under a lesson with "replace the words or add the
  translation under?": _chatbot should understand and can append the lesson
  content to new section_): `NOTE_SYSTEM_PROMPT` says a short line right after
  an answer (_add it_, _put it in_, _new section_, _new page_) puts THAT answer
  at the end in one edit -- a `page-break` first for "page", then a `section`
  of mark-up lines -- and that only words asking to translate, or naming a
  language, are a translation. Its example names the lines in words, not as
  `
`: shown `
`, gemma4:cloud wrote it out as two characters. Live: one
  edit, the lesson after a page break, no step from the open window. Seen live on a
  scratch profile, gemma4:cloud: a Reader summary, a second note from that
  note's chat, a Reader word lesson and a passage chat's explanation, each
  one call, each opened and attached.

- **A preaching lesson, made and prepared by asking** (2026-11-10, the
  user's goal: _chatbot completely smart enough to help prepare a best
  preaching lesson_; BN-60..BN-63 in the `owa-enhance-bible-note-chatbot`
  ledger). What a lesson HOLDS -- the passage read first, a big idea,
  background, an introduction, three points each with its verses, what it
  means, an example and how to live it, Pointing to Jesus, a response, a
  written prayer, questions, a memory verse -- is `PREACHING_LESSON_SHAPE`
  (`noteCreatePromptHelpers.ts`), ~190 tokens when it was added (~968 since BN-82) put on a LESSON ask alone,
  never in a prompt: `LESSON_MAKE_HINT` where no note is attached
  (`askLlmBot`, only beside a tool list holding `owa_bible_note`) and, in a
  note ask, the one hint `genNoteLessonHint` picks -- the empty note's (the
  lesson goes INTO it), a new lesson's, _finish my sermon_'s, _make it fit
  15 minutes_' or _is this a good sermon?_'s -- and, while the note is
  still empty, the answer to its "which passage?" (`isLessonContinued`, off
  the tab's earlier question: a passage pressed alone had been written as a
  fifteen-line outline). The readers are English in code; a language's own
  are `lessonAsks` / `verseCheckAsks` in its `assistant.json` (French and
  Khmer so far, BN-65 -- a Gemma 4 is asked in the person's language,
  untranslated), acted on only in an empty note or a chat with no note.
  **A long call nested in
  `changes` is what the shared gemma4:cloud server DROPS**: replayed
  straight to it, a whole sermon in `owa_note_edit`'s `changes[].text` came
  back as no text and no call 7 times of 8, as one flat `owa_bible_note add`
  `text` 5 of 5 -- so an add in a conversation about ONE note that holds
  nothing is written into that note by the window (`toBlankNoteFillArgs`,
  `AskExtraType.note.blankBlockCount` from `readBlankNoteBlockCount`). A
  note ask or a lesson ask is `isLongWrite`: a custom server writes it with
  `LONG_WRITE_MAX_TOKENS` 6 000 (a help answer's 2 000 cut a sermon) and its
  lean tool list keeps `owa_bible_note`, which it had never had -- a new
  lesson on Auto had reached it only when the model guessed the name. **What
  a model writes anyway is read**: a list sent as JSON text
  (`toListArgsRead`), changes with no `action` (an edit, and counted as one
  by the watch -- `watchedArgs` -- or the claim nudge sends a done change
  back and the model makes it again on a note that has moved), the same
  document edit twice in one reply (run once; a press twice still twice),
  and an empty reply about an empty
  note asked again for the flat add (`NOTE_BLANK_DROPPED_NUDGE`). **_Check
  my verses_ is read by the
  window**: every verse the note cites, one `owa_find_verse refs` a Bible
  before the ask (`collectNoteVerseRefs`), set beside the note's own line
  about it (`toNoteVerseReadText`) -- told only to check, the model said
  all were right having read none; told only what the Bible says, it
  missed Isaiah 53:5's words credited to 53:6; side by side it named them.
  Measured live on a scratch profile, Auto -> gemma4:cloud: a sermon into
  an empty note in ONE call, 9-15 s, before 70-134 s through two failed
  servers and Free; twelve follow-ups one call or an answer each, 3-8 s.
  **In every language, and from the empty note's own buttons** (BN-64,
  BN-65): `LESSON_OUTLINE` (~70 tokens) rides `NOTE_SYSTEM_PROMPT` and
  `NOTE_CREATE_PROMPT` whatever the language, and an empty note's card
  offers three lesson buttons, read as a lesson asked for in any language
  (`checkIsLessonCardAsk`); a refused fill of the empty note leaves the
  redirect for the next try. **_Finish my sermon_ is placed by the window**
  (BN-67): `genLessonGapsText` names each missing part with the block it
  goes after (the end of the part before it in the shape's order, a
  point's own last line for its words), `checkIsBareFinishAsk` reads
  _finish it_ beside a lesson (`checkIsLessonNoteText`), and a note of
  loose lines is `readNoteRewrite`'s: `NOTE_LESSON_REWRITE_HINT` asks for
  ONE flat `owa_bible_note add`, which the window writes in their place
  (`toBlankNoteFillArgs`) only when every line of theirs is in it
  (`findLostNoteLines`; else refused, naming the lines), and an EDIT that
  weaves them into a lesson takes out each raw line its new words hold
  (`withRewrittenLinesRemoved`). A dropped reply about a note with words
  in it is asked for in parts from the end of the note up
  (`NOTE_DROPPED_NUDGE`); about loose lines, flat (`NOTE_REWRITE_DROPPED_NUDGE`).
  **"Best" is measured against a written standard by blind readers**
  (BN-66, the skill's `lesson-rubric.md`), never by the assistant that
  built it: the lesson shape READS the passage first (`owa_find_verse`) and
  builds every quote and verse number on its words -- asked only to be
  true, the model quoted from memory and invented history (accuracy 1.88
  -> 1.13 of 2 as the lessons grew richer); read first, factual errors
  2 -> 0 by one reader and accuracy up by the other. **_Is this a good
  sermon?_ is the way from good to best** (BN-72): judged in the readers'
  order of weight, its fixes offered as buttons that SAY the change; a
  review with none goes back once for them (BN-74, `isLessonReview`,
  `NOTE_REVIEW_OPTIONS_NUDGE` -- one more round of a free model, because a
  fix the elder cannot press is a fix not made) and, still without, offers
  the fixes it named (`readReviewFixHeadings`, BN-77); a fix pressed leaves
  the review's others as the first buttons under its answer (BN-77); the
  review is told the form the tab asked for (`readLessonFormAsked`,
  BN-78), and a devotion keeps its one point, a children's lesson its
  story, whatever the review offers. A
  length asked for in minutes rides as a number of WORDS
  (`genLessonLengthLine`, BN-73: told a rate, the model wrote its one
  template whatever was asked). **A quote of the passage is its words**
  (BN-76): a note ask keeps what it read (`ToolWatchType.noteQuoteSources`:
  the ask, `owa_find_verse` results, reads of the note), and an
  `owa_note_edit` change -- a fill of the empty note included -- whose
  quotation takes most of its words from that without being word for word
  is refused once an ask (`findNoteMisquotes`), and a quotation that names
  its own chapter and verse is held to that verse, which the window reads
  itself (BN-110, `findCitedMisquotes`: a verse quoted from memory and never
  read had been let by); the blind readers' commonest
  error, and any error keeps a lesson out of Best. **A fix to a lesson
  carries the lesson's rules and adds, never operates** (BN-79, BN-80): a
  change asked in a lesson note (a change verb, no lesson hint of its own)
  carries `NOTE_LESSON_CHANGE_HINT` -- from the passage as read, no detail
  it does not give, a point added in the passage's order -- and an edit in
  it that moves or takes out a block the words did not ask to move or take
  out is refused (`findLessonChangeSurgery`, `ToolWatchType.isLessonChange`):
  done as block surgery, two fixes had broken a sermon's shape. **The draft
  is the lesson** (BN-81: two blind readers found the review loop does not
  lift a lesson on the free model): the shape asks each point to explain
  the word, image or custom a hearer would miss from the Bible's own pages
  (read with `owa_find_verse`), an example as a short scene from the
  hearers' own week, and a person's reason or message only as the passage
  states it, the whole story read first; and while the note is still
  empty, an `owa_note_edit` that is a question is refused as the add's
  redirect refuses one (`isBlankLesson`). **A point is a template** (BN-82,
  2026-11-11): told in one sentence what a point holds, the model wrote one
  paragraph that said the verse again; each point is now labelled lines --
  **What it means:**, **A hearer asks:**, **The passage answers:** (its own
  line: told "the question, answered", it wrote only the question), **For
  example:**, **This week:** -- the passage is read with the verses before
  it for the background, it runs about twenty verses at most, Pointing to
  Jesus starts from a phrase of the passage, and a funeral comforts from
  the passage's promises with no discussion questions (~968 tokens, lesson
  asks only). **A new lesson's points follow and cover its passage**
  (BN-83): written into the empty note, a lesson whose numbered points stop
  before the passage at its top ends, or put a point whose verses all come
  before the point above it, is refused once an ask
  (`findLessonPointsProblem`, `ToolWatchType.isLessonPointsChecked`).
  **A preaching message is a lesson ask** (BN-85): _a message of hope for a
  funeral_ held no lesson word, carried no lesson hint in any run, and was
  written from the short outline -- a "message of hope / on / about /
  from", and a funeral's message or talk, are read as one now
  (`checkIsLessonWriteAsk`). **The passage is READ whole** (BN-86):
  `owa_find_verse refs` had cut it at a found verse's 300 letters, so a
  lesson was built on its first verses and the rest came from memory --
  every factual error both readers found in BN-82's lessons sat in those
  verses, and the misquote check had nothing to hold them to; a passage is
  given whole now, within 6000 letters a call (`agent-tools.md`). **An
  empty note is empty while its window opens** (BN-87): the read before the
  ask had failed on a busy computer and the lesson went into a NEW note;
  an empty note's read is now worked out from its file
  (`readBlankNoteFromFile`). **The window reads what the model would
  otherwise make up** (BN-89, BN-91): in an empty note's lesson ask, the
  first `owa_find_verse refs` naming one passage also reads the verses just
  before it (`findVersesBeforeRef`) -- before the passage the ask NAMED
  when that read is in its book (BN-105, `pickVersesBeforePassage`: read
  from 3:1 for Proverbs 3:5-6, Proverbs 2's strange woman had been told as
  "just before"), and the note names it. The model had invented backgrounds;
  now it tells them from those words (`genVersesBeforeNote`). That read also
  carries Scripture's own explanation of each KJV word its text holds that
  a preacher stumbles on (`lessonWordGlossHelpers.ts`, eight at most), because
  the commonest errors left were the model's memory of words: the hundred
  pence as "a small amount". Such an entry is copied word for word wherever
  it fits, so each one gives the unit AND how it counts, every sense the
  Bible gives the word, or matches only the sense it gives, and it opens on
  what corrects the commonest misreading (BN-92: "create" opened on Genesis
  1:1 and was still read as "out of nothing"). The note over the list keeps
  every point explaining its own verses: told only that a What it means
  line says this of the words, a point holding none of them explained
  nothing. Each line of a point also says what it may not add (BN-88), and
  the Introduction is never "Have you ever" (BN-90).

- **And one for a foreground session** (2026-11-09, the user: _chatbot can
  help modify any foreground component_, then _sessions of opening
  foreground component should be able to attached to the chatbot for the
  chat context_; W-61, `agent-tools.md`). `owa_foreground_edit` goes to a
  `foreground` ask -- a question while a foreground session is open in the
  tab (`chatbot-files-report.md`), or a TYPED line naming a component
  (`readForegroundComponentAsk`: the launcher's labels through the window's
  `tran`, English and a few English words -- timer, ticker, scrolling text;
  Messages and Time by a phrase only), about its active session -- under
  `FOREGROUND_SYSTEM_PROMPT` (`src/chatbot/foregroundChatHelpers.ts`), eight
  rounds, the session read fresh into the user turn (`toForegroundAsk`), on
  a custom server's lean list, with `owa_list_screens`, `owa_click`,
  `owa_help_search` and `owa_find_verse` shared to it. A known corpus row
  still wins (`findKnownQuestion`). The WINDOW turns a session NAME the
  model writes into its id (`resolveForegroundSession`; Default by its strip
  name too), and outside a foreground ask the tool is refused. A change
  (`changed`, `shown`, `hidden`, `timer`, `created`) is acted on, and
  `readEditedForeground` gives the answer **[en:tran:Undo this change]** for
  either tool. ~780 tokens to that ask alone. **The ordinary list DID move**:
  `owa_foreground` learned the thirteen components, `ref`, `version`,
  `file`, `camera` and `source`, ~491 → ~581 a round, and
  `MODEL_TOKEN_CEILING` was raised 8 350 → 8 480 on purpose (measured
  8 478, `audit-mcp-tools.mjs --stdio --ratchet`; history in
  `owa-enhance-mcp/references/tool-budget.md`) -- the user's choice of _any
  chat_ over a foreground ask alone. Not yet asked live through the window
  with a model: the AI caution is a person's press.
  **A widget named IN PASSING is no foreground ask** (2026-11-10, `EC-467`).
  With no foreground session open in the tab, a typed line naming a widget
  goes to the foreground ask only when it is not a known question. With a
  session open, only a press, an empty line or a line that is not a known
  question goes there. A line about the running order never does
  (`checkIsRunningOrderLine`: _running order_, _presenting flow_, _run
  sheet_, _order of service_, _service plan_, or the window's word for
  Presenting Flow). Before this, the pressed corpus row _How do I make a
  line start at a set time on the clock?_ (W-22d) was read as about the Time
  widget. It ended in _could not settle on an answer_ after five tool calls;
  14 of the 487 rows name a widget so.
- **A running order asked for in an ordinary chat puts nothing on a screen**
  (2026-11-10, `EC-475`). On Auto, the shared server's lean list has no flow
  tool. Asked to _make a new running order … Psalm 23, a 5 minute
  countdown_, the model put the countdown and the verse on screen 0 instead.
  `askLlmBot` now marks such an ask from its typed words
  (`ToolWatchType.isRunningOrderAsk`, `checkIsRunningOrderLine` on
  `askedText`). `runMcpToolCall` refuses it `owa_present_bible` and
  `owa_foreground`, except `check`, with `RUNNING_ORDER_SCREEN_REFUSAL`: they
  are lines to add, and one goes up only when asked for. Building the order
  from an ordinary tab is still open (`EC-468`). The flow conversation
  (**Open in Chatbot** on the flow's row) can build it.

- **A study file, asked for from ANY tab** (2026-11-09, `EC-464`; the
  user: _open chatbot then ask chatbot to make a resource study content for
  Mathew 3:3-7 I expect to have the new markdow file with enough information
  for the passage with creative mermaid diagrams_). `readStudyFileAsk`
  (`studyFileChatHelpers.ts`: a making verb and a study word; English in
  code, Khmer and French from `studyFileAsks` in `assistant.json`, the rest
  `EC-465`) makes a `study` ask, unless a Lookup subject or a Resources
  file is in the tab, the line is a `/` command, a document or foreground
  ask, or a corpus row (`findKnownQuestion` first, as everywhere). Under
  `STUDY_SYSTEM_PROMPT`, eight rounds, with `owa_resource_file`,
  `owa_lookup_record`, `owa_find_verse` and the web read
  (`MODEL_ON_ASK_TOOL_MAP` kind `study`); `owa_resource_file` is shared to a
  `lookup` ask too, and `STUDY_FILE_PROMPT` rides the Resources, Bible
  Reader and lookup prompts, where a study is asked for next.
  `STUDY_CONTENT_RULES` (`noteCreatePromptHelpers.ts`): draft at once and
  never ask what to write, in the person's language, never a verse quoted
  from memory (a `[^Book C:V]` token, which the app quotes), two to four
  diagrams of different kinds with every label quoted, the sections a study
  has, a 2-6 word title, and never say it is saved. **Its passage is in the
  language asked in, English too**: `AskExtraType.study.verseLang` →
  `findStudyVerseBible` → `pickBibleInLanguage(…, true)` (`isEnglishPicked`)
  -- seen live, a study drafted with no `bible` had quoted the Lookup's
  Khmer Bible under an English study; a note's verse still keeps the
  Lookup's for English. On Auto a non-English study prefers a Gemma 4
  (`preferModelPattern`). **`runStudyDraft`**: after a `draft`, each
  mermaid block is PARSED in the help window (`findMermaidParseErrors` in
  `markdownMermaidHelpers.ts`, mermaid loaded only when a block exists --
  the one check the developer's door lacks, which has the structural lint);
  a failure goes back once as the tool's refusal, a second drops the block
  (`dropStudyDiagrams`) and the card counts what is left. The draft is
  lifted into `watch.draftedStudy` and the model is shown
  `[held by the window: N characters]` and `STUDY_HELD_NOTE` in place of
  the study, so it is not billed twice; `save` and `preview` from the model
  are refused (`STUDY_SAVE_MODEL_REFUSAL`, before the tool host is
  reached). The answer's buttons are the card's alone
  (`withStudyDraftUnder`), and a study ask is handed on after a round like
  a Resources one (`canHandOnAfterRound`: the model writes nothing).
  ~524 tokens a round to those asks; the ordinary list did not move
  (8 478 of 8 480, `--stdio --ratchet`). Asked live through the window
  2026-11-10 on Auto, gemma4:cloud (`EC-485`): a John 3:16-17 study in one
  round of drafting, a section change, and an appended prayer. A drafted
  CHANGE shows the model `STUDY_CHANGE_HELD_NOTE` in place of
  `STUDY_HELD_NOTE` (`toModelDraftText`): its button is **Save changes**,
  and the answer names every part `change` names. The change's answer had
  said _press Create_ and named only the prayer, while the draft had also
  put back a section saved a moment before (the attachment's stale words,
  `chatbot-files-report.md`).
  **A study is TRANSLATED by the window, never by the model** (2026-11-10,
  `EC-478`; the user, a Khmer-only NEW file drafted for _translate all to
  khmer and then append the translated content to new pages_, its four
  diagrams gone): the model calls `owa_resource_file translate` with
  `file`, `language` and `place` (`STUDY_FILE_PROMPT` maps add / after /
  under / new pages / both languages to `append`), and `runStudyTranslate`
  asks the app for the plan -- passages quoted again from a Bible in that
  language, the Lookup's own when it is in it (`findBibleInLanguage`) --
  hands each part of words (`STUDY_TRANSLATE_CHUNK_CHARS` 1 600) and each
  diagram's labels to `AskExtraType.translateText` (the window's
  `genStudyTranslator`: the Gemma 4 `findTranslationPick` finds, else the
  assistant asked; one round, no tools, its rounds `onHelperUsage`), asks a
  part again once when it came back untranslated
  (`checkIsStudyTextTranslated`), keeps a diagram whose translation will
  not parse, stops with NOTHING drafted when words fail twice, and drafts
  the result through `runStudyDraft(…, isWindowMade)`: the card reads
  **Save changes to "…"**, and the model is told what the window did
  (`describeStudyTranslation`), never shown the words. A change to a study
  names its part (`section`, `append`, `EC-479`), and a `study` or
  `resources` ask is `isLongWrite` (`EC-480`). Unit-tested end to end
  (`llmBotHelpers.studyTranslate.test.ts`), and asked through the window
  2026-11-10 on Auto (`EC-478`, gemma4:cloud, one ask, ~30 s, 11k tokens,
  no cost). The user's own words were sent in a tab a scratch study's
  Resources 🤖 had opened. The card held the English unchanged, then the
  Khmer pages with the passage quoted from the Khmer Bible and the diagram
  translated, and **Save changes** wrote exactly that. Two words were wrong
  (`EC-486`): the window had checked only that a part came back
  translated. **Since 2026-11-11 it checks the church's own words too**:
  every translator is told what a word means, never how it sounds
  (`STUDY_MEANING_RULE` -- both wrong headings had been the English _Cross_
  in Khmer letters); a heading that is one of the language's
  `translationTerms` is written as that word (`applyStudyHeadingTerms`); a
  part whose English uses one of more than one word that the translation
  does not write is asked once more, naming it, and the answer missing
  fewer is kept (`listMissingStudyTerms`); a diagram's ask carries the
  terms its labels use. Seen in the window the same day: _Cross references_
  ខគម្ពីរយោង, _bronze snake_ ពស់លង្ហិន. **Every installed language has
  some** (`EC-488`, the same day): only Khmer and French have a list, but
  every package names the Reader's **[en:tran:Cross References]** and the
  two Testaments in its church's words, so those four labels
  (`STUDY_TERM_LABEL_LIST`) are its church words for the job
  (`withStudyLabelTerms`), its own list winning. They are read from the
  INSTALLED plugin's `tran.json` (`STUDY_LABEL_FILE_NAME`), one file loaded
  for the job and let go -- a plugin ships its dictionary as `tran.json`,
  every key in lower case, and no `dictionary.json`, which only the source
  package (and so the unit tests' loader) has: read by that name, the live
  window found nothing. A code the table of names uses that a package
  folder does not is read from that folder (`toPackageLangCode`). Seen in
  the window: Burmese, with no list, wrote its heading as its package's
  ဆက်စပ်ကျမ်းချက်များ three asks of three. **A language with no installed
  Bible has its references named in English** (`EC-489`): the draft had
  no `bible` and named every `[^ref]` with the Lookup's -- Khmer letters
  in a Burmese study; `findBibleInLanguage` now also picks an English
  Bible off the same list (`englishBible`), as the passage stays English.
  **A letter of a third script slipped into a word is asked about once
  more** (`EC-490`, `listStudyStrayLetters` over `groupLettersByScript`):
  not the part's main script, Latin or one the English uses (Japanese's
  three and Korean's two count as one), counted with the missing church
  words; a Burmese sentence had held a Sinhala letter. **And every
  language has its Bible's own words** (`EC-491`, the user's _yes_ to a
  list for each language): `churchWords.json` in 72 packages, a side file
  the plugin carries, holds up to sixty things a study names (_Son of
  Man_, _bronze serpent_, _eternal life_, the Pharisees, Moses), each READ
  off that language's own Bible at its anchor verses (`source` names the
  Bible), never written from memory. A word is left out where the verse
  paraphrases, says _ten words_ for the Commandments, or spells it as no
  study now would. `withStudyChurchWords` puts them under the language's
  `translationTerms` (a key in another case is the same word) and over
  the labels, loaded beside the labels for the one job and let go. In a
  language whose words change form in a sentence (`wordsChangeForm`,
  `isWordFormChanging`) a church word is looked for by its stems, each
  word of four letters or more by three fifths of its letters in a row;
  elsewhere letter for letter. Both sides are compared with every
  combining mark taken out (`toFindableText`: NFD, then `\p{M}`), so a
  fully pointed Bible word is found in an unpointed translation and the
  old spelling's cedilla in the new one's comma. A heading so written
  starts with a capital (`toHeadingWord`). Fifteen packages have no list:
  no free Bible text in the language, or one in a spelling the app does
  not write (Armenian, Belarusian, Greek). The card counts one diagram as
  one (`EC-487`: a singular key in every package). **The words also say
  the script** (`EC-493`): when most of their letters are in one script
  other than Latin, the translator is told to write it (_into Serbian,
  written in Cyrillic letters_) and every part is held to it
  (`scriptPattern`, the 40% rule); several scripts at once (Japanese) are
  all held to, none named. Serbian had come back in Latin letters, every
  Cyrillic word handed over "missing". A language turned off in Settings →
  Languages is out of the window's file store, so its words, labels and
  script are not read at all (`EC-494`, open). **A study translated again
  is translated from its own words only** (`EC-492`,
  `splitStudyTranslations`): a translation added after it opens with a rule
  and a `#` title of its own, the plan hands that tail over as
  `translations`, kept as it is -- after it for `append`, put back after the
  new words for `replace`, left out of a copy. Serbian asked after a Khmer
  translation had come back twice, from the English and from the Khmer.
