---
paths:
  - "src/chatbot/**"
  - "html/chatbot.html"
  - "src/others/AppWindowToolsComp.tsx"
  - "src/others/AppAssistantComp.tsx"
  - "src/helper/ai/aiCautionHelpers.ts"
  - "src/helper/ai/aiKeyFocusHelpers.ts"
---

# Chatbot window

The 🤖 help window — `html/chatbot.html` → `src/chatbot/*` — and what it draws.
Providers, cost and the model's tool list: `chatbot-llm.md`.

- **Three things every window carries**: `AppWindowToolsComp`
  (`src/others/`) mounts `PresentingControlComp`, `AppAssistantComp` and
  `KeyboardShortcutsComp` (Help → Keyboard Shortcuts, memory
  `keyboard-shortcuts-panel`) on all
  ten renderer entries — presenter, reader, appDocumentEditor, bibleNote,
  setting, webEditor, lwShare, lyricEditor, experiment, screen-mirror — and
  deliberately NOT on
  `about`, `chatbot`, `finder`, `markdownPreview` or `screen` (an overlay or a
  help window on the projector is the one place they must never appear; the
  markdown preview is a locked-down reader that never calls `run()`). All draw nothing until
  asked for, so mounting them everywhere costs a menu registration.
  Only three windows have a top bar to hold the 🤖 button, so the way in
  everywhere is `Tools → Start Controlling` / `Ctrl+Shift+P` and
  `Tools → App Assistant` / `Ctrl+Shift+A`; a popup's menu bar is hidden, which
  makes the shortcut the real door. `AppAssistantComp` calls `openChatbotPage()`
  in ITS OWN window so the help lands beside the window the question is about
  and its focus picker starts on the right one.
  The wrapper is a `.app[data-bs-theme]` div with `display: contents` — those
  are the only two things the `--app-*` tokens are declared under, and
  `lwShare`, `lyricEditor` and `experiment` never load `others/main.tsx`, so
  without it the controller paints untokenised. `lyricEditor` gets its own
  `#app-window-tools` container (its body belongs to the Open Lyric dashboard)
  and `experiment` renders from `init()`'s callback so `tran` has a locale.
  **`setAppMenuItems` keeps ONE entry per key**, so a key every window
  contributes is owned by whichever loaded last and every other window's press
  is dropped by its own `getIsWindowFocused()` guard — opening Settings used to
  take _Start Controlling_ away from the presenter. Both pass
  `{ isRoutedToFocusedWindow: true }`, which routes the click to the window in
  front instead; `lang`, `file`, `insert` and `view` keep owner routing on
  purpose.
