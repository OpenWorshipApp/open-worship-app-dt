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
  chrome-devtools' at all** — 39 of the 73 the chatbot's door lists are withheld on 2026-11-11 (and eight offered only to the kinds of ask `MODEL_ON_ASK_TOOL_MAP` and `MODEL_ASK_SHARED_TOOL_MAP` name; ten since `owa_screen_edit`, 2026-11-13, and `owa_animation_edit`, 2026-11-19), declared ONCE in
  `tools/owa-devtools-mcp/modelTools.mjs` (no `node:fs`, so the renderer
  bundles the module the audit script reads). All of them stay registered on the
  server, so the developer's door is whole — what is withheld is withheld from
  the MODEL, which is the untrusted party. Same two enforcement points as the
  firewall and for the same reason: `askLlmBot` filters the list, and
  `runMcpTool` REFUSES the call, because these tools are named in the app's own
  manual and a filtered list alone is a suggestion. Every refusal says what to
  use instead. Sixteen groups today (`MODEL_HIDDEN_TOOL_GROUP_LIST`; the
  sixteenth, `owa_inspect`, 2026-11-19, `AD-40`), the first six: the three the window presses itself
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
  an English app -- unless an answer the model is shown with it is in
  another language: then a TYPED English line of three words or more is
  told _They wrote in English: answer this one in English_
  (`genAskLanguageLine`, `checkIsEnglishAfterOtherLanguage`; 2026-11-12,
  `EC-510`: _Make a short study file on Philippians 4:6-7._ under two Khmer
  answers had been written in Khmer, the tab's history all the model went
  by), and so is one about a passage read in a Bible of another language
  (`EC-496`: a passage chat's or a word study's passage,
  `answerKeep.scriptText`), never on a translation's or a waiting reply's
  ask, while a "yes" or an option in the answer's own language goes on in
  it --,
  `(Answer in Khmer.)` in a Khmer one, a sentence when they
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
  in 8-20 s, a 9B on the church's card right in 20-30 s, a 4B right on 26 of 47. So an 8B-or-bigger server model is asked before Free (as good, and the
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
  on offer (`isDroppedReplyRetried`, once an ask, never on the last round -- and once more after the ask has changed something, `isDroppedReplyRetriedAfterChange`, since BN-255, 2026-11-13: a lesson's long first write had spent the one retry, and the one more edit named under it was lost);
  a second empty reply is the model's, thrown as before. **A shared
  server's round that goes SILENT is sent again once** (2026-11-12,
  `EC-524`, `SHARED_STALL_MILLISECONDS`, `checkIsRoundTimeout`): the
  foreground run's countdown, marquee and two-component asks did the right
  thing on screen and then sat on _Thinking_ for over four minutes -- the
  shared gemma4:cloud round never came back, and the client waits ten.
  A registry server (`checkIsRegistryServerId`), on an ordinary ask (not a
  long write, a translation or a Retry), now posts each round with a 90 s
  `timeout` (the OpenAI SDK's `APIConnectionTimeoutError`) and re-sends
  the SAME round once -- the messages unchanged, so nothing done is asked
  for again; a second silence is _the server took too long to answer_. A
  failure after a round is final for an acting ask (`canHandOnAfterRound`),
  so this, not a hand-on, is what saves it. A server of the person's own
  is never timed: it may be loading a model. **Free is timed the same way**
  (2026-11-13, `EC-577`, `FREE_STALL_MILLISECONDS`, `genFreeProvider`): on
  Nemotron Super VL two foreground asks of 23 read the session and sat past
  four minutes on the next round; the same 90 s, the same three asks left
  on the client's clock. Unit-tested, not proven live, and the need is
  unshown: the one such hang looked at closely was the help window
  reloaded under the ask by a file saved beside the dev server, not Free.
  Before blaming a provider for a hang, read `performance.timeOrigin`
  (memory `corpus-run-in-a-shared-dev-app`). **And the relay's failures are said
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
  (`checkClaimsUnmadeNoteChange`). **A study file's the same** (2026-11-11,
  `EC-499`: gemma4:cloud, every draft refused, answered _I have fixed the
  cross-references in the study file_ with no card): in a tab with a
  `Default/*.md` study open (`watch.openStudyFiles`), the note's claim
  words or _Save changes_ with no draft held go back once with
  `genStudyClaimNudge`, naming the file (`checkClaimsUnmadeStudyChange`).
  **Both read a claim in the answer's own language too** (2026-11-12,
  `EC-508`): a Gemma 4 model answers in the person's language, so English's
  words alone missed every claim it wrote in Khmer. Each language's
  `changeClaims` (`claim`, `unsaved`, `save`, `file`, in its `typed.json`
  or `assistant.json`) is compiled for an answer in it alone
  (`toChangeClaimWords`, `ToolWatchType.changeClaimWords`, seeded only in a
  note ask, with a study open, in a foreground ask, or under a card holding
  a new study -- `EC-700`, below) and read beside English's in
  `changeClaimHelpers.ts`, a leaf that reads the report written into a study
  too (`findStudyChangeReport`, below).
  Neither is asked on the last round, where no round is left to answer it,
  so a claim written there, or written again after its hand-back, reaches
  the person under a note the window writes over it: _No change was made,
  though the answer below may say so. Ask again to try once more._
  (`checkClaimsUnmadeChange` on the finished answer, `isChangeUnmade`,
  `UNMADE_CHANGE_TEXT`; `EC-501`). Not when anything else the ask did may be
  what the words are about: a press or a screen (`isActedOn`), a document
  edited, a song made or drafted. The reader cannot tell a claim about this
  ask from one about an earlier answer, so a reply that still points at an
  earlier card's _Save changes_ after its hand-back carries the note too.
  And an edit that changed nothing answers
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
  countdown was started having called nothing. **The words TYPED make a
  do-ask too** (2026-11-13, `EC-551`, `findDoAskTool`'s `asked`): _Put the
  long text up on the screen_ found the Long Text Show's how row by its
  phrase and was answered with the panel's five steps. Typed words opening
  on _put_, _start_ or _show_ (never _show me_) ask it done when the row
  carries `owa_foreground` or `owa_present_bible`, and a do-ask's hint says
  its page is the way by hand, not the answer -- with the tool alone the
  answer still opened with two panel steps above _now ready on the screen_.
  And a do-ask its tool DID (`isDoToolDone`: called, not refused, no
  error) skips the completeness pass (`checkIsCompletenessDue`): asked
  after a verse, its "is a step missing?" round had put the panel's steps
  back under the answer. Refused, the pass stays -- the way by hand may be
  the answer. The four do-asks went from 3 rounds to 2.
  **In Khmer the prompt's examples are the reader** (the same day, `EC-553`):
  a Gemma 4 is asked in the person's language, untranslated, and the
  do-ask readers are English, so _clear everything from the foreground_
  typed in Khmer was answered with the Mini Screen's steps where English
  was one `stop` -- the prompt's foreground line names it now
  (`action: "stop", widget: "all"`), and Khmer clears in one call. So does
  _put the time on the screen_ (`EC-556`): with no example, a Khmer ask had
  gone up as a quick text of its words; the line names it the clock, never
  its words as text. (The Khmer slip's real cause was before the model,
  `EC-563`: the verse row's fill-in gap had taken _ម៉ោងនៅ_ as its verse.
  A reference gap takes words with a number now, and Khmer names its clock
  in `foregroundAsks`: 1 of 3 askings a clock before, 3 of 3 after.) **A
  bare command in any language starts it** (`EC-572`): _Muestra la hora_,
  _Tampilkan waktu_, _Покажи время_ -- no clock and no screen named, a
  language with no `foregroundAsks` of its own -- had each been answered
  with the panel's steps, the prompt's "only asked HOW" read as anything
  that was not plainly about a screen; the line now says a command in any
  language asks for it to START and only a question asks how (4 of 4 up
  after, 0 before; _¿Qué hora es?_ changes nothing). And _show the time_
  is the corpus clock row's phrase, so _How do I show the time?_ carries
  W-09's page (the guide search had ranked the auto-play timer's first)
  and a typed _Show the time_ is a do-ask (`DO_TYPED_PATTERN`). **And a line
  that only TELLS something asks for nothing** (2026-11-14, `EC-644`):
  _the sermon lasted 40 minutes_, typed in Hausa and in Kinyarwanda, had
  started a 40:00 countdown, and such lines in English, French and Korean
  were answered with the offer of one; the line says it is answered, with
  nothing put up and no timer offered (0 of 20 up after, 2 before). A guard
  refusing a timer start from a line naming no component was measured and
  not kept: the window cannot tell such a line from a command in words it
  cannot read, and it turned a Hausa countdown asked for into an offer.
  **And a notice to stay up is the Messages panel** (2026-11-14,
  `EC-645`): asked the general way, _show on the projector: the car park
  is full_ and its like in five languages went up as a Quick Text -- gone
  by itself after 10 seconds -- five times in nine, and once as a marquee.
  The bullet says a notice is `widget: "message"`, a quick text or a
  marquee only when asked for (9 of 9 after). A typed line is read past
  its quoted words first (`toUnquotedAskLine` in
  `foregroundChatHelpers.ts`): _put the message 'Welcome' on the screen_,
  in eight languages, had named nothing. A colon rule (a showing request,
  a colon, the words) was not built: the Foreground route has no tool for
  a song or a verse, and _show on the screen: Amazing Grace_ would have
  gone up as words. **And a clock that counts UP is the stopwatch**
  (2026-11-14, `EC-646`, the bullet's next sentence): one counting DOWN is
  the countdown. Still `open`: of eight stopwatch lines asked the general
  way, 2 → 3 started, the rest answered as how-tos in languages the model
  does not follow. And the foreground hint asks for the Undo sentence in
  the model's OWN words in the language it answers in (`EC-557`,
  `foregroundChatHelpers.ts`): _add that Undo this change puts it back_ was
  copied into a Khmer answer as English. **A foreground answer that claims
  a change no call made goes back once** (`EC-558`,
  `checkClaimsUnmadeForegroundChange`): once in three,
  _ដកនាឡិកាចេញពីអេក្រង់_ made a `read` and said the clock was off. In a
  foreground ask, a claim (the foreground's own English verbs,
  `checkHasForegroundClaim`, or the answer language's `changeClaims`, read
  for foreground asks too) with no `owa_foreground` / `owa_foreground_edit`
  change is handed `FOREGROUND_CLAIM_NUDGE`; a read, a check and a refusal
  change nothing, while any other call -- a press, an undo
  (`isOtherCallMade`) -- is believed. Khmer's claim words read the verb
  split round its object (_ដក … ចេញ_). Seen live with a stand-in model making
  the slip, and gemma4:cloud 3 of 3. **Outside a foreground ask too** (2026-11-14, `EC-649`,
  `checkIsOrdinaryForegroundClaim`): _count back from five minutes on the
  screen_ went the general way, read one guide page and answered _I have
  started a 5 minute countdown_ 2 times of 3 over an empty screen. The
  claim goes back once there as well when the ANSWER names a foreground
  component (`readForegroundComponentAsk` over its words), no call acted
  or changed anything else, and no document of theirs is open in the chat;
  _I have shown you how_ is a how-to's. After: 3 of 3 handed back and then
  really started, and a clock, a stopwatch and a how-to never handed back.
  **What they did not give is asked for, never made up** (2026-11-14,
  `EC-652`, `EC-653`): _show the church wifi password on the screen_ went
  up as _Church WiFi Password: [Insert Password Here]_ and was called the
  password, and _put up how long until the service starts_ started 5
  minutes nobody named, 3 of 3 each. Both prompts' foreground sentence says
  to ask (its examples are not the lines measured); a blank to fill in never
  goes up on either door (`findForegroundBlank`); and words that are only a
  run of the person's own line, the line marking none in quotes or after a
  colon, go back ONCE on `owa_foreground` with the question
  (`findForegroundEchoedWords`) -- with the sentence alone, the wifi line
  went up as _Church WiFi Password_ 3 of 3, which no window rule tells from
  _show welcome to our church on the screen_. After: the password, a name, a
  number and office hours asked for, a countdown to the service, the sermon
  or the choir asked when, and words typed inline up as before at one round
  more (a cache read). **And every language's own foreground
  claims since `EC-607`** (`changeClaims.foreground`, `checkHasForegroundClaim`):
  a language's note words say _added_, never _started_, so _He iniciado una
  cuenta regresiva_ over nothing put up had drawn no note; of six claims a
  language (a countdown started, the clock off, everything cleared, a message
  up, a countdown paused, the screen on), written blind in 88, its note words
  read 157 of 528, its own foreground words 520 -- every language a
  `typed.json` holds all six, none of the blind offers, promises, steps or
  denials, nor a line a person types to ask for an overlay (_I sent you a
  message yesterday_ had been read as one in two languages and was mended). **French's and
  Khmer's since `EC-618`**, in their `assistant.json`: written blind, 6 of 6
  claims each (3 and 1 before), none of their non-claims or denials, and no
  French line a person types (_J'ai supprimé une Bible par erreur_, _que
  j'ai fermé_ and _Je t'ai envoyé un message hier_ had been read and were
  mended); their `foregroundAsks` got `countdown` and `stopwatch`, so a
  French or Khmer countdown in an English window is a foreground ask. **The way back from a hide is an ASK,
  never a button** (`EC-562`): told to say how to reverse it _(show it
  again, …)_, a Khmer answer sent its reader to press a button _"show"_ --
  the tool's action word, which no panel draws (the Clock's is **Show on
  Screens**); the prompt now says they can ask for it back and that the
  tool's action names are not buttons, and the cleaner writes a quoted word
  after the language's word for a button in that language
  (`chatbot-window.md`).

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
  **And the verse finder rides with it** (2026-11-12, `EC-514`,
  `MODEL_ASK_SHARED_TOOL_MAP.slide`, ~357 tokens to a slide ask alone, the
  ordinary list untouched at ~8 478 of 8 480): _a slide document with John
  3:16 on one slide_ had been given the verse from the model's memory; the
  prompt now says a verse named for a slide is read with `owa_find_verse`
  `refs` and written as it reads there, its reference under it.

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
  (`src/chatbot/noteChatHelpers.ts`), eight rounds (twelve for a lesson
  written into the empty note, BN-140: a children's Jonah ran out of eight
  with nothing written; sixteen since BN-255, 2026-11-13,
  `NOTE_LESSON_MAX_TOOL_ROUNDS`: the one more edit named after the write
  had no round left), the note read fresh from
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
  neither, English, 2 of 2). **And the window keeps them when the
  translator does not** (2026-11-13, `EC-602`, `keepWrittenWords`): on
  Free, 2 of 9 messages asked for in Spanish and Russian went up on the
  screen in the translator's English (_the offering is now_). After the
  translation, each quoted span is put back as typed when the English
  holds as many, and the words after a colon -- a letter or closing mark
  before it, a space after, so never `10:30`, `3:16` or a link -- when they
  ask nothing (a line holding `?`, or words ending in one, is the
  question, the translator's). A note named a letter out -- a Khmer subscript
  written with its look-alike -- is the ONE attached note
  (`resolveNoteEditTarget`, BN-30). Words they TYPED to go into the note
  go in letter for letter: the window hands the typed words with the ask
  (`AskExtraType.note.typed`), and each `owa_note_edit` change's `text`
  and a new `title` are put back to them where only a pair of look-alike
  letters a language names differs (`restoreTypedWords`,
  `listLookAlikePairs`; BN-37: Free's Nemotron wrote a typed Khmer line
  with TA's subscript for DA's -- the same on screen, not to a search).
  **A note put INTO another language reads its verses from that
  language's Bible** (2026-11-11, BN-133, the user: _I asked to translate
  the whole content into Khmer then bible of translated should into khmer
  bible_; the verses had stayed KJV, chips and passage in English): a typed
  _translate … into <language>_ naming no part
  (`readNoteTranslateLanguageName` -- _the title_, _the prayer_, _point 2_,
  _the verses_ leave the verses alone), a pressed _Replace the words with
  <language>_, or **Replace the words** under the answer that asked which
  way (`checkIsNoteReplaceChoice`) rides `AskExtraType.note.translate`; the
  loop looks up an installed Bible in it once an ask
  (`findNoteTranslateBible`, the Lookup's when it is in it), reads the note
  and sends the edit with every verse token named that Bible, every passage
  re-pointed to it and the untouched blocks' chips too
  (`withNoteVersesInBible`, `bible` set) -- the words read by the app, never
  the model's; with none installed it goes in as written and the model is
  told to say so (`genNoteTranslateNoBibleNote`). What the change left out
  of the language -- a block still in English, letters of a third script
  -- is named under its result, once an ask, for one more edit (BN-134,
  `findNoteTranslateLeft`; the script the installed plugin's, else read off
  the words written): refused instead, the model resent the translation in
  four parts and ran out of rounds. Seen live, gemma4:cloud on a scratch
  profile with the Khmer Bible: two notes wholly in Khmer, passage and
  chips from it, 7-11 s. The reader is English (BN-135 open). The size and whole-note style
  shortcuts above read any language too, from its
  `assistant.json` (`textSizeAsks`, `noteStyleAsks`, `colorWords`;
  `languageEditAskHelpers.ts`, BN-16), and every other installed language's
  `typed.json` carries the size (larger, smaller) and bold for the whole
  note (BN-31, 85 languages; read on 2026-11-19, `om` and `to` have no size
  words and `bo`, `ka`, `om`, `sn` and `so` no whole-note bold, never
  having had them) -- what it does not say goes to the model.
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
  as before. A foreground change put up while every screen was off adds
  _The screen itself is off …_ and **Turn the screen on** (`/screen-show`,
  the person's press; `EditedLyricType.isScreenOff`, read off the result's
  `isAnyShowing`, 2026-11-13, `EC-599`), and a foreground change is named
  as its strip shows it -- _“Time › Default”_, not the bare session
  (`EditedLyricType.shownName`, `EC-601`); both seen live with a stand-in
  that starts a clock and then fails. Auto never hands such an ask on (a round came back), so no
  second assistant makes the change again. Seen live with a stand-in
  model that changes the note and then answers nothing: the sentence, the
  two buttons, and Undo putting the note back. And a change made and THEN
  the rounds run out says the same, never "could not settle on an
  answer" (BN-153, `genOutOfRoundsAnswer`: a lesson written whole had read
  so over its own Undo when the one more edit a note asked for used the
  last rounds up).

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
  one call, each opened and attached. **Since 2026-11-13 the PERSON chooses
  what it is kept as** (`EC-581`, the user: _whenever creating bible-note or
  resource study file should always let user choose between bible-note or
  markdown file_, then _but if user click and choose step by step
  explicitely it should skip the confirmation_). Outside a note ask
  (`watch.noteFiles === null`) a model's `add` is HELD (`holdNewNote` in
  `runMcpToolCall`): the window drafts the same words as a study file
  (`toStudyArgsFromNote`, the note's first passage its `ref`), the draft
  keeps the note as its twin (`DraftedStudyType.note`), and the answer
  carries the study's card with **New Bible Note** first -- the note made
  as the model wrote it, opened and attached as above -- beside Create in
  Resources and in Bible Notes. The model is shown `NOTE_HELD_CHOICE_NOTE`,
  never a note made, and `NOTE_CREATE_PROMPT` says the window may hold it.
  A new study's card offers the same button (`toNoteFromStudy`: the passage
  first, no diagram). A PRESS naming the kind skips the card
  (`readPressedCreateKind`, `createKindHelpers.ts` →
  `AskExtraType.createKind`): a Bible note pressed for is made at once, and
  so is a study drafted after it (`makeStudyNote`); a Markdown file pressed
  for keeps the Markdown buttons alone (`isMarkdownOnly`). Typed words
  always get the card. A note naming no passage, or one the study rules
  refuse, is made as asked; an add beside a held new study is refused
  (`NOTE_BESIDE_DRAFT_REFUSAL`).

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
  read had been let by) -- every single verse in ONE read, matched back by
  its key (BN-148, `toCitedVerseKey`: eight reads at once, each one of the
  firewall's 25 acting calls a minute, had left the next ask refused), a
  range in a read of its own; and the passage's own words given another
  verse's name are named under the change with the verse they come from
  (BN-160, `findCitedMisattributions`: "the water of life freely" as John
  4:14) -- and a token standing where a sentence needs the
  verse's words -- "Jesus, who [^John 1:14]." -- is sent back once
  (BN-120, `findTokenAsWords`: a token shows its reference alone), and a
  children's lesson's memory verse over twenty words is read and named
  under the lesson written, with short verses of the passage read to put
  in its place (BN-129, `findMemoryVerseRef`: told twenty words twice,
  Luke 15:7's 28 kept coming back; BN-143, `listShortReadVerses`: sent back
  whole, a lesson searched for a shorter verse until its rounds ran out
  with nothing written; BN-155: of its own passage only -- the verses read
  before Luke 15 had offered Luke 14:34's salt that "lost his savour" to a
  lost sheep lesson), a passage left to the assistant ("choose one of
  these") is chosen and written on, never asked about again (BN-144,
  `checkIsLeftToYouAsk`), the cited quotes read being those written from memory
  first (BN-132, `pickCitedQuotesToRead`: read in the lesson's order and
  cut at eight, a Christ section's misquote was never read), and the
  passage at the top printed again -- after
  the memory verse, or under a point whose lines carry their own verses --
  is taken out by the window before the lesson is written (BN-130,
  `dropRepeatedLessonPassages`), and a verse quoted in a modern
  translation's words in a note whose verses are the KJV's -- Philippians
  2:7 as "emptied himself" -- is given the KJV's words by the window and
  the model told so under the change (BN-137,
  `lessonKjvWordingHelpers.ts`: 44 wordings of the verses quoted most
  at first, 68 in `KJV_WORDING_LIST` by 2026-11-19 (BN-177..BN-282),
  each held to the app's own KJV by a test, changed only where the
  quotation's other words are mostly that verse's), and a sermon's
  detail no verse gives -- the stone that "found the only gap in the
  giant's armour", Jesus "just spoken to the people of Capernaum" --
  is read off the lesson and named under the change for one more edit
  (BN-142, `lessonLegendHelpers.ts`: shown its correction in the word
  table, the model wrote it anyway; a verse's own entry there now
  outranks a word's for the eight a read carries, BN-141), and so is a
  word of the passage, quoted, put on Christ in Pointing to Jesus -- "He
  took the "tormentors" … upon himself", "the ultimate "river"" -- when
  the passage as read holds it (BN-163, `findStretchedChristWords`; what
  the Scriptures say he bore, sins or griefs, is left), and so is a
  new lesson's example set in a hospital (BN-150,
  `lessonStockSceneHelpers.ts`: the scene the model reaches for by
  default, stock to both readers; never a funeral message's) -- each by
  the block it is in, the note read once the change is made (BN-152:
  told only the words, the model counted its own lines and wrote over the
  line above), and a line inside a longer block with the block's words,
  a fix that would leave the block little but that line refused once
  (BN-157: a children's Jonah's whole story became the one sentence a
  legend named); the blind readers' commonest
  error, and any error keeps a lesson out of Best. Pointing to Jesus
  starts from the phrase of the passage that carries its big idea, a
  verse from elsewhere only where the New Testament takes the passage up
  (BN-149: sent first to a New Testament verse, the model quoted ones that
  only share a theme -- Revelation 7:9 under David and Goliath), and a
  verse of another book it names with none of its words is read by the
  window and named under a new lesson with them (BN-154,
  `lessonChristVerseHelpers.ts`: "whoever abides in Him will find rest"
  as Matthew 11:28). **A fix to a lesson
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
  now it tells them from those words (`genVersesBeforeNote`) -- and, a psalm read from the KJV, the title
  the KJV prints over it, which no Bible the app reads carries (BN-147,
  `kjvPsalmTitles.json`, loaded only then: psalm backgrounds had been
  told from memory). That read also
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
  Messages and Time by a phrase only, and every installed language's own
  phrases (`foregroundAsks` in its `assistant.json` or `typed.json`,
  2026-11-13, `EC-563`: _put the time on the screen_ in Khmer had named
  nothing, its Time label being an everyday word; every package's clock
  since `EC-564`, read with `createAsks`' matcher -- `findWordSpans`, an
  entry weighed by its longest part -- so a word that is also an hour is
  read only near the screen; and since `EC-605` every package's message on
  the screen -- its word for a message or an announcement and its word for
  the screen, a projector or its canvas, both orders -- and its countdown
  and stopwatch labels, the last word a stem, so a line typed in an
  installed language the window is not shown in names them too: such an
  ask had gone the general way, three times the tokens; and in English a
  line that STARTS by asking to time something is the stopwatch,
  `TIMING_ASK_PATTERN`, `EC-654`: _time the worship set_ had read three
  guide pages and answered with the panel's steps, and "the time" with a
  place word after it is the clock, `TIME_PLACE_PATTERN`, `EC-655`: _put
  the time in the corner_ had gone up in the middle -- both read only after
  every component word, never on a question);
  a message, notice or announcement at
  the top or bottom is a Quick Text, `EC-532`: _Show a message at the bottom
  of the screen for 15 seconds_ had named nothing, gone to the ordinary
  `owa_foreground`, which takes no look, and come up in the middle -- and
  the prompt has `start` carry the place named in the same call, and says
  words that go off "for 15 seconds" are a quick-text with seconds -- a
  Message has no time, and the worker refuses one sent to it, `EC-538`;
  in Khmer too since `EC-588`, its `foregroundAsks.quick-text`: a message,
  notice, announcement or welcome, then the bottom or the top, then the
  screen -- the screen required, since the message below is a chat's own
  words -- 0 of 4 at the bottom on gemma4:cloud before, 3 of 3 after; no
  other language has such phrases yet, so there the ordinary tool's Quick
  Text result names where it went and the refusal of a time says to tell
  them when it is not where asked, `EC-591`: on Free 0 → 3 of 3 answers
  saying so, on gemma4:cloud 0 → 0; and a marquee started with a Quick
  Text's `seconds` or `delay` and no session goes up as a Quick Text at that
  marquee's edge, its `note` saying so, `EC-593` -- the call a model makes
  first for such an ask in any language: kept at the edge on gemma4:cloud
  0 → 3 of 3, on Free 0 → 2 of 3; Free's other first call, a Quick Text
  with no place, now reads in its result that it is in the middle and the
  call that moves it, `EC-597`: on Free 9 of 9 at the edge in one
  question, no answer saying so before it was),
  about its active session -- under
  `FOREGROUND_SYSTEM_PROMPT` (`src/chatbot/foregroundChatHelpers.ts`), eight
  rounds, the session read fresh into the user turn (`toForegroundAsk`), on
  a custom server's lean list, with `owa_list_screens`, `owa_click`,
  `owa_help_search` and `owa_find_verse` shared to it. A known corpus row
  still wins (`findKnownQuestion`). The WINDOW turns a session NAME the
  model writes into its id (`resolveForegroundSession`; Default by its strip
  name too), and outside a foreground ask the tool is refused. **One
  answer's foreground changes are ONE Undo** (2026-11-12, `EC-539`,
  `mergeEditedForeground`): a countdown and a marquee started together are
  two sessions, and the button had taken back the newest alone; every
  change's undo id goes on it now, and an undo id a model writes into the
  answer is taken out (`scrubAnswerUndoIds`, beside the recipe-id scrub),
  with the quotes round it and the `owa_undo with id` it came in
  (2026-11-13: _puts it back: owa_undo with id ""._ had reached the
  volunteer). An undo of a `start` or `show` takes what it put on the
  screens off again (2026-11-13, `EC-540`, `agent-tools.md`), and one of a
  `set` on a session that is up puts its old words back up (`EC-546`). The
  window's sentence after the press names EVERY session, one sentence each
  in words every language already has (`EC-545`, `undoParts` → the press's
  `parts`, `genForegroundUndoneText`): a session the answer MADE (the
  result's `session.isNew`) _is taken away again_, one it only changed _is
  back as it was_ -- it had written _"Welcome, friends" is back as it was_
  over a marquee it took away, the countdown beside it unnamed. **A `start`
  keeps a session only when it is ATTACHED** (2026-11-12, `EC-523`,
  `toForegroundEditArgs`): a typed line with nothing attached rides the
  panel's current session as its ask with `isCurrentOnly`
  (`AskExtraType.foreground`), and a `start` naming it, or any session the
  tab does not hold, has the name dropped, so new words go into a session
  of their own and never over the panel's Default. **A 0 written beside a
  time is dropped** (2026-11-14, `EC-616`): Free called a 5 minute
  countdown as `{minutes: 5, seconds: 0}`, the tool's schema (a time above 0) refused it and a round was spent, so `toForegroundEditArgs` drops a
  `minutes` or `seconds` of 0 when the call gives another time or an `at`;
  a 0 alone is left for the schema to refuse. **No button or field is
  named for the person** (`EC-617`): an off screen is offered _to turn
  that screen on_, and the undo is said in their words, never _undo id_ --
  the prompt's own _show button_ and _undoId_ had come back as _tombol
  show_ and _punya id undo_ in Free's Indonesian answers (3 of 10 → 0 of 14).
  **Nor is a screen's state written as a term** (2026-11-14, `EC-620`): the
  tool's off-screen note (`genOffScreenNote`) and the prompt said _OFF_, and
  4 of 24 answers on Auto wrote _(OFF)_ in English after the Arabic, Hindi
  or Thai word; both now say _turned off_ and _turn it on_. The prompt sends an ask
  to put something UP to `start` (one call), `show` to put a session up as
  it stands, says to leave `screens` out (the read names every screen,
  `EC-522`) and answers a question about something else from the guide
  with nothing changed. A change
  (`started`, `changed`, `shown`, `hidden`, `timer`, `created`) is acted on, and
  `readEditedForeground` gives the answer **[en:tran:Undo this change]** for
  either tool. ~780 tokens to that ask alone (~835 since `start`, ~864 since `timer` `add` and a `hide` of `all`, 2026-11-12; the ordinary list did not move). **The answer promises Undo only where there is one** (`EC-530`): only `set`, `start` and `session` are backed up and answer an `undoId`; a `show`, `hide` or `timer` press changes what is up and keeps none, so the prompt says how to reverse it instead -- every one of them had ended _Undo this change puts it back_ over no button. **The ordinary list DID move**:
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
- **And one for the screens' own controls** (2026-11-13, `EC-611`, the
  user: _chatbot is very smart to help user control screen_; the tool in
  `agent-tools.md`). `owa_screen_edit` goes to a `screen` ask
  (`src/chatbot/screenChatHelpers.ts`, pure): a typed line about the Bible
  text's look on the screens, a passage's versions, Line Sync, a
  transition, a display, a group, the lock, the tick, the stage or a clear
  (`readScreenAsk`, `typedScreenAskHelpers.ts`: English by
  `readScreenControlAsk`'s words in code, every other installed language
  by its package's `screenAsks`, below; in the Reader and an editor only a
  line that names a screen, since _make the Bible text bigger_ there is
  the page's own text), or any plain line under a screen
  answer in any language (`checkIsScreenThread`, the answer marked
  `isScreenAnswer`). Not a how-to, a _what does … do_, a line with an
  attachment, a foreground ask, a study, a verse looked for, the Reader's
  own material or a known corpus row (`findKnownQuestion`): those keep
  their own ways. The window reads the screens as they stand first
  (`toScreenReadText`, 12 screens and 3 500 characters at most) and puts
  them under the question, the prompt saying not to read again; the ask
  goes out under `SCREEN_SYSTEM_PROMPT`, `SCREEN_MAX_TOOL_ROUNDS` 6.
  Every change of one answer is ONE **[en:tran:Undo this change]**
  (`readEditedScreen`, `mergeEditedScreen`), and a typed _undo that_ is
  handed the ids under the answer (`findScreenUndoIds`). **The button is
  promised only where it is** (2026-11-14, `EC-615`): the window draws it
  for an `owa_screen_edit` answer that carries an `undoId`, and after an
  `owa_undo` the prompt's rule had promised one over nothing (_The button
  below will put it back_); an undo's answer now says what is back as it
  was. **A screen change claimed and never made goes back once**
  (`SCREEN_CLAIM_PATTERN`, `SCREEN_CLAIM_NUDGE`,
  `checkClaimsUnmadeScreenChange`, beside the foreground's): a read
  changes nothing, _already so_ changes nothing, and a refused call did
  nothing -- after five refused undos the model had said _I have undone
  the last change_ with nothing put back, so the claim reads _undone_ /
  _undid_ too, the nudge names `owa_undo` for an undo, and a claim still
  standing on the finished answer gets the window's note
  (`checkClaimsUnmadeChange`). ~717 tokens a round to that ask alone; the
  ordinary list did not move (26 tools, ~8 471 of 8 480, `--stdio
--ratchet`). Measured on the first 14 of the skill's 27 asks
  (`scripts/screen-run.mjs`, Auto, mostly the shared gemma4:cloud): 0 of
  13 changes done before (2 already so), 13 of 13 after, 500.1k → 76.0k
  tokens, about 4.3 s an answer at the driver's poll. **A first line in
  any installed language** (2026-11-14, `EC-614`; the words are each
  package's `screenAsks`, `language-packages.md`): the line is read in
  the language it is typed in first -- a how-to or an excluded subject
  there reads nothing, English's reading too -- then by English, then by
  every installed language's lists, the typed one and the app's first.
  Any line is a how-to when ANY installed language's how-to words read it,
  whichever language it is taken for -- one no language here can name (a
  fifth of the blind asks), or one taken for the wrong language (a
  Kinyarwanda how-to taken for English for its _transition_, a Slovak one
  for Czech) -- but not their other subjects (one language's song is
  another's thing); about a millisecond a line that reads nothing with
  all 88 installed, two for one that reads a control (2026-11-14: every
  language's how-to words are looked for only once a control is read, and
  a control's words only beside a screen's or a Bible's, or alone for one
  that names nothing else -- in the order first written a line cost 3.5
  to 4.4, and the two language tests that read the blind sets took 78 s
  each of the gate's run, now 43). A
  Bible's short name is in a package's `bible` and `versions` both, so by
  itself beside a number, with no screen named, it is the passage put up
  in that Bible (`checkIsPassageInBible`: an English _present Psalm 23 NIV_,
  which no language could name, had gone to the screens through 71
  packages' lists). In a script that
  does not space its words, an entry of the language's own letters
  matches anywhere and one of other letters (`tv`, `kjv`) as a whole word
  (`checkHasListWords`). With no assistant, such an ask is answered with
  the setting it is about, as each screen has it, and what each screen
  holds (`answerScreenAsk`, below), as an English one is -- the guide
  searches English, and a Spanish one had been answered _I could not find
  that in the app guide_. Measured on three sets written blind,
  ten asks and seven lines that only look like them in each of 88
  languages (`screenAsksHeldOut.json`, `…2.json`, `…3.json`), each read
  once before anything was fitted to it: by English words alone 34, 43
  and 35 of 880 asks went to the screens; at their one blind read 713 (8
  of 616 look-alikes with them), 719 (54) and 697 (7). Fitting the first
  set to 98% did not move a fresh set's reading, about four in five, as
  the English blind sets had found; what the rounds moved was the
  look-alikes: the second set's 54 were mostly how-tos (45 read as a
  transition, which reads with nothing named), and after every language
  was given the English reader's whole how-to inventory and the guard
  above, the third set sent 7. Each set then read 0 of 616 (865, 855,
  697 of 880). A rule keyed on the question mark was weighed and left:
  it would have stopped 43 of the 45, but English routes _can you change
  the transition?_ and so must every language. **A screen called by its
  number is the screens'** (2026-11-14, `EC-623`): with no control's words
  read, one or two digits of any script right after a language's word
  for a screen (a `#` allowed; never another digit, or a `:`, `.` or `,`
  and a digit, after them -- a verse, a time, a bigger number), or an
  entry that holds its own number, reads `screen` (`readTypedScreenAsk`,
  `checkHasScreenNumber`), and the screens' tool reads the screens and
  works out the control. A control any language names is said first. A
  countdown on a screen is said with a number too, so a numbered reading
  of a line named NO language is stopped by any installed language's
  exclude words; one named its language is not (one language's phone is
  another's _open_). The third set read 697 → 765 of 880 by it, and a
  fourth written blind (`…4.json`) 694 → 770 at its one read. All four
  read no look-alike as a control now (868, 861, 765, 773). Handing a line
  taken for English that English reads as nothing to the app's own
  language was measured and left: 9 more of 3 520 asks, and 603 readings
  of the English sets' look-alikes as screen asks.
  **With no assistant, the setting asked about** (2026-11-14, `EC-625`):
  a screen ask answered with no model -- the spend guard paused, no key,
  the network down -- had been given what each screen showed, or the
  guide's steps for an English line naming the control: _check the
  display: which monitor is each screen on?_ named no monitor, and a lock
  or a bigger Bible text asked for never said that nothing had changed.
  A line read as one control (`readScreenAsk`'s kind, whatever the
  English reader made of it) is now answered by `answerScreenAsk`
  (`helpBotHelpers.ts`): the setting per screen
  (`genScreenSettingText`, `screenStateAnswerHelpers.ts`, pure) -- the
  monitor as the card's display button names it with its size and
  _primary_, the lock, the stage, the tick and each passage's Bibles off
  `owa_list_screens`; the transitions, the groups, Line Sync and the
  Bible text's size off `owa_screen_edit`'s quiet `read` -- then what
  each screen holds (`answerScreens`) and one line: to change it, ask
  again when an assistant can answer, or ask how. The window's own words
  in every language (16 keys). A clear and a screen named by its number
  alone are answered as before. `owa_list_screens` gives a screen's
  display as `display` by its id, never `displayId` (the first cut read
  that, and every screen would have been on no monitor). Seen live with
  the guard paused: nine English asks, one for each control, each
  answered so in about a second; and with the app switched to Spanish, a
  monitor, a lock and a transition ask drawn in Spanish. A line that also
  names a passage is answered as a passage first (`EC-622`, the
  `owa_present_bible` bullet in `agent-tools.md`): _pon Juan 3:16 en la
  pantalla_ names a screen and a verse.
  **And the change itself, as a button** (2026-11-14, `EC-627`): the
  setting was followed by _ask again when an assistant can answer_, and
  nothing in the window could make the one `owa_screen_edit` call the ask
  was for. `genScreenChangeOffers` (`screenChangeOfferHelpers.ts`, pure)
  reads the line against the quiet `read` and offers up to four presses,
  each one `set` labelled with the panel's own words as the window shows
  them (_Screen 0 · Lock_, _Slide transition: zoom_, _Screen 0 · Add
  NIV_), under _Nothing has been changed yet. Press a button below to
  change it now, or ask me how to do it yourself._ -- every control the
  tool sets, a look included; a line typed under a screen answer
  (_Centre it_) too (`answerScreenThreadAsk`); a clear only when there
  is a press to offer (`isOfferOnly`). Never a question that names no
  value, a change already so, a clear or a version on a locked screen, a
  monitor not named, a Bible not installed (a short name in capitals no
  installed Bible has), the last version up or the last ticked screen. A
  press is the pseudo tool `owa_screen_change` (`SCREEN_CHANGE_TOOL_NAME`,
  caught by `runBotAction`, registered nowhere): the change, the screens
  read again and the setting said as it is now, with **Undo this
  change** -- a look changed is _Done._ alone, since the setting sentence
  says only the size. Seen live with the guard paused: a bigger verse, a
  lock, a zoom transition, another version, _Centre it_, bold and a
  clear, each done and undone. A look asked for in another language is
  read only by the language's note phrases, colour words and shown labels
  (`EC-628`). **A screen asked for is added** (the same day, `EC-630`):
  `readScreenControlAsk` reads _add a new screen_, _I need another screen
  for the stage_ as kind `newScreen` before any control (never a how-to, a
  green or blank screen, a virtual one, a phone's, a version on another
  screen, a screen made to show the same as another); in another language
  only the Mini Screen menu's label as the window shows it, most of the
  line (`checkHasNewScreenLabel`). With no model,
  **[en:tran:Add New Screen]** is offered (`isOfferOnly` in English; under
  8 screens, never off the Presenter) and the press says the new screen by its number, its
  monitor and which screens are ticked (`readAddedScreenId`), with **Undo
  this change**; the model's prompt says `newScreen` goes alone, only when
  asked, and that only a person removes a screen; _added_ and _created_
  are claims the nudge holds back. A screen added with no Undo kept is
  still a change, with no button, and never takes an earlier change's Undo
  away (`mergeEditedScreen`). Seen live with the guard paused: offered,
  pressed, undone.
- **A running order asked for in an ordinary chat puts nothing on a screen**
  (2026-11-10, `EC-475`). On Auto, the shared server's lean list has no flow
  tool. Asked to _make a new running order … Psalm 23, a 5 minute
  countdown_, the model put the countdown and the verse on screen 0 instead.
  `askLlmBot` now marks such an ask from its typed words
  (`ToolWatchType.isRunningOrderAsk`, `checkIsRunningOrderLine` on
  `askedText`). `runMcpToolCall` refuses it `owa_present_bible` and
  `owa_foreground`, except `check`, with `RUNNING_ORDER_SCREEN_REFUSAL`: they
  are lines to add, and one goes up only when asked for. Since 2026-11-12
  (`EC-514`, closing `EC-468`) the window MAKES a new running order asked
  for and the question becomes that flow's own conversation, which builds
  it (`chatbot-files-report.md`); this refusal still holds for an ask the
  reader does not take.

- **A study file, asked for from ANY tab** (2026-11-09, `EC-464`; the
  user: _open chatbot then ask chatbot to make a resource study content for
  Mathew 3:3-7 I expect to have the new markdow file with enough information
  for the passage with creative mermaid diagrams_). `readStudyFileAsk`
  (`studyFileChatHelpers.ts`: a making verb and a study word; English in
  code, every other language from `studyFileAsks` in its `assistant.json`
  or `typed.json` -- one pattern each, its how-to, folder and note words
  and its neighbours' refused (`EC-465`); an English how-to is nobody's
  ask) makes a `study` ask, unless a Lookup subject or a Resources
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
  (`dropStudyDiagrams`) and the card counts what is left -- of a CHANGE,
  only the diagrams the call writes (`listWrittenDiagramIndexes`,
  2026-11-11, `EC-503`: the file's own are the person's, neither the
  model's to fix nor the window's to drop). A `replace` (2026-11-12,
  `EC-537`, `agent-tools.md`) writes INTO those diagrams, so it parses the
  ones it changed (the worker's `diagramsChanged`, read by
  `readStudyReplacedDiagrams`; on a change already held, the chain's), and
  one that would not draw is refused every time, never dropped
  (`genStudyReplaceDiagramRefusal`): the call goes again without that
  pair. `toStudyReplaceArgs` reads a list sent as JSON text, or one pair
  alone, as the list; a replace is a part edit (`checkIsStudyPartEdit`),
  so with no `file` it goes to the one study open, it is never a whole
  rewrite and never read first, and a kept answer goes in whole without
  one (`toKeptAnswerDraftArgs`). A pair refused alone whose words the
  study's own name check names is put right before it is refused
  (`EC-541`, `applyStudyReplaceChecked`): by the worker, and on a change
  already held by the chain, which reaches the tool as a whole text -- so
  the chain's sentence for it leads the `change` the model is shown
  (`toModelDraftText`'s `noteText`; so does the chain's sentence for the
  parts it kept under a part's new words, `EC-544`). A `remove`
  (2026-11-13, `EC-543`) is a part edit the same way, writes no words and
  so parses no diagram, and on a change already held is taken out of it
  by the chain. Before
  that, a change whose words report a change (`findStudyChangeReport`,
  `EC-505`) and a whole
  text that would drop the file's parts (`routeWholeStudyRewrite`,
  `EC-502`) are refused or routed, and a part drafted by its `section` with
  none of its words shown is read by the window and sent back with them
  (`findUnreadStudyPartRefusal`, `EC-500`; `chatbot-files-report.md`). The
  draft is lifted into `watch.draftedStudy` and the model is shown
  `[held by the window: N characters]` and `STUDY_HELD_NOTE` in place of
  the study, so it is not billed twice; `save` and `preview` from the model
  are refused (`STUDY_SAVE_MODEL_REFUSAL`, before the tool host is
  reached). The answer's buttons are the card's alone
  (`withStudyDraftUnder`), and a study ask is handed on after a round like
  a Resources one (`canHandOnAfterRound`: the model writes nothing). When
  the assistant stops with a study held -- its rounds run out, or the
  service fails after the draft -- the answer is the card's own sentence:
  Create for a new study, Preview and then Save changes for a change
  (`genOutOfRoundsAnswer` in both loops, `genStudyStoppedText`,
  `STUDY_CHANGE_STOPPED_TEXT`; `EC-504`). Out of rounds it had been _could
  not settle on an answer_ over a **Save changes** that took out 29 of a
  study's 30 parts, and a failure had said _Press Create_ over a change.
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
  **An answer kept as a study is that answer, word for word** (2026-11-11,
  `EC-466`). The prompts say how to keep one (`STUDY_KEEP_ANSWER_RULE`: a
  `content` or `append` of `@answer`, put in by the window,
  `toStudyContentFromAnswer`), and that alone did not hold: asked _save that
  as a study file_ under its own explanation, gemma4:cloud wrote a study of
  its own again, three diagrams and 13.5k tokens. So the window keeps it. A
  short line that keeps an answer (`readKeepAnswerAsk`: a keep verb, a study
  word, and _that_, _this_, _your answer_ or _above_, or _save as …_; never
  a line asking for more, a topic -- _about that_ -- a how-to or a note --
  in English in code, and since 2026-11-12 in every installed language
  through its `studyKeepAsks` pair, `checkIsStudyKeepAsk`, EC-508: the keep
  words compiled at the first line read, a language's whole pattern only
  for a line its keep words read, and the answer above looked for first)
  under a real answer (the NEWEST: `findStudyAnswerAbove` with
  `isNewestOnly`, never a study card or a short line) carries `keepAnswer`.
  The ask then rides `STUDY_KEEP_ANSWER_HINT`, and `runStudyDraft` puts the
  answer in whatever the model wrote (`toKeptAnswerDraftArgs`: a new
  study's `content`, or an `append` to a `file`, at the end of `section`
  when named -- never the whole file replaced). The model is told only that
  it is ready (`STUDY_KEPT_ANSWER_NOTE`, `STUDY_KEPT_ANSWER_CHANGE_NOTE`),
  and a kept diagram that will not parse is dropped, never sent back. Its
  passage is quoted in the ANSWER's language, not the typed line's
  (`pickKeptAnswerLanguage`). A Retry reads "that" above the question's
  first asking (`retry.questionId`, `findFirstTryQuestion`): retried words
  land at the end of the tab, under the earlier try's card. Seen in the
  window: the answer kept for 6k tokens, with a one-sentence reply.
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
  words; a Burmese sentence had held a Sinhala letter. **So is English
  left as it was** (`EC-533`, the user's John 3 study, its Khmer half: a
  timeline's three periods and a mindmap's four branches still English,
  and _and_, _between_, _and_ in the prose). A diagram's ask names the
  words a reader sees for its KIND (`studyDiagramWordHelpers.ts`, a leaf:
  a timeline's period stands before its colon, a mindmap's node has none;
  it had said "the words after a colon"); a diagram that draws but left
  labels -- Latin with none of the script, or two words given back word
  for word into a Latin-script language (`listStudyDiagramLeftLabels`) --
  is asked once more naming them, the answer leaving fewer kept, and one
  with every label as it was is kept as it was. **A dialogue's boxes are
  labels too** (`EC-582`, 2026-11-13, the user's Genesis 4 study after
  _change all to khmer_: the sequence diagram's messages Khmer, its three
  boxes still _God_, _Cain_ and _Abel_ -- ids its messages named, which
  the translator keeps because the arrows use them, and no check read). A
  participant named only by a message or a note, or declared with no name
  after `as`, is drawn by its id, so before the ask
  `withStudySequenceNames` gives each such id itself as its name
  (`participant God as God`, declared right before the line that first
  names it: every box keeps its place), and the ask says to translate
  each name after `as`, never the id before it. An id the translator wrote
  in the language on a declaration is put back by order
  (`keepStudySequenceIds`); an answer whose participants' ids changed is
  not the same diagram (`checkIsStudyDiagramTranslated` over
  `listStudySequenceIds`: an arrow naming the old id draws a second box);
  and a participant drawn by its id is a label (`listStudyDiagramLabels`),
  so one left in Latin letters is asked about once more and is listed by
  a saved study's check, where a replace in that translation renames it
  on every arrow. A diagram whose translation is not taken stays as it
  was, without the names. **And what is in the language already is
  kept as it was, never asked** (2026-11-13, `EC-589`): asked _change
  all to khmer_ again, the Genesis 4 study -- written in Khmer -- had
  every part handed over, a Khmer part handed back as it was was no
  translation, twice, and the job stopped with nothing drafted: a study
  left partly English could not be finished by asking again.
  `planStudyTranslateJobs` (pure) plans the jobs now. Into a language
  with a script of its own, a paragraph whose every letter is the
  script's (`checkIsStudyTextInLanguage`; code, a link's address, a
  `[^…]` token, a tag, a single Latin letter and one word set apart as
  a term aside -- a name or a Bible's key in Latin letters is English
  left), a diagram whose every label is (`checkIsStudyDiagramInLanguage`,
  a box drawn by its id a label) and a passage quoted in it, its key
  aside (`checkIsStudyPassageInLanguage`), are kept byte for byte and
  never asked, as is a paragraph with nothing to translate in any
  language; the rest is asked and cut as before (the John 3 study's
  English: the same jobs, chunk for chunk). Words handed back as they
  were are taken when they are in the language already
  (`checkIsStudyTextGivenBack`): into a script, most of their letters
  its own; into Latin letters, only when the window's reader names the
  language too, never on the translator's word alone. A translation
  that comes out as the study was drafts nothing and says why
  (`describeStudyNothingTranslated`); one to be added after a study
  whose words are all in the language is refused before anything is
  asked, the rest offered in place (`genStudyAppendInLanguageRefusal`);
  and EC-534's book names are read for the words asked alone. Measured
  offline, read only: the Genesis 4 study is one ask -- the dialogue --
  where it was nine, its 12 paragraphs, 3 diagrams and passage kept byte
  for byte; the John 3 study's Khmer half would be asked for what is
  left in it (its timeline and mindmap still English, _Tite_, _and_, a
  Chinese letter and a Thai word). Not seen in the window. In the words,
  a lowercase
  English word between two of the script's letters on a line
  (`listStudyStrayWords`; a capitalised name, a term in italics or quotes,
  code, a link's address and a `[^…]` token left) counts with the missing
  church words and is named in the part's retry. **And a book is named as
  the language's Bible names it** (`EC-534`, the same Khmer half: Titus as
  the French Bibles name it, Ezekiel as no installed Bible does, Numbers
  twice by the everyday word for a number, while every Khmer Bible on the
  computer names all three -- the translator had been told only to write a
  book in the language). With a Bible in the language to quote from
  (`bible`, not the English stand-in) and a part citing a chapter and
  verse outside code, a link's address, a `[^…]` token and a tag
  (`checkHasStudyRefNumbers`), `runStudyTranslate` reads every installed
  Bible's book names ONCE for the job (`owa_bible_suggest books`,
  `readStudyBookNameTable`; a failed read leaves the names to the
  translator), held to that Bible's (`toStudyBookNameTable`; none for a
  Bible naming its books mostly in English in a language that is not --
  the Greek, Hebrew and Aramaic ones here). Then, per part
  (`studyBookNameHelpers.ts`, pure, reading references with the verse
  check's own scanner): the ask names that Bible's name for each book the
  part cites, sixteen at most (`toStudyBookNamesText`); a reference the
  answer names as only another language's Bibles or the English name that
  book, or writes short as the Bible's name does not start, is written
  with the Bible's name in code (`repairStudyBookNames`); and one named as
  no installed Bible names a book, or as another book, counts with the
  missing church words and is named in the retry with the name to write,
  eight at most (`listStudyBookNameSlips`) -- where such a name starts in
  a script written without spaces, only the translator can tell. Only a
  reference the part cites at the same chapter and verses counts; a name
  another Bible of the language gives is left. Measured offline on that
  study, read only: 0 of the 4 caught before, 4 of 4 after (one written
  right in code, three named for the retry), nothing flagged among its 16
  other references or on the English half against the KJV; not seen in
  the window. **And a name is written as the Bible quoted writes it**
  (`EC-535`, the same Khmer half: Aenon and Salim each with another vowel
  sign than every Khmer Bible, the Jordan with other letters, under
  verses quoted a page above that write all three; the Pharisees as the
  church words write them, read off another Khmer Bible, with another
  vowel sign than the one quoted). With the passages quoted in the
  language (`quoted` on the plan's passage parts), `runStudyTranslate`
  reads the plan once (`toStudyNameGuide`, `studyNameHelpers.ts`, pure,
  no call). A church word the passage writes with the same letters and
  one letter's vowel signs otherwise, a whole word of its verse of three
  letters or more, is told as the passage writes it, and one for a NAME
  written the list's way in the answer is put right in code
  (`repairStudyNameSpellings`). A name the English passage writes with a
  capital inside a sentence and never without one, no pronoun and no
  church word, in a verse or two, is shown with its verse as that Bible
  writes it, four verses and 900 letters at most a part
  (`toStudyNameVersesText`); a word of a shown verse the answer writes
  with one letter's vowel signs otherwise, never one the passages write,
  counts with the missing church words and is named in the part's one
  retry, eight at most (`listStudyNameSlips`) -- two real words can be a
  vowel sign apart, so only the translator can tell. Only the script's
  own vowel signs are a difference: a mark any writer may leave off
  (`\p{Script=Inherited}`) is left out, and a virama, tone mark or point
  (`\p{Diacritic}`) must be the same. Measured offline on that study,
  read only: 0 of its 4 vowel-sign slips caught before, 4 of 4 after (the
  Pharisees written so in code twice, Aenon in the words and a diagram
  and Salim named for the retry), nothing else flagged, 1 269 characters
  of verses for the whole job; the Jordan is only shown its verse. Not
  seen in the window. **And a name written with OTHER letters is named in
  that retry too** (2026-11-13, `EC-561`), read off the words standing
  for it as the saved check's `EC-560` reads them: the part's bold span
  naming it and the answer's in its place (`pairStudyBoldSpans`), the
  words that may write each name read once for the job
  (`toStudyNameGuide`'s `nameWords`), and the slip named with its English
  name -- _Jordan as "…" (verse 26 writes "…", if that word is Jordan)_
  -- because the verse's word coming closest may be another; named even
  when no verse is shown. A place of other letters is whole words, as the
  platform's word breaking reads them (`checkIsWordPlace`), and one that
  is only part of its span's words comes 0.8 close: with the user's
  headings paired wrongly on purpose, a piece of _share_, a piece of
  _born_ and two whole words of a heading came close to a word of
  "Light"'s verses, _evil_. Measured offline on that study, read only, its
  Khmer half handed back as each part's answer: the Jordan named beside
  the three vowel slips; all 18 rotations of the bold spans of its two
  parts that bold any named nothing wrong; nothing named in the parts with
  no bold name. Not seen in the window. **And every
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
  old spelling's cedilla in the new one's comma. The spaces, hyphens
  and line breaks between a church word's words are taken out of both
  sides as well (2026-11-13, `EC-596`): _John the Baptist_, hyphenated in
  the Khmer list, would have been asked again of a part that spaced it.
  A heading so written
  starts with a capital (`toHeadingWord`). Fifteen packages have no list:
  no free Bible text in the language, or one in a spelling the app does
  not write (Armenian, Belarusian, Greek). The card counts one diagram as
  one (`EC-487`: a singular key in every package). **The words also say
  the script** (`EC-493`): when most of their letters are in one script
  other than Latin, the translator is told to write it (_into Serbian,
  written in Cyrillic letters_) and every part is held to it
  (`scriptPattern`, the 40% rule); several scripts at once (Japanese) are
  all held to, none named. Serbian had come back in Latin letters, every
  Cyrillic word handed over "missing". **A language turned off or not
  installed is OFFERED first** (`EC-494`): turned off in Settings →
  Languages it is out of the window's file store, so its words, labels and
  script cannot be read, and reading a turned-off plugin behind the
  person's back is not the fix (turned off means not used). So
  `runStudyTranslate` asks `findStudyLangOffer` before it loads anything:
  the store, then `owa_language check` (`checkChatLanguage`). A language
  turned off, or missing from this app but in the catalog, refuses the call
  (`genStudyLangOfferRefusal`: say so in one sentence, translate nothing,
  draft nothing), and the model's own drafts are refused while it waits
  (`watch.langOffer`). Its sentence is asked for in the language of their
  question, not the one translated into, with no steps or options of its
  own: gemma4:cloud had written it in German in an English window and sent
  them to Settings past the buttons. The window draws the offer under that
  answer (`answer.langOffer` → `genStudyLangOffer`,
  `chatbot-bible-import.md`): **Enable** / **Install it**, and **Not now**,
  which asks the question again at once with `skipLangOffer` and
  translates as before, without the package. **The offer is the window's,
  never the model's**: the model's one sentence about it is not drawn
  (words that say more are, `checkSaysMoreThanLangOffer`: a second
  paragraph or over 300 letters, another part of the question answered),
  no options are drawn under it, and the message keeps the offer's words as
  `windowText`. A model is shown that answer without them or their
  buttons, and an answer that was the offer alone as one line naming no
  language, state or button (`toModelHistoryTurn`,
  `LANG_OFFER_HISTORY_TEXT`); a report keeps all of it. Seen live: shown
  the Serbian offer as its own earlier words, the model wrote it again over
  a German answer -- turned off, where German was not installed -- with
  **Enable; Not now** as a chip; with that gone, it wrote its own German
  sentence again over Serbian, _not yet installed … install it first_
  above **Enable**. A check
  that cannot be made, `unavailable` or `unknown` never blocks: the study
  is translated as before. Seen live 2026-11-11 on the dev app, Auto
  (gemma4:cloud, free), the user's John 3 study: Serbian turned off, the
  offer and nothing drafted (17.8k tokens), **Not now**, then the Serbian
  pages drafted (23.7k), in Latin letters as before. After those fixes, in
  one tab handed the study from the Markdown Preview: German, not
  installed, drew the window's offer alone -- **Install it** / **Not now**
  with its 0.2 MB, no chip (17.2k); Serbian under it the same with
  **Enable** (17.4k); **Not now**, and the Serbian pages were drafted again
  (23.6k). Nothing saved, installed or turned on. **A study translated again
  is translated from its own words only** (`EC-492`,
  `splitStudyTranslations`): a translation added after it opens with a rule
  and a `#` title of its own, the plan hands that tail over as
  `translations`, kept as it is -- after it for `append`, put back after the
  new words for `replace`, left out of a copy. Serbian asked after a Khmer
  translation had come back twice, from the English and from the Khmer.
  **And one translated again into a language it holds takes the old one's
  place** (2026-11-13, `EC-547`, `findStudyTranslationsInLanguage`): Khmer
  asked again under `append` had been added after the first Khmer, two of
  it in the saved file. A translation added after the study is in the
  language asked when the window's reader (`detectTypedLanguage`, its
  first 2 000 letters of words) names that language AND it is written
  like the new translation, whole against whole (`textLikenessHelpers.ts`,
  no language data): a letter-run likeness of 0.65 or more, and no letter
  it writes often that the new one never writes. The reader knows only
  the INSTALLED languages, and a near language not installed reads as one
  that is; the new translation is the one sure sample of the language
  asked. The likeness reads what is said as much as the language, so a
  translation of words much changed since stays, the new one added after
  it as before. Taken, `append` becomes `content` with the new words in
  the first one's place, its rule kept, and every other copy in that
  language out; `replace` drops them; a copy (`new`) is as it was. The
  model's tool result says which (`describeStudyTranslation`'s
  `takenCount`). Calibrated offline, the user's Bibles and the packages'
  dictionaries read only: of the same chapter in two Bibles of one
  language -- English, Khmer and French, the languages the user has two
  Bibles of -- 684 of 690 pairs at 0.65 or more (the rest one Khmer Bible
  in another church's words, Romans 8); of 2 312 pairs in two languages,
  none taken; of 7 656 dictionary pairs, 24, each two near-identical
  languages -- the risk left, beside a script whose every sign is a word
  (Chinese), whose re-translations are unmeasured. On the user's John
  3 study (read only): the file would have held two Khmer translations,
  one after, everything else byte for byte; a French one taken by
  nothing, even with a reader made to misread it; 5 to 13 ms for its
  11 305 letters. Unit-tested through the window's loop; not seen live
  (the dev app's relaunch was not allowed that day).
  **And what a part's second ask still left is said before the card is
  saved, and put right in it** (2026-11-13, `EC-600`,
  `toStudyTranslationLeftNote`): a part's answer with fewer problems is
  kept whatever it still leaves, and the model, told only that the window
  translated it, said so over a card with English in it -- the user's _it
  still partially english_. Now the study as written and its new
  translation after a rule are read together as a saved study is
  (`EC-536`, `EC-559`, `EC-560`, `EC-596`: a word a vowel sign from its
  verse; letters of another script, English words and labels left; a name
  with other letters; headings and church words), and the list rides the
  tool result (`toStudyTranslationLeftText`), nothing when nothing is
  left. For a change the card holds (`append`, `replace`) the model is
  told to put the English words, labels, letters of another script and
  headings right in ONE `replace` with `section` the translation's title,
  which the window drafts onto the change held (`chainStudyPartEdit`) --
  in the same ask, since a pressed option is a new ask, which holds no
  change -- and to say the rest with its verse's or Bible's word, never
  that every word is in the language; for a copy (`new`) the same, its
  `file` the new study the card holds (`EC-604`, below). Measured offline on the
  user's John 3 study, read only, its Khmer half handed over as if just
  drafted: 16 words and two church words named in 3 542 characters, 18-20
  ms warm (115 ms the first time), and each of the 15 a `replace` takes
  as listed written over by one scoped to the title, the English half
  byte for byte. Unit-tested through the window's loop; not seen in the
  window.
  **And a part of a NEW study the card holds is changed in that card**
  (2026-11-13, `EC-604`, `chainHeldNewStudyEdit` and
  `redraftHeldNewStudy` in `studyFileChatHelpers.ts`, `runHeldNewStudyEdit`
  in `llmBotHelpers.ts`). A new study is held by the window until Create,
  so it has no file: a `draft` naming it had been answered that no such
  file is saved, and for a copy `EC-600` could only say what was left, to
  be put right once it was created -- the person saved English with it
  first. Now a `draft` that names the held new study's `file` (its name in
  any case, `Default/` before it or not, never a path a saved study open
  in the tab has), or no `file` and no `ref` while no study is open in the
  tab, and changes a part -- `section` with `content` or `remove`,
  `append`, `replace`, a saved study's own part edits -- is made in the
  held words by the chain a held change uses (`chainStudyPartEdit`, the
  held study posing as a change), and the study is drafted again as a NEW
  one through the tool: its `ref`, the title off its `#` line, the words
  under its passage, its Bible. The passage there is the app's, quoted
  again from the Bible: a change that would touch it (a `remove` naming
  it) is refused (`STUDY_HELD_PASSAGE_REASON`), and so are one that takes
  out the `#` title, one that leaves no words under the passage
  (`STUDY_HELD_EMPTY_REASON`) and the study sent whole again under its
  name (`genHeldStudyWholeRefusal`: draft it with `ref` and no `file`).
  Only the diagrams the change writes are parsed: a `replace` that breaks
  one is refused every time, a part's or an append's sent back once and
  left out after, as in a first draft. The model is shown the draft as a
  new one, its `change` led by _Changed in the new study the card holds,
  which is still not saved:_ and the replace's own sentence -- or, when
  the draft is not the words as changed, the comparison's; the card is the
  same card (Create, **New Bible Note**), a Markdown-only or window-made
  one kept so. A `read` of the held name is answered off its words
  (`readHeldNewStudy`, cut at 16 KB as a saved file's read is). A
  translation copy holds the window's words, none of which the model saw,
  so a part of it written anew by `section` and `content` is read by the
  window and handed back with its words first, once (`EC-500`'s guard,
  `DraftedStudyType.isWindowMade`); `replace` and `append` need no read.
  A report of a change written into it (`EC-505`) is refused before
  anything is changed, as a saved study's is -- a call naming no file read
  as one naming it, the headings given back read off the held words.
  `toStudyTranslationLeftText` now takes the target, so a copy's list asks
  for its `file` and `replace` like a held change's. Measured offline,
  read only: the user's John 3 study's Khmer half held as a new copy
  (11 340 characters, 15 headings, 4 diagrams, its 73-line passage) and
  the Genesis 4 study held as if just drafted -- each of their 22 parts
  below the title given new words, added to and taken out, 66 of 66
  through with the passage kept; the title's words changed and added to,
  its removal refused as a saved study's is, the passage named by its
  reference refused; each of the copy's 15 Latin words (_Tite_, _and_,
  _between_ and 12 diagram labels) written over alone 15 of 15 and all
  15 in one call, the held text each time exactly a saved file's
  `replace`; the worker's shaping of a new study's words keeps both bodies
  byte for byte and composes the held file back, so the replace's own
  sentence is what the model reads; 0.2-0.6 ms a call. Unit-tested and
  through the window's loop (`llmBotHelpers.studyTranslate.test.ts`); not
  seen in the window.
  **And a LATER question reaches the study the card above holds**
  (2026-11-13, `EC-606`, `findHeldStudyAbove` and the helpers beside it in
  `studyFileChatHelpers.ts`, `AskExtraType.heldStudy`). A held draft had
  been reached only by its card's buttons and by the ask that drafted it,
  so _change its title_ typed under the card held no study, in a tab
  offered no `owa_resource_file`. The window passes the new study of the
  card right above the question -- the tab's newest answer, a thumb-down
  follow-up stepped over, a Retry reading above its question; never a
  change, a draft naming no passage, a note's twin, a draft the window let
  go, or the translator's own ask -- and the ask holds it beside its own
  (`toReachableNewStudy`: the ask's draft first). An ordinary ask is
  offered the study tool for it (`withHeldStudyTool`, those asks alone)
  and told the study on the ask (`genHeldStudyAskHint`: its name, passage
  and headings, how a part is changed and that it goes into a new card,
  never by hand or after Create). Its parts are changed by `EC-604`'s
  chain into a card of their own, the card above keeping its words; a
  part written anew by `section` and `content` is read first, once
  (`isFromEarlierAsk`, kept through the redraft, as `isWindowMade` is). A
  read of it, or a change or translation refused, brings its card back
  under the answer (`genHeldStudyBeforeActions`, held again under a new
  reference once the window let it go), so the next line reaches it too.
  A translation of it was refused in a sentence -- press Create, then ask
  again -- until `EC-609` (below). A change to it claimed and never made, a
  question in between (only the newest answer's card was read) and an
  answer cut by an error (no card came back) were open until `EC-700`,
  `EC-701` and `EC-702` (below).
  Unit-tested and through the window's loop; seen in the window on
  2026-11-14 (`EC-703`'s runs, below): a question typed under a new
  study's card was answered about that study's passage, with **Add this
  to the study** under it.
  **And the ask says what the study is written in** (2026-11-13,
  `EC-608`, `readStudyHalfLanguages`, `findOpenStudyFileName` and
  `genStudyLanguageHint` in `studyFileChatHelpers.ts`). A question asked in
  another language of a model that is not a Gemma 4 goes to it in English,
  and a tool's arguments are never translated, so _add a prayer at the
  end_ typed in Khmer under a Khmer study had nothing saying an English
  prayer was wrong there, and words they gave to be written in came as
  their English. For the study a question can change -- the one open in
  the tab that `draft` takes (a `Default/` or `Bible Notes/` Markdown
  file, off the whole text the name check already reads), else the new
  study the card above holds -- the window reads each half's language
  once (the study, then each translation after it, six at most, off its
  own words: no quoted passage, diagram or footer) and the ask says it
  when one is not the language the model is asked in: every word put
  into it in that language, or into a part in its half's language,
  whatever language the message is in, unless they ask for another. Asked
  their English, their words go with it as typed -- a word a `replace`
  writes over and words to be written in are taken from them, the answer
  staying English for the translator (BN-23's for a note). The name
  check's gate: a question with no conversation of its own. Measured on
  the user's two studies, read only: English then Khmer, and Khmer; 1.7 ms
  warm for the 44 KB one. Unit-tested and through the window; not seen in
  the window.
  **And a study not saved yet is translated from its held words**
  (2026-11-14, `EC-609`, `findHeldStudyToTranslate` and the helpers beside
  it in `studyFileChatHelpers.ts`, `runStudyTranslate`'s `held` in
  `llmBotHelpers.ts`, `readStudyToTranslate` in the worker). The window
  translated a study only from the app's plan of a SAVED file, so a
  translation asked under a new study's card had been refused: press
  Create, then ask again. A `translate` naming the held new study -- by
  its name, or no `file` while no study is open in the tab; the ask's own
  draft first, else the card above's -- is planned from its words: the
  worker's `translate` takes `content` and `name` in place of `file` and
  answers the parts the file of those words would, nothing read or
  written, its `file` empty. It is translated part by part as a saved
  file's is and drafted as a NEW study into a card of its own: added after
  it, the study and its translation after a `---` rule, its passage from
  the study's Bible; in its place or as a copy, the translation alone, its
  passage from the Bible in that language; kept as a Markdown file when
  the held study was, the card above keeping its words. A copy of a study
  drafted in the SAME answer is refused before anything is translated
  (`genHeldStudyCopyRefusal`: an answer holds one card), a translation that
  drafts nothing brings the card back, and the model is told no file
  changed and what the card holds (`genHeldStudyTranslatedNote`). A new
  study drafted with a translation after it draws six diagrams a half and
  sixteen in all (`checkNewStudyContent`: the user's John 3 study, four a
  half, would have been refused at six), and a verse a change adds to its
  translation is read from that half's Bible (`toNewStudyHalfParts`,
  `EC-570`'s rule). Unit-tested and through the window's loop; not seen in
  the window.
  **And a change to it claimed and never made goes back once**
  (2026-11-14, `EC-700`, `checkClaimsUnmadeHeldStudyChange` and
  `genHeldStudyClaimNudge`; the slip `EC-606` left open). Under the card,
  _I've changed the title_ written with no draft made left the card's
  words as they were, and its Create would keep them. With no study open
  in the tab, no draft and nothing else done in the ask -- no passage put
  up, no note made, no press (`isNonStudyCallMade`: any call but a read
  and the study tools, since a later line may be about anything) -- an
  answer that reports a change MADE is handed back once: draft it now
  with `file` the held name, or translate it, or say plainly it cannot be
  done. Written again, the answer carries `isChangeUnmade`'s note, and
  either way the card comes back under it. A made change is read by
  `checkHasMadeChangeClaim`: English's first-person claim words and the
  language's `claim`, never "not saved yet" -- the window itself tells the
  model such a study is not saved yet, and an answer saying so is true.
  So every language's `changeClaims` has that apart, as `unsaved` (88
  patterns split by machine, top-level groups only, 45 pieces placed by
  hand; the union is the old pattern, read the same on 3 663 lines, and
  `unsaved` reads none of a language's four claim samples). A plugin
  installed before it has no `unsaved` and its old `claim` holds both, so
  there "not saved yet" still counts as a claim until the plugin is
  updated. Unit-tested and through the window's loop; not seen in the
  window.
  **And a question asked in between no longer ends the chain**
  (2026-11-14, `EC-701`, `findHeldStudyAbove`'s
  `MAX_HELD_STUDY_ANSWERS_BETWEEN` and `genHeldStudyKeepHint` in
  `studyFileChatHelpers.ts`, `runHeldNewStudyEdit`'s `isAnswerKept` in
  `llmBotHelpers.ts`; the slip `EC-606` left open). Only the newest
  answer's card was read, so _what does born again mean?_ asked under the
  card left the next line, _add that to the study_, with no study held.
  The finder now steps over up to two PLAIN answers -- no buttons, no
  materials, no attachment asked for: an answer that offered anything is
  what the next line may be about, and the window's own _Saved as …_
  after a Create carries Open it and Undo, so a study saved since is never
  offered as a new one -- and the ask says the card is further up, above
  the last answer (`DraftedStudyType.answersBetween`, counted afresh each
  time: a card held again keeps the count it was reached with). An answer
  kept under it (`EC-466`'s keep ask) whose draft names the held file is
  an `append` of that answer through `EC-604`'s chain -- a kept answer had
  skipped the held chain, and a `draft` naming a file not saved was told
  there is none; with no `file` it is a study of its own, as before. The
  keep ask carries the way to it (`genHeldStudyKeepHint`: `file` the held
  name, `append` `@answer`), a kept diagram that will not draw is left out
  at once, never sent back, and the model is told the answer went in word
  for word and never to paste it (`STUDY_KEPT_ANSWER_HELD_NOTE`, a
  Markdown-only card's `STUDY_KEPT_ANSWER_HELD_MARKDOWN_NOTE`).
  Unit-tested, through the window's loop and the window's own ask, and
  seen in the window on 2026-11-14 (Auto, gemma4:cloud, free): under a
  fresh John 3:16 study's card, a question answered, then its **Add this
  to the study** pressed -- the card under the next answer held the
  study with that answer at its end, word for word, twice (38.3k and
  38.8k tokens). Nothing was saved.
  **And so does an ask that failed** (2026-11-14, `EC-702`,
  `ChatMessageType.isAskFailed`, set on the window's failure paths in
  `ChatbotAppComp.tsx` and read by `findHeldStudyAbove` and
  `findStudyAnswerAbove`). A failure's answer is the window's own sentence
  over the guide's stand-in, with the door to what went wrong (**Open AI
  settings**, a billing or status page) and the guide's own buttons, so
  the line typed again under it reached no study: the chain ends at an
  answer that did something. What stood for a failed or paused ask is
  marked now, kept across a reopen, and stepped over whatever its buttons,
  counted with the plain answers between (two at most). Nor is it ever
  kept as their answer: `@answer` takes the answer above it, and a keep
  line right under it is no keep ask by itself -- "that" may mean the
  answer above as well, so the model decides. A Retry had reached the card
  already, above the question it asks again. The card is not brought back
  under the failure, as a read brings it: its five buttons would have
  stood beside the failure's and the guide's. Unit-tested and through the
  window's own failure; not seen in the window.
  **And a question about its passage is answered, never sent to `/btw`**
  (2026-11-14, `EC-703`, `genHeldStudyAskHint`'s last sentence and
  `genHeldStudyQuestionNudge` in `studyFileChatHelpers.ts`, its branch in
  `findAnswerShapeNudge`). Seen live on Auto (gemma4:cloud): _What does
  the word begotten mean in this verse?_ typed under a new John 3:16
  study's card was answered _The guide covers this app only ... type
  /btw_, with **Ask it as a general question** -- the prompt's rule for
  what a word means -- and that answer's button ended `EC-701`'s chain,
  so the line after it reached no study. The held hint now says a
  question about the passage (a word, a person, the background) is part
  of the study: answered in plain words, the passage read with
  `owa_resource_file` `read` of the held name, never by telling them to
  type /btw, and nothing changed for a question (~70 tokens, on those
  asks alone). With the hint alone it was answered 1 time of 2, so an
  ordinary ask's answer (`canSearchGuide`) under a held card that still
  says to type `/btw` (`GENERAL_ADVICE_PATTERN`) is handed back once
  with `genHeldStudyQuestionNudge`, never on the last round; a `/btw` ask
  is one round and never handed back. The hand-back does not bring the
  card under the answer (`markHeldStudyBeforeReached` is left alone): a
  card there would end the chain and keep that answer from the keep ask
  after it. After: 2 of 2 answered in plain words in the window, **Add
  this to the study** under each; the hand-back did not have to fire
  live, and is unit-tested.
  **And an answer added at its end is headed** (2026-11-14, `EC-704`,
  `toKeptAnswerHeading` and `findStudyAnswerQuestion` in
  `studyFileChatHelpers.ts`, `AskExtraType.answerAboveQuestion` from the
  window). Kept by `EC-701`'s `append`, the begotten paragraph had gone
  in under the study's _Questions for Discussion_, read as one more of
  its answers. An answer appended at the end of a study goes under a
  `##` heading of its own now: the answer's `#` title when it had one and
  that is not the title of the study it goes into (`toStudyFileTitle`,
  off the file's name), else the line they typed for it (the line of
  theirs above the answer, a `/btw` and a reply's quote taken off, the
  marks a heading would misread taken out), 8 to 100 characters, never a
  command or a line ending in a colon. An answer that opens on a heading
  keeps its own, one put into a named `section` goes in unheaded, and a
  new study made of an answer is as before. Seen in the window twice, in
  `EC-701`'s run: the study ending `## What does the word begotten mean
in this verse?` and the answer under it word for word.
  **And no option under its card says one of its buttons again**
  (2026-11-14, `EC-705`, `dropStudyCardEchoReplies` in
  `studyFileChatHelpers.ts`, applied in `ChatbotAppComp.tsx` where an
  answer's options are worked out). Seen live under the card a keep
  brought: the model's _Create in Resources_ and _Create in Bible Notes_
  beside **Create "..." in Resources** and **... in Bible Notes**.
  Pressed, those words go to the model as a question, and the model can
  never save a study. Beside a card (an action of its three tools), a
  model's option is dropped when it is one of the card's labels with the
  quoted name taken out -- in English and as drawn, so in the window's
  language too, letters and digits alone compared -- or, in English, says
  create, save or keep it (in Resources, in Bible Notes, as a note), save
  the changes, a new Bible note, preview it or change its name; never a
  change asked for, which names what to change. The model's options are
  read BEFORE they are counted: a card's five buttons leave room for two
  options, and the two echoes had been those two, so an option asking
  for more went with them; the options the window works out itself are
  read after. Seen live after: the card's five buttons and no echo under
  them. The page cannot show what was dropped and the session file is
  not read, so whether the model wrote echoes that time is not known.

- **A song's words read off pictures** (2026-11-10, `EC-488`,
  `agent-songs.md`): `askLlmBot(…, {isGeneral, isTranslation,
isTranscription, images})`. `isTranscription` is read first by
  `toSystemPrompt` and sends `TRANSCRIPTION_SYSTEM_PROMPT` (copy the sung
  lines exactly as printed, in the script printed, never translated; a blank
  line between stanzas; no titles, numbers or copyright; `=== picture N ===`
  before each picture's words), one round, no tools. It is asked DIRECTLY,
  never through the Gemma 4 translator (`chatTranslateHelpers.ts`): a
  transcription put into English is a different song. Who reads
  (`askPictureWords`, `ChatbotAppComp.tsx`): the tab's own model when it can
  see (`checkCanSeeImages`); on Auto, or a no-cost server or Free that cannot,
  Auto's picks with `needsImages` (`resolveAutoPicks`); a paid key that
  cannot, that company's first seeing model (`getFirstImageCapableModel`),
  never another company's key; nobody, a sentence and **Open AI settings**.
  The wait reads _Asking {who} to read the words off the pictures_, the cost
  counts in the tab's credit, and the card names who read them.

- **And one for an animation in Customize** (2026-11-19, the user: _add
  chatbot icon to open in chatbot and let chatbot control editor_, the goal
  _chatbot can help handle css and glsl code editing_; the tool in
  `agent-tools.md`). `owa_animation_edit` goes to an `animation` ask
  (`src/chatbot/animationChatHelpers.ts`): the conversation the 🤖 on a
  Customize row or in the **[en:tran:Shader Code]** or
  **[en:tran:CSS Code]** title bar opens
  (`takeChatbotAnimationRequest`, the editor's id checked against
  `^(background|foreground):(\d{1,3}|none)$`), and any plain line under an
  animation answer (`checkIsAnimationThread`, the answer marked
  `isAnimationAnswer`, kept across a reload; not a `/` command). The
  opening answer is the window's, no model: what can change, its code
  among it, with three replies (`genAnimationOpeningAnswer`; the third
  **[en:tran:Explain the shader code]**, or
  **[en:tran:Explain the CSS code]** for any CSS animation: a built-in
  effect's code is what its panel opens on, the effect written as CSS
  (`agent-tools.md`), so the hand-off carries no `hasCode` and the chip
  _Write it as CSS code_ went, 2026-11-19). Each question reads the
  editors first (`toAnimationReadText`: six editors and 12 000 characters
  of the target's code at most, quoted as `glsl` or `css`, whether it
  compiles or passes its check -- a built-in effect's code as any other's,
  `genCssEffectCode` or `genGlslAnimationCode` when its panel is shut) and
  puts them and the last answer's undo ids under it (`toAnimationAsk`),
  under `ANIMATION_SYSTEM_PROMPT` (WebGL 1 / GLSL ES 1.00 and the helpers
  the runtime's header declares: `iResolution`, `iTime`, `uColors`,
  `colorAt`, `palette`, `noise`, `fbm` …; and the CSS scaffold -- `.scene`,
  `.layer`, `.dot` and their variables, `var(--color-N)` and
  `var(--accent)`, keyframes on transform and opacity only, what is
  refused), `ANIMATION_MAX_TOOL_ROUNDS`
  8 -- code that does not pass is sent back with its error. Every
  change of one answer is ONE **[en:tran:Undo this change]**
  (`readEditedAnimation`, `mergeEditedAnimation`); the press undoes the
  OLDEST id (`pickAnimationUndoId`), which takes the later ones with it,
  through the tool's own `undo` (not `owa_undo`: the change is no file),
  and says _The animation is back as it was before that change._
  ~402 tokens a round to that ask alone; the ordinary list and its
  ratchet did not move (~8 464 of 8 480, `--stdio --ratchet`). **With the
  strip full the card lands in the tab in front, and that tab lets go of
  what it held** (`toAnimationHandoffSession`): its file, its record and
  its foreground sessions are put away at its last message, as their ×
  does -- seen live, the card had landed under an Exodus study still
  _Still asking about_, and a line typed under it would have gone to the
  study (`resourceFileNames` turns the animation route off). Seen live on
  the dev app: the 🤖 in the Shader Code title bar and on the Customize
  row each opened the help window on _Living Water - Ripples_ with its
  three replies, the second with the held study put away. Typed lines
  under the card, seen live the same day (gemma4:cloud through Auto, no
  cost): _Change the shader code so the ripples swirl slowly around the
  center of the screen_ wrote a new `mainImage` (an `atan` swirl over
  `fbm`, the runtime's `lightOver` / `rampColor` helpers) that compiled
  and went on as `custom`, and its **[en:tran:Undo this change]** put
  _ripples_ and the panel's own code back; on Animation Show's CSS card
  (_Bokeh_, offering then to make it a shader), _Make the bokeh
  slower and use warm sunset colors, a bit see-through_ set speed slow,
  four warm colours and opacity 70, and its Undo put all three back.
  **And a CSS animation's own code** (the same day, once CSS Code was
  built): under the **Custom CSS** card from the CSS Code title bar,
  _Rewrite the CSS code so slow golden snowflakes fall gently from the
  top, using the animation's colours_ wrote CSS that passed and went on
  (6.1k tokens, no cost) -- but styled `.dot` with no `left`, so every
  flake fell in one column at the left edge, which the model cannot see.
  The tool now says so in its answer (`findCssCodeHint`: a `.dot` styled
  and no `var(--x)` anywhere), and the person's own next line, _they all
  fall in one line at the left edge, spread them across the whole
  screen_, got `left: calc(var(--x) * 1%)` / `top: calc(var(--y) * 1%)`
  (6.8k tokens). That answer's **[en:tran:Undo this change]** put the
  first version back. (The FIRST answer's Undo, pressed after a hot
  reload of the registry module in dev, answered _no longer held_: the
  list is memory, and a dev reload empties it.)

- **And one for a PowerPoint or Word file** (2026-11-20, `EC-761`, the
  user: _open pptx or docx in chatbot then interact to edit the
  powerpoint_, _able to undo_; the tool in `agent-tools.md`).
  `owa_office_edit` goes to an `office` ask (`src/chatbot/officeChatHelpers.ts`,
  the slide document's shape): a question while a `.pptx` or `.docx` is
  open in the tab -- two at most (`MAX_OFFICE_ASK_FILES`), found the way a
  slide document is (`findOpenSlideAttachments` with
  `checkIsOfficeEditFileName`, so a picture attached after it does not
  close it), and a supported question asked as it stands still the
  guide's. Before each question the window reads each file as it is now
  through `owa_office_edit read` with its whole path and puts it under the
  question as plain lines with their ids (`toOfficeDocumentText`,
  `toOfficeAsk`; a translation's or a placement's hint as for slides),
  under `OFFICE_SYSTEM_PROMPT`, `OFFICE_MAX_TOOL_ROUNDS` 8. The model
  names a file; the WINDOW turns the name into the attached file's path
  (`resolveOfficeEditFile`, in `runMcpToolCall`), a path the model writes
  is refused, and outside an office ask the tool is refused and never
  called. Every edit of one answer is ONE **[en:tran:Undo this change]**
  (the MCP layer's answer carries `name`, `isChanged` and `undoId`, read
  by `readEditedLyric`, merged by `mergeEditedDocument`), and
  **[en:tran:Show it in the list]** beside it. Two files changed by one
  answer are BOTH put back by that press (`EC-787`: the undo of each
  document is kept, `undoNames`, one _… is back as it was_ sentence
  each); and a question that came with an office file names the tab's
  earlier ones as not to be changed unless named (`toOfficeAsk`'s
  `otherNames`) -- _add a box Serve after Pray_ with Mission Process
  attached had changed Mission Steps too, from earlier in the chat.
  **[en:tran:Make a song from it]** on its card stays the window's own
  song drafting (`EC-590`), reached before the office route. ~2 491 tokens a round to that ask alone (~497 since `EC-765`, `owa_find_verse` riding it too; ~733 with the look, background and `removeBox` of `EC-768`; ~960 with the boxes, sizes, show, slide size and pictures of `EC-770`; ~1 381 with the layouts, tables, charts and animations of `EC-771`; ~1 993 with the box looks, shapes, links, numbers, footers and gradients of `EC-773`; a slide by its words, a pattern, the theme and SmartArt's words of `EC-774`/`EC-775` ~2 158; a picture, video or sound at a link they typed, `EC-777`, ~2 172; the masters, `toShapes` and a box's shape of `EC-778`/`EC-779`, ~2 282; `arrange` and its `at`, `EC-780`, ~2 319; `smartArtLayout`, `EC-784`, ~2 364; its Venn and Hierarchy and `everywhere`, `EC-785`/`EC-786`, ~2 371; a SmartArt's box added, taken out or moved and a deck's own layout, `EC-787`, the rest);
  the ordinary list and its ratchet did not move (~8 464 of 8 480,
  `--stdio --ratchet`). A picture attached beside the file is named to
  the model by its NAME and its path put in by the window
  (`resolveOfficePictures`, `ToolWatchType.officePictures`; a path the
  model writes is `Tool refused:`; `chatbot-files-report.md`).
  Held by `officeChatHelpers.test.ts`, the loop's own test in
  `llmBotHelpers.ut100.test.ts` (prompt, a path refused, two edits named
  by name both by the path and undone by one press, the tool refused
  outside) and `ChatbotAppComp.office.test.tsx` (the card with no model,
  a typed change asked with the file read first and `extra.office`, the
  song button never an edit). **Seen live in the window** (`EC-762`,
  the same day, a scratch dev instance, fixture files; the AI caution's
  **Open** pressed by automation under the user's authorization for that
  check alone): _Change Lord to God everywhere_ answered in 4 s on Auto,
  a slide copied and its title changed in one answer through `copies`, a
  Word word replaced and a paragraph added, each put back to the same MD5
  by one **Undo this change**, and **Make a song from it** leaving the
  file alone. Asked in French since (`EC-772`, `EC-773`): the card and
  every change in French, each undone byte for byte. **A quotation of the
  file's own words is written as the file has it** (`AnswerKeepType.fileText`,
  the read office or slide document's text, `holdFileQuotes` in
  `answerLanguageHelpers.ts`): the deck's _his only Son_ had come back with
  the dictionary's French for the label "Son" as its last word. Speaker
  notes asked there too. Not yet: a file open in PowerPoint on Windows
  (`EC-766`). Recipe W-65. **The model was
  measured too** (`EC-765`, the same day): the window's prompt,
  ask and tool list (`pickAskToolList(tools, 'office')`, which since then
  carries `owa_find_verse` too: the prompt said a verse is read before it
  is written and nothing could read one) on gemma4:cloud at temperature
  0, 18 asks against the scratch instance, every change undone byte for
  byte: 12 of 16 → **18 of 18** right, one call each but a verse (read,
  then written) and a copy retitled (copied, then changed by the ids its
  answer gave). The driver was a session script, not kept; its rows are
  in `test-results/chatbot-quality/office-model-20261120-{a,b,c}.jsonl`.