- **Chatbot**: `html/chatbot.html` → `src/chatbot/*`, opened by the **🤖**
  (`ChatbotButtonComp`, left of Help on the presenter, slide editor and reader
  — the only windows with a top bar), Help → _App Help (Chatbot)_, or
  `AppAssistantComp` (above). The 🤖 STAYS when the master switch is off: the
  press reads the switch and offers Settings → Others, because a vanished
  button explains nothing; the Tools entry withdraws (a menu item cannot
  explain itself). It talks to the MCP host over HTTP (port from
  `main:app:get-ai-endpoints`) and answers from the manual, live app state, and
  by outlining the real control. Each question carries the tab's recent turns
  (`toHistoryTurns`: 6 turns, 2400 chars, oldest dropped, clipped at BOTH ends
  because an answer's last line is the offer a "yes" answers), bounded because
  history rides EVERY round of the loop.
  - **Tabs** persist whole to `local-storage/chatbot-sessions`
    (`chatSessionHelpers.ts`, 12 tabs × 60 messages, debounced save +
    `beforeunload` flush). `⋮` or right-click: rename, **lock**, close, _Close
    other chats…_, _Clear all chats…_ — the last two confirm on a line under
    the strip and `saveChatSessions` at once; a LOCKED tab (`isLocked`) has no
    `×`, is refused by `handleClosingSession`, and both step around it.
  - **The head row belongs to the tab in front**: three `<select>`s — _asking
    about_ (`BOT_FOCUS_LIST`, following the opener window until picked), the
    assistant, the model. Their `aria-label`s must stay distinct (`Which part of the app` / `Which assistant answers` / `Which model answers`) —
    `extra-work/verify-chatbot-e2e.mjs` finds them by label. A keyless
    provider's option TEXT reads `<name> — needs an API key` (Windows draws no
    tooltip on an OS list row) and is PICKABLE (`data-needs-key`, NOT
    `disabled`): picking it keeps the tab's provider and opens Settings →
    Others with the cursor in that key box. The request crosses windows as a
    30-second setting (`src/helper/ai/aiKeyFocusHelpers.ts`), NEVER a URL
    parameter — Settings is found again by URL (`getPopupWindowData`), so a
    parameter opens a duplicate; it is read on mount and on focus via
    `getSettingForce`. An arrow on the closed list steps over the row. Keys are
    re-read on window focus, and **Open AI settings** under a refused key lands
    on its box too. **That panel folds** (2026-10-10, `useSettingSectionFold`:
    the section, each provider's box, Custom servers, each server), and a
    folded part is NOT mounted — so the request is the panel's `openToken`:
    whatever is folded in front of the box opens, each on its own mount, and a
    request for the panel alone (`keyName: null`) is kept for that reason. A
    fold by hand forgets the request (`onCollapse`), or the box would take the
    cursor back on every reopening. `chatbot-llm-provider` / `chatbot-llm-model-<provider>`
    only seed a NEW tab. Three models per provider (speed + list price on
    hover) plus _More models…_ (the account's `models.list`); a non-reasoning
    OpenAI model gets no `reasoning_effort`.
  - **The head folds to ONE line, by hand** (2026-10-09, the user's ask with a
    picture of the head circled: _make the area collapsible_;
    `headCollapseHelpers.ts`). The arrow in the slim rail at the head's left
    edge (`.chat-head-fold` — ONE button in both states, so the keyboard
    stays on it and it is pressed again where it was just pressed) folds the
    pickers, the limit and the credit line to `<window> · <assistant> ·
    <model>` (`genHeadSummary`, the pickers' own chosen words) plus the spend
    guard's corner (`describeSpendFolded`: the figure, else the cap; never
    ellipsised, amber when near or paused — **Allow more** is behind the fold
    then). The whole line opens it again. Remembered for the WINDOW
    (`chatbot-head-collapsed`), not the tab, and open on a fresh install.
    Folded, the pickers are UNMOUNTED: a script that reads or sets them opens
    the head first, in an evaluation of its own because the selects exist
    only once React has rendered the press (`extra-work/verify-chatbot-e2e.mjs`
    does). The rail is 14px and the body's right padding 10px — the 24px the
    head's two 12px sides took; at the 412px the window opens at, a rail that
    cost the row ten pixels pushed MODEL off the first line.
  - **Providers are declared ONCE, in `LLM_PROVIDER_MAP`**
    (`Record<LlmProviderType, …>` lookups and a `keyField`; ternaries once sent
    an unknown provider to OpenAI silently): Claude, ChatGPT, **Kimi**,
    **Bedrock**, **Free**. The four OpenAI-shaped ones share one loop through
    `OpenAiCompatProviderType` (client, label, `genRequestExtra`, optional model
    filter, optional round cap, `isOneToolCallPerTurn`). `kimiHelpers.ts` is the
    OpenAI SDK at `https://api.moonshot.ai/v1`; every Kimi model thinks, so all
    get the 6000-token budget, `reasoning_effort` goes only to `kimi-k3` (K2
    rejects it and takes `thinking`), and its catalogue gets no filter (OpenAI's
    pattern returns nothing). **Bedrock** (2026-10-09, memory
    `bedrock-llm-provider`) is the OpenAI SDK at
    `https://bedrock-mantle.<region>.api.aws/openai/v1` with an `ABSK…` key as
    the bearer: nine models from three vendors (GPT-5.6 Terra first, Palmyra
    Vision 7B left out — 4K context), a CLOSED list like Free's (no _More
    models…_: `/openai/v1/models` is 404), each with `regions`, request rules told
    apart by the id's vendor prefix, and `findModelProblem` refusing a model
    the chosen region does not serve before a round is paid for. The region is
    a plaintext setting off the closed `BEDROCK_REGION_LIST` (us-west-2 first —
    the only one serving all nine), each one named in `html/chatbot.html`'s
    `connect-src`, a test holding the two together. `chatSessionHelpers` keeps
    its own `Record<LlmProviderType, true>` so it need not import the SDKs.
  - **Custom servers** (2026-10-09, memory `custom-llm-servers`): the user's
    own OpenAI-compatible servers (LM Studio, Ollama, any URL), added in
    Settings → Others → **Custom servers** with a name, a base URL, an
    optional key and a model list (id + shown name; **Test** and **Load
    models from server** read `/models`). ONE provider key `custom`, shown
    as ONE ROW PER SERVER (`genAssistantRows`), a model id
    `<serverId>/<rowId>` decoded to the row's model at the request
    (`toWireModel`). Every call goes renderer → IPC → the MAIN-process relay
    (`electron/customLlmRelayHelpers.ts`), which forwards only to the saved
    address, only `GET /models` and `POST /chat/completions`, with the key
    read in main — the chatbot CSP is NOT widened and a custom key never
    enters the window. Never stands in or is stood in for; this computer AND
    the church's own network (`checkIsLocalNetworkUrl`) are priced at $0; a
    failure says its own sentence (`CustomServerError`). Measured against
    the user's LM Studio box the same day: the fixed request is ~13 400
    tokens, so a model LOADED under 16k is refused before a round and every
    sentence asks for 32k; a machine that goes to sleep mid-question is
    caught by the relay asking `/models` on a second connection every 20 s
    (`lost` after two failed connections — a slow list is a busy server);
    LM Studio's own `/api/v0/models` (root of a `/v1` address only) is read
    by Settings' Test / Load — loaded, context, and **Sees pictures**
    (`canSeeImages` on the row, the only way a custom model gets pictures)
    — and by the chatbot before each ask, 1.5 s cap, for the too-small
    refusal and a round-1 line _Waiting for <server> to load <model>_.
    **Generic since 2026-10-10** (the user's ask, with Ollama failing:
    _make the custom assistant work generically … work with most popular
    llm server like lmstudio ollama_; memory `custom-llm-servers`): the
    server's KIND is read off its root and never stored
    (`readCustomServerModelInfo` → `lm-studio` / `ollama` — `/api/tags` +
    `/api/ps`, `vision` ticks the box — / `llama-cpp` — `/props`, one
    `commonInfo` for every row — / `other`: LocalAI, Jan, GPT4All, vLLM,
    SGLang, a LiteLLM proxy, which get the protocol alone); Settings' Test
    corrects an address one path off through the relay's `probeBaseUrl`
    (same origin, `GET /models` only — Ollama typed as `…/v1/systemone`
    had every call answered with a 404 page the chat read as _not
    available to the account_); a 404 is read as _no model called …_ or
    _nothing speaks the OpenAI API at …_; a refusal written in vLLM's or a
    FastAPI shape is rewrapped as `{error: …}` for the SDK
    (`toReadableErrorText`); _does not support tools_, `--jinja` and
    `--tool-call-parser` each get their fix sentence; and every context
    sentence speaks in the program's words (LM Studio's load dialog, the
    Ollama app's Settings → Context length, `llama-server -c`).
  - **Free needs no key** (`src/helper/ai/freeHelpers.ts`): Kilo Code
    (`api.kilo.ai`), three `:free` models each proven through the real tool
    loop (a test holds ids to `:free`; an unsuffixed Kilo id is paid and
    refuses anonymous calls). LLM7 went paid 2026-09-12; `kilo-auto/free` /
    `openrouter/free` are left out on purpose. `toUsableLlmModel` puts a
    keyless model name the list no longer carries back on the first choice (at
    `getLlmModel`, window load, `askLlmBot`) and leaves a keyed provider's
    off-list pick alone. `keyField` UNSET means always available, and it sits
    LAST in the map so any real key outranks it. Only
    `stepfun/step-3.7-flash:free` sees pictures; _More models…_ is hidden for
    it. Its `warning` (words and attachments leave the machine and may be kept)
    is STICKY atop the log and repeated in Settings while no key is set;
    `warningLinks` come from `FREE_SERVICE_MAP` so both disclosures name the
    same company. Settings must NOT draw them with `RenderOpenPageButtonComp`
    (it `tran()`s label and title, which THROWS in dev). The notice folds to
    its first sentence after ~9s; a fold by hand sticks.
  - **The tool host failing is not the provider failing**: `mcpClient.ts`
    throws `ToolHostError` with a volunteer sentence and `hostStatus` — NOT
    `status`, which `readLlmIssue` reads as a provider 5xx and hands to another
    key. Free-model guards: `toCleanToolName` cuts a leaked `<|channel|>`
    marker out of the function name, `maxToolRounds` 6 (one question once cost
    ~79k tokens for nothing), and a mid-loop 429 buys ONE tools-less salvage
    round that keeps the gathered results. `checkIsReadableReply` drops an
    option with no Latin letter and keeps one naming a translated button.
  - **Every answer ends with things to PRESS**: **Copy**, **Ask again**, and
    options from an `OPTIONS:` line that `parseAnswerOptions`
    (`quickReplyHelpers.ts`) always strips (own line or inline at the end);
    failing that, the answer's trailing yes/no or either-or question, then the
    nearest corpus questions (`genFollowUpQuestions`). LAST message only,
    never duplicating an action button, both rows capped at 5.
    **Walkthrough** buttons (`genGuideActions`) walk the recipe the model
    SETTLED on: `applyToolWatch` prefers the last `owa_help_page` opened, lets
    a later search overwrite an earlier one, and offers nothing once the model
    started its own card — `runBotAction` presses those args before any model
    sees them, so a stale first-search id is pressed, not reviewed.
  - **Stop ABORTS on the wire**: Ask becomes Stop, Escape too (not while the
    caret is in a field). One `AbortSignal` per ask (`cancelHelpers.ts`) runs
    through `askLlmBot` into both providers' requests and every `callTool`
    fetch, and is checked before each round. Say it AT THE PRESS and never as a
    failure — `describeLlmError` reads an abort as an unreachable service, and
    the offline bot would answer a question the user called off. A tool that
    already clicked is not undone.
  - **Each TAB works on its own** (2026-10-09, the user's ask: _while one
    working another should be able to do different things_). Busy is a set of
    tab ids (`busySessionIds`, from the pending asks' `sessionId`s plus
    `busyHoldListRef` for an unstoppable song write); `isBusy` is the tab in
    front's, so another tab keeps Ask, its own progress and no Stop. Progress
    lines are per tab (`progressHelpers` keyed by session id, an entry deleted
    when cleared), and Stop / Escape stop the tab in front only. **Three
    points of colour while ANY tab works** (the user's ask, with a picture):
    a steady dot after the busy tab's name, `🟠 ` in front of the window title
    (the taskbar shows it), and an amber point on the 🤖 in every top-bar
    window — told through main (`chatbotBusyHelpers.ts`,
    `all:app:chatbot-busy` → `main:app:chatbot-busy`, cleared when the help
    window is destroyed). The 🤖 ASKS on mount asynchronously: a synchronous
    ask froze every window the one time main had no handler for it (a dev
    renderer hot-reloaded ahead of its main process).
  - With no key at all the window says so and offers Settings → Others; a
    failed call falls back to the offline manual bot. Written for a
    non-technical volunteer, English-only: no ids, no paths, manual pages only;
    `owa_guide_*` walks a task with a numbered card in the app window.
  - **A step the card cannot press asks the model**: `owa-guide-help` (card) →
    `all:app:guide-help` (`domHelpers`) → `askGuideHelp` (main) → the chat
    window, which answers onto the CARD the same way (it stays minimised during
    a walkthrough). Once per step per run, 30s wait, `unavailable` when nothing
    listens. The model is held to `DO: <instruction>`, parsed in code — told
    only not to narrate, small models still did. `owa_guide_status` reports
    it as `help`.
  - **A walkthrough minimises the chatbot window; closing the card restores
    it.** An injected expression cannot import app modules, so the runtime
    fires `owa-guide-running`, relayed by `src/helper/domHelpers.ts` as
    `all:app:guide-running` to `setGuideRunning` (`electron/electronHelpers.ts`),
    which acts only on a window OVER the guided one and undoes only its own
    doing. **macOS** (`EC-180`): the window is an `appTopToMain` CHILD, AppKit
    cannot miniaturise a child alone (electron#26031, #39578), and
    `minimize()` docked the presenter instead. `detachFromParentWhileMinimised`
    calls `setParentWindow(null)` first and rejoins on the window's own
    `restore` EVENT — Electron attaches only a VISIBLE window to its parent.
- **A question can carry more than words**: a file or an image from the
  paperclip, a paste, a drop, a **📷** picture of the app window, or a
  control the user POINTED at. `src/chatbot/attachmentHelpers.ts` is the one
  place that holds them, and its rule is that the bytes are NEVER persisted:
  `chatbot-sessions` is read whole and synchronously at startup, so a message
  keeps the DESCRIPTION (`ChatAttachmentType` — name, kind, size, an element's
  selector) and the picture lives in a bounded in-memory map that dies with the
  window; a reopened tab shows the chip greyed. `toValidAttachments` LISTS the
  fields it copies rather than spreading, so a hand-edited file cannot smuggle
  a `dataUrl` back in. Images are cut to a 1024px long edge — the provider
  charges by DIMENSIONS, so re-encoding without resizing saves bytes and not one
  token, and the first user message is re-sent on every one of up to ten rounds.
  PNG unless that comes back photo-sized: the subject is small text and thin
  borders, which is what JPEG rings around. They ride the FINAL user turn only
  (images before the text for Anthropic, `image_url` data URLs for
  OpenAI/Kimi — Moonshot refuses a public http image), and NEVER the history,
  which carries `(with a picture attached)` instead. `checkCanSeeImages` refuses
  a blind model BEFORE the call and offers one that is not, because a 400 there
  reads as an unreachable service. **A picture with an empty box is still a
  question**, and has to be sent as one: only a file or a pointed-at control
  contributes words, so an image-only ask composed to `''` and went out as an
  empty text block, which Anthropic refuses outright — read back, by the same
  `describeLlmError`, as the provider being down, under the offline bot's
  greeting. `toAskedOfModel` is the one place that decides what the model is
  asked; `askLlmBot` refuses to post an empty ask at all; and the TRANSCRIPT is
  never built from either, because words a user did not type must not be drawn
  as theirs. The assistant can ASK to be shown, with a
  `NEEDS: screenshot|element|file` frame that `parseAttachRequests` strips
  unconditionally, exactly like `OPTIONS:`.
- **A question already in flight can be added to.** The box is no longer
  disabled while an answer comes; **Add** appears beside Stop once there are
  words in it. `askLlmBot` takes a `takeAdditions` pull callback that the round
  loop drains ONLY where the next model call is guaranteed — after the tool
  results are pushed, which is reachable only when the model called a tool, and
  it can only do that while tools are still being sent. For Anthropic the
  addition is a trailing TEXT block inside the same tool-result user message
  (tool_result blocks first, text after — that ordering is the documented
  shape); for OpenAI/Kimi it is an ordinary user message after the `tool` legs.
  Whatever the loop never took is asked as its own question with a note saying
  so, and a Stop puts everything typed back in the box rather than dropping it.
- **The ask box is a textarea, and Report sits under Ask.** The box grows with
  what is typed in it (an effect on the draft, `height:auto` then `scrollHeight`
  plus the measured borders — Bootstrap's `border-box` makes a naive write two
  pixels short and it scrolls for good) up to a CSS ceiling of eight lines.
  **Ctrl+Enter asks; plain Enter is a new line** — the one exception being a
  suggestion the arrows have walked to, which Enter takes, and the FORM decides
  which of ask / Add / take-the-suggestion it was, so there is still one place
  that decides. The arrows stop belonging to the suggestion list the moment the
  draft holds a newline: a caret that cannot get back to the line being fixed is
  worse than a list that needs the mouse.
- **Tab finishes the word, the arrows bring their row with them, and the list
  closes when it has nothing left to offer** (2026-10-10, the user's three
  asks, with pictures of `/bt` over a `/btw` row and of `/btw what is` still
  offering `/btw`: _tab key should auto select the suggestion_, _up/down arrow
  should move selection_, _should close suggestion when user type more extra,
  or already in input text_). **Tab** takes the row the arrows walked to, or
  the FIRST when none was, and it FILLS and never asks
  (`handleChoosingSuggestion(row, true)`), whatever the row: Enter on a
  walked-to row and a click still run a no-argument command on the press, but
  a key that defaults to the first row must not be what empties the projector
  (`/clear`, Tab). With a modifier, an
  IME composing, a draft that holds a newline, or no list up, Tab is still the
  way out of the box to the buttons. No row is highlighted by default, on
  purpose: a highlighted row is what makes plain Enter take a suggestion
  instead of starting a new line, and the list must never rewrite a question
  under them. **The arrows did work and looked dead**: the list scrolls (`/`
  alone offers more than fit) and opens on its first row, so ↑ from the box —
  which wraps to the LAST row, the one nearest the box — lit a row out of
  view; `RenderSuggestionsComp` now scrolls the active row in (`nearest`,
  which moves nothing while it is already visible). **Closing** is two pure
  functions with tests: `matchBuiltinActions` offers nothing once whitespace
  follows the name (the words have started) and never offers back a NAME typed
  in full — a longer one starting with it stays (`/screen` leaves
  `/screen-show`, `/screen-hide`), and an ALIAS in full keeps its row, because
  that row is what says `/clear` means `/clear-all`; `checkIsAlreadyTyped`
  (`questionHelpers.ts`) drops a question row the box already starts with.
- **Nothing in the chatbot window auto-hides, and that is a decision**
  (2026-09-11). The head row and the ask form were made to tuck away while
  the conversation scrolled, at the user's ask with a picture (2026-09-10,
  `EC-160`); the box was wanted back the same afternoon and the rest —
  the head band, its grip strip, the 📌, `autoHideHelpers.ts` — the next
  morning: _please remove all auto-hide feature from the chatbot_. A
  control that has to be found again before it can be pressed is a control
  in the way, in a window used minutes before a service. Do not reintroduce
  a hide-on-scroll, hide-on-idle or collapse of any row there without being
  asked in so many words. **The one fold there is was asked for in so many
  words** (2026-10-09, the head — _make the area collapsible_, above): it
  happens when its arrow is pressed and at no other time, stays the way it
  was left, and what it leaves on screen still says what every picker is set
  to. It is not a licence for a second one, nor for this one to start
  folding by itself.
- **The window carries TWO warnings and they are about different things**
  (2026-09-12, `EC-174`, the user's own ask). `RenderProviderWarningComp`
  (`.chat-warn`) is about where the user's words GO — true of the keyless
  provider only, sticky, foldable, riding the whole conversation. The
  standing caution under the starter chips (`.chat-caution`) is about
  whether the answer is RIGHT — true of every provider including a paid
  one. It names what going wrong looks like HERE (misreading the app,
  describing a button that is not there, quoting a verse inaccurately, and
  offering a press that reaches a live projector) and closes on
  over-reliance, because generic "AI can make mistakes" boilerplate is read
  once and never believed. It lives in the EMPTY STATE deliberately: read
  before the first question, gone by itself once one is asked, so it costs a
  conversation nothing and needs no dismiss button to mislearn — which is
  how it stays clear of the auto-hide decision above. Do not merge the two,
  make this one sticky, or give it a dismiss.
- **Opening either AI window asks the caution FIRST** (2026-09-12, `EC-175`,
  the user's own ask, both icons circled in a picture). `askAiCaution`
  (`src/helper/ai/aiCautionHelpers.ts`) is ONE confirm — _Be careful with AI_,
  **Cancel** / **Open** — in front of every user-initiated route into the 🤖
  and the ✨: the two toolbar buttons, the two Tools entries (Ctrl+Shift+A
  included) and the two native Help items, which land on the IPC receivers in
  `domHelpers`. A caution a menu item walks around is a caution nobody is
  given. Two of its three sentences are shared and one is NOT, because the
  risks differ: the assistant reads THIS app and can offer a press that
  reaches a live projector, the ✨ is a stranger's website where the words
  leave the machine and nothing knows about this app — one warning vague
  enough to cover both warns about neither. **It FAILS OPEN**, deliberately:
  `showAppConfirm` answers `false` when the window mounts no popup host, which
  is indistinguishable from Cancel, and `lwShare` and `lyricEditor` have none
  while still carrying the assistant on Ctrl+Shift+A (only `reader`,
  `AppLayoutComp`, `PopupLayoutComp` and `setting` mount `HandleAlertComp`) —
  failing closed there would make the shortcut silently do nothing, which
  reads as a broken app rather than as a warning. On the 🤖 the master switch
  is asked BEFORE the caution: there is nothing to be careful about in a
  window that is not going to open. The Presenting Control's _hand this
  snapshot to the help window_ is NOT gated — that press carries its own
  intent, and a Cancel would strand the snapshot the main process is holding.
  Its four strings need Khmer keys like any other label outside
  `src/chatbot/`; a missing one THROWS in dev.
  For automated chatbot verification, this caution remains person-only by
  default. A narrow exception applies only when `owa_app_state` confirms a
  development instance and the user explicitly authorizes acceptance in the
  current conversation: automation may press this caution's exact **Open**
  button through the development CDP endpoint. A generic “continue” is not
  consent. The exception never applies to packaged/production instances,
  **Allow more**, projector or destructive confirmations, or any other blocking
  dialog, and it is not a reason to weaken the MCP firewall.
- **The wait says what it is DOING** (`src/chatbot/progressHelpers.ts`). One
  unchanging `Looking it up…` line for the ~55 seconds a question takes when it
  reads a web page, drafts a song and creates it cannot tell a window that is
  working from one that has hung, so the only strategy it teaches is to press
  Stop. The loop now REPORTS: `AskExtraType.onProgress` is pushed (not pulled
  like `takeAdditions` — the whole value is timing), `runMcpTool` opens a step
  before the call and closes it in a `finally`, and both provider loops do the
  same around every model round. Three rules. The phrase is written for a
  volunteer and NEVER derived from the tool name — `describeToolStep` maps all
  29 model-visible tools by hand and an unmapped one falls back to
  `Looking something up`, with a test that fails on an underscore reaching the
  line. It says what it is working ON (`Searching the guide for “background”`,
  `Reading example.com` — the site, not the query string —
  `Creating a new song: “Amazing Grace”`), arguments flattened and cut at 38
  characters because a pasted song is a legitimate argument. And FINISHED steps
  stay above the running one, dimmed, only one dot ever breathing: a single
  replacing line answers "is it alive?" where the person deciding whether to
  press Stop is asking "is it getting anywhere?". Last 5 kept, the rest counted
  (`3 earlier steps`), never dropped in silence. Ids come from a MODULE-level
  counter — one question makes two reporters (the connect, then the loop) and a
  finish is matched to its start by id, so per-reporter counters both starting
  at zero put round 1 on top of the connect line instead of after it. It rides
  its own store rather than the window's state: the line sits under the
  conversation, and a twenty-step question would otherwise re-render the whole
  message list twenty times.
- **The four starter chips are not the corpus** — `More… — everything it can
answer` under them opens all of it for that window (184 in the Presenter),
  grouped by SECTION label, which is a panel of the app, merged across pages so
  two `Screens` headings do not show the filing through. `getAllQuestions` in
  `questionHelpers.ts`; `RenderAllQuestionsComp` mounts only once pressed, so a
  window nobody opens it in never reads the corpus for it. The press handler is
  SHARED with the chips (`handlePickingQuestion`) because the rule they share is
  the one easy to lose on a second copy: a `template` row fills the box instead
  of being asked, or the assistant goes off and reads `example.com`.
- **Alt+↑ walks back through what has been asked**
  (`src/chatbot/askHistoryHelpers.ts`), and **one 💡 line above the box says what
  the window can do** (`tipHelpers.ts`). Both exist for the same reason: the
  window is used by somebody standing in a back room minutes before a service,
  where retyping a question that was nearly right is the expensive part and a
  feature nobody announces is a feature nobody has. The history is ONE list for
  the whole window, not one per tab — a second tab is opened precisely because
  the first went wrong, so the question wanted back is rarely in the tab it was
  typed in — capped three ways (30 entries, 2000 characters each, 20 000 in
  total) because `appLocalStorage` is a synchronous write, and **seeded from the
  saved conversations the first time**, since the only way to discover Alt+↑ is
  to press it and get something back. Only what came out of the BOX is recorded:
  a starter chip and a quick-reply press are not, or the walk goes past three
  presses of _Yes_ to reach the sentence worth keeping. Index -1 is the user's
  own half-written words, held aside on the way in and handed back at the bottom
  of the walk; typing resets it to -1 and switching tabs does too. **Alt**, not
  the bare arrows, which already belong to the caret in a multi-line box and to
  the suggestion list. The caret is moved to the END of what came back, out of
  the same effect that sizes the box (one flag, one subscription) — a recall
  that lands the caret at character zero starts every correction with a press of
  End. The tip is drawn RANDOM and never the same one twice running (the last id
  is remembered in `chatbot-tip-shown`), pressing it gives another, and pressing
  it puts the caret straight back in the box. **The two chevrons at the end of
  the row WALK it** (`stepChatTip`, wrapping both ways) — two different
  questions, both kept: pressing the sentence is "show me another", the arrows
  are the only way to see them all and the only way BACK to one that changed
  while it was half-read. All three paths remember what they showed
  (`rememberChatTip`; `genChatTip` stays pure so the choosing is testable with
  no setting store), and `+ count` before the modulo is load-bearing — `%` keeps
  the sign, so stepping back off the first tip indexes at -1. The arrows are
  drawn at half opacity rather than revealed on hover, deliberately: this line
  exists because a feature nobody announces is a feature nobody has, and hiding
  its own controls is that mistake one level down.
- **A line starting with `/` is a COMMAND, and no model ever sees it**
  (2026-09-02, `src/chatbot/builtinActionHelpers.ts`). Measured on the standing
  corpus the afternoon three of the four providers answered 429 within an hour:
  a paid model spent two rounds and nine seconds saying nothing was showing, and
  the offline bot every failure fell through to said the same and offered no way
  to change it (4 of 12 right). `/screen`, `/screen-show`, `/screen-hide`,
  `/clear-all` … `/clear-foreground`, `/find <words>`, `/goto <page>`,
  `/here`, `/help <words>` and `/commands` run through the app's own MCP
  tools from `handleAsking` BEFORE any provider is chosen — no key, no history,
  no attachment, ~1.6 s — and typing `/` lists them in the suggestion list
  (`SuggestRowType` is the one shape questions and commands share; a command
  with no argument asks on the press, one with an argument fills the box;
  Tab fills either — see _Tab finishes the word_ above).
  Three rules: a command reports what CHANGED (the screens are read back before
  AND after the press — `EC-76`'s lesson); typing it IS the consent, so the
  offered-never-done rule for the congregation's screen does not apply, but a
  MODEL cannot fire one because the button's `BUILTIN_TOOL_NAME` is a pseudo
  tool the server never registers, caught in `handleActing` like the report's
  Send; and a tool's own error text never reaches the user. `BUILTIN_TOOL_NAME`
  is declared in `helpBotHelpers` (the offline bot offers _Turn the screen on_
  under "nothing is showing", and the command module imports that one). The
  same research fixed two offline-bot defects: `TASK_QUESTION_PATTERN` keeps a
  how-do-I that mentions the screen away from the state answer, and the focus is
  a FILTER of `owa_help_search`, no longer a query word — "presenter" is in the
  overview page's TITLE and outranked the real answer 83 to 42. **Driving that
  window over CDP from Git Bash: `/screen` in an argument is rewritten to
  `C:/Program Files/Git/screen`** unless `MSYS_NO_PATHCONV=1` is set — three
  paid calls answered "that looks like a file path" before that was noticed.
  **`/lyric <address>` writes a song from a page with no model** (2026-09-10;
  also `/lyrics`, `/hymn`, `/new-song` — `/song` was already `/selected`'s
  alias, so the app's own noun for a song file won): the drafter reads the
  page itself (`owa_lyric_validate` with `url`, rationed and announced by the
  firewall) and the answer is the same report, preview box and **Create "…"
  / Copy song text** buttons the model's answer carries, nothing written
  until Create is pressed; `/lyric` over pasted words drafts those. The same
  words in prose — _Create a lyric file from https://…_, the starter chip —
  are drafted by the offline bot too (`readSongLinkAsk`: a song word beside
  exactly one https address in a short message → `answerLyricLink`, before
  the paste check), where measured with the assistant paused they were
  searched for in the manual and answered with how to make an EMPTY file.
  A page with no song, a refused read and a site's bot check each get a
  sentence of their own (`EC-123`).
  **`/btw <words>` is the ONE slash line that goes to a model** (2026-10-10,
  the user's ask: _add command `/btw` to let assistant know it about asking
  general question, e.g. `/btw "what is holy bible"`_; memory
  `chatbot-builtin-commands`). `readGeneralQuestion` reads the words (quotes
  off) and `handleAsking` takes the ordinary model road with
  `AskExtraType.isGeneral`: the words plus a frame in the USER turn
  (`toGeneralQuestionAsk` — never the cached system prompt), ONE round, NO
  tools (the MCP session is not opened: no _Connecting to the app_ step,
  no tool schemas), no known-question hint, no reader-button shortcut, the
  transcript showing what was typed. With no assistant, or one that fails,
  the answer says a general question needs an assistant and offers **Open
  AI settings** — the guide never answers it. The bare `/btw` runs as a
  command and says how; `/commands` names it as the exception.
- **Report** (`src/chatbot/reportHelpers.ts`) is for when the app itself is
  wrong. Two presses: the first only ASKS, quoting what will be reported (with
  an empty box, the LAST question asked), cleared by a keystroke. Confirmed, it
  takes a picture BEFORE investigating, reads the build, window, screens and
  console itself — trimmed, since `owa_app_state` carries the data directory
  and dev component names — then asks the model through `askLlmBot` DIRECTLY,
  not `handleAsking` (which would add "show me step by step" under a bug). The
  answer is a `REPORT:`/`TITLE:`/`STEPS:` frame parsed like `OPTIONS:`; no
  frame is not an error. **Nothing is sent by that**: the report waits on
  **Send report**, held in a bounded in-memory map (the message stores only
  the reference). No tracker exists yet — `ISSUE_TRACKER_ENDPOINT` is the
  seam; while it is null the window SAYS nothing was sent and saves
  `OWA-<date>-<id>.md` + `.png` into Downloads with chips that open them. Send
  is caught in `handleActing` by `REPORT_SEND_TOOL_NAME`, which the server never
  registers, so nothing outside the window can file in the user's name. **It
  says WHO wants it** (`EC-176`): the address is read off the LIVE help page
  through `main:app:read-web-page` (`findContactEmail` in
  `src/server/appHelpers.ts`, parsed from the rendered text), the package
  `author` only as fallback. It offers a `[Open Worship app] <title> (<reference>)` subject and **Copy report** / **Copy subject** / **Copy
  picture** (PNG via `copyImageToClipboard`) / **Copy email address** /
  **Email it** (a `mailto:` with address and subject only; the report goes to
  the clipboard first, since mail clients cut a body at ~2 000 characters) —
  pseudo tools carrying ONLY the reference. The address is found at the press,
  and **Copy report** falls back to the saved file after a reopen. The saved
  document opens with **How to send this** and carries the address source,
  machine, selection, run sheet, screen contents, displays and who
  investigated.
- **The Presenting Control takes a snapshot** (`ControllerToolbarComp`, in the
  history group that survives collapsing) of the app WITH the drawing on it, and
  offers three things to do with it: hand it to the help window, copy it, or
  save it into the Background Images folder so it can be presented. It is one
  IPC — `main:app:capture-window` → `captureWindowImage` → `capturePage` on the
  window's own web contents, which is why the chatbot popup sitting on top of
  the app never appears in a picture of the app. The same IPC serves the
  chatbot's own 📷 and `owa_screenshot`. A snapshot bound for the chat window is
  HELD in the main process (`sendChatAttachment` / `takeChatAttachment`, exactly
  one) because the same press also opens that window, and a renderer still
  loading has nobody listening.
- **Every chip is pressable, and every ASSET opens** (2026-09-12, the user's
  ask: _as a user I want to always be able to download assets in chat
  session_). A pointed-at control is RUNG where it lives
  (`owa_highlight_selector`, by the stored selector rather than by its words —
  half the labels in this app are on more than one control); everything else —
  a picture, a dropped file, the report just written, the song just created —
  opens the SAME full-window preview, which is where **Download** lives.
  Before, a file chip opened a file-manager window BEHIND the app, so the only
  asset a volunteer could look at was a picture and the only way to keep one
  was to go hunting in Explorer. `assetPreviewHelpers.ts` owns it, and its
  three rules are the app's own: **nothing is read until it is opened** and
  nothing held after it closes (the preview is state on one component, not a
  map); **size is asked before content** (`fsGetFileSize` first — a picture
  over 8 MB and a text file over 512 KB are named and measured on a card
  instead, never read); and **Download means a copy in Downloads and says
  where** (`fsCopyFilePathToPath`, or the app's own `downloadImageBase64Data`
  for a picture the window holds, or a free name for words with no file
  behind them) — with a file ALREADY in Downloads revealed rather than
  duplicated, because pressing it twice must not leave two. What is text is
  decided by NAME or by words the window already holds, never by `kind`:
  every file an answer offers arrives typed `text`, video and PDF included.
  The chip's NAME comes from `labelPartsOf`, not `describe`'s joined `label`:
  joined, the settings button reads "Setting Setting".
- **An ANSWER can carry materials too.** A `SHOWS:` frame -- `SHOWS: <control
name> | file:<path>` -- is stripped by `parseAnswerShows` exactly like the
  other two and drawn as the same chips: pressing a control name rings it
  through `owa_find_ui` AT PRESS TIME (against the window as it is now, not as
  it was when the answer was written), and a path opens its folder or, for a
  picture, the preview. A selector never becomes the words on a chip. The
  preview carries **Copy** and **Save a copy** (`downloadImageBase64Data`, the
  app's own save-and-reveal), so a picture worth opening is a picture the user
  can keep. **And every picture chip carries a copy icon** (2026-09-12, the
  user's ask: _for all images preview in chatbot should have icon to copy
  image to clipboard_): `RenderCopyPictureIconComp`, drawn on an image chip
  whose bytes are still in the window, in the ask row and under answers alike,
  stops the press so it does not also open the preview or ring a control, and
  goes through `copyImageToClipboard` in `attachmentHelpers.ts` — the one
  clipboard path the preview's Copy and the report's **Copy picture** share,
  which redraws anything that is not PNG because Chromium's async clipboard
  takes no other image type.

- **A Bible is installed IN the chat, one question at a time, by buttons and
  with no model** (2026-10-06, `src/chatbot/bibleImportChatHelpers.ts`; asked
  for _for old and non-technical users_ — it used to open Settings with the
  link typed in, leaving four fields nobody had heard of). Three ways in, all
  caught in `handleAsking` ahead of any provider, like a `/` command: a
  message with a Bible word and ONE link (`readBibleImportLinkAsk` — a file, a
  GitHub file page, a repository); a Bible word with NO link
  (`readBibleImportLanguageAsk`: _Import bible for khmer_ searches the Beblia
  collection, _Import bible_ / _Can you install a Bible for me?_ asks the
  language, _…from my computer_ opens the Settings form; a how/what/where
  question is left to the guide); and Settings → Bible's
  **[en:tran:Let the assistant import a Bible for me]**, which leaves the request
  through `chatbotHandoffStoreHelpers.ts` (one setting, taken once, 30 s) after
  the 🤖's own two questions, and the window starts it in a NEW tab when it opens
  or comes to the front. Every answer is one step — the language, every file in
  it with the title its own file gives, then a short name, the language, the
  digits, the book names (ranked by how many of their names the verses use,
  each with the names only it has), **Install it**, **Undo** — and every button
  is `BIBLE_IMPORT_STEP_TOOL_NAME`, a pseudo tool no model can press, carrying
  the WHOLE state in its args, so the window keeps nothing and an old button
  restarts its own step. A typed word answers the step in front of the person
  (`readBibleImportTypedReply`: their own short name, a language by name, a word
  that narrows a list — added to the earlier search, "2019" after "Khmer"), read
  off the LAST answer only, and a NEW request beats it. A tool's words never
  reach the person: a `problem` code is worded here with how to find the right
  link. A model that downloads a Bible itself gets the same buttons under its
  answer (`watch.bibleImportCheck` in `llmBotHelpers.ts`). The Settings-form
  prefill (`bibleImportRequestHelpers.ts`) is what **Do it in Settings instead**
  and **A file on this computer** use.
