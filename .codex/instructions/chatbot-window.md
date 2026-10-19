---
paths:
  - 'src/chatbot/**'
  - 'html/chatbot.html'
  - 'src/others/AppWindowToolsComp.tsx'
  - 'src/others/AppAssistantComp.tsx'
  - 'src/helper/ai/aiCautionHelpers.ts'
  - 'src/helper/ai/aiKeyFocusHelpers.ts'
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
  — the only windows with a top bar), Help → _App Help (Chatbot)_, the Help
  button's own **[en:tran:Open Chatbot]** (2026-10-12, the user's ask: the
  **?** opens a two-row menu, **[en:tran:Open Online Help]** over it, instead
  of going straight to the website; it runs the 🤖's own press,
  `openChatbotOnPress`, so the switch and the caution are asked there too),
  or `AppAssistantComp` (above — which since the same day also answers Help →
  **[en:tran:Open Online Help]**, the menu's first row, through
  `src/server/onlineHelpHelpers.ts`, a leaf module both ways in share), and
  — on Windows — the taskbar icon's **Tasks → App Help (Chatbot)**
  (2026-10-15, the user's ask: _so I can find help_ with the app minimised;
  `OPEN_CHATBOT_ARG` in `electron/taskbarHelpers.ts`). A jump list task
  can only start the program again, so the running app hears it through
  `second-instance`, brings the main window up and sends a message of its
  own, `main:app:open-chatbot-from-taskbar`, which opens the window with
  NO caution (the user's word the same day: _open from taskbar no need
  confirmation_); with the app closed, `initLaunchTask` waits for the main
  window's first load. Listed only with the master switch on, like the Help
  item. **The taskbar identity follows the DATA FOLDER**
  (`toAppUserModelId`): the jump list belongs to the identity and the last
  process to set it wins, so a dev copy on a scratch profile, started after
  the user's, had pointed the list at itself and the user's press opened a
  new window on the scratch folder. The default folder keeps the shared id,
  its `-dev` twin `.dev` (also for the environment-less copy a task click
  starts), any other folder an id of its own. The 🤖
  STAYS when the master switch is off: the
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
    assistant, the model. **Which WINDOW the tab works in is NOT in the head**:
    it is **Working in**, a line of its own right ABOVE THE BOX, drawn only
    while the app has a second window open (2026-10-15, the user's ask:
    _chatbot work with main window only … Let add window selection (if more
    child window), after window change the chatbot should work with the
    selected window_; moved out of the head the same day at the user's word,
    the line over the box circled — _add the selection where I highlighted_ —
    with the story _ask about some stuff on app-document editor page … select
    the editor window and start interacting with it_; `RenderWindowAimRowComp`,
    `windowAimHelpers.ts`, `aria-label` `Which window`, which the question
    corpus finds it by). It sits over the 📷 and the ◎ because both work in
    it: the 📷 goes through `owa_screenshot` (`callToolPicture` — only a tool
    aims by window id), which, given a page, asks `main:app:capture-window`
    for `isOwnWindow`, the asking page's own window (until then every aimed
    picture, the model's included, was of the main window); the ◎ says which
    window to point in. A brass bar marks the line while a window of its own
    is chosen. **A 📷 picture and a ◎ control KEEP the window they were
    taken in** (the user, the same day: _make sure screenshot and element
    selection have uuid information to the window to let mcp know_):
    `ChatAttachmentType.window` — its DevTools id, its page WITH the popup
    `uuid` (`setting.html?uuid=setting`), its name, whether it is the main
    window — persisted with the message (`toValidAttachmentWindow` lists the
    four fields). The model's legend says which window each one is in and the
    `page` its tools reach it by NOW (`toAttachmentWindowPage`: the id while
    that window is open; after a relaunch the main window's new id, or a
    popup by its page and `uuid`) — the stored words (`summary`, the history
    note) carry the window's NAME only, never a launch-bound id. A pointed-at
    chip is rung in its own window whichever the tab works in now (aim
    `null`, an explicit `page`), and its hover names the window. Local Web Share is loaded by main with no `uuid` and is never
    the main window (`checkIsMainWindowUrl`). _Asking about_ names a
    KIND, and every tool aims by a piece of an address — the first window it
    fits wins — while two Reader windows are both `reader.html?uuid=reader`.
    So a window is aimed at by its DevTools target id: main lists the windows
    over its own debugging port (`electron/appWindowListHelpers.ts`,
    `main:app:list-app-windows`, asked on mount, on focus, as the list
    opens, and whenever main SAYS a window came, went or changed — never on
    a timer (2026-10-15, the user, Settings opened with the help up and not
    in its list: _it should real-time tracking the new opening_;
    `initAppWindowListWatch`: every app window that loads a listed page,
    changes its title or closes raises one `main:app:app-windows-changed`
    to the help windows only, a burst settled for 300 ms, nothing sent with
    no help window open, watched only with AI on; a test holds its page list
    to `botFocus.mjs`'s windows. An app whose MAIN process started before
    that code lists nothing and draws no line until it is relaunched, which
    is how the user first saw it missing — memory
    `main-process-change-needs-relaunch`),
    `pickTarget` takes the id as `page`, and
    `callTool` swaps it in (`toAimedToolArgs`) for a UI tool given no page
    or the bare kind — never for a page asked for on purpose, never for the
    data tools. The tab in front's choice is module state for the short calls
    (a `/` command, the guide, a button); a model's answer carries the one it
    was asked with (`AskExtraType.windowAim` → `ToolWatchType.windowAim`),
    because it can outlast a tab switch. Per tab, in memory only: an id is
    good for one launch. Choosing one sets _asking about_ to its kind; the
    main window is no aim at all (the old way). With one chosen, the prompt
    calls a Reader or Editor window "a window of its own" (no
    `owa_goto_page`, no **Go Back to Presenter**), `/here` names it and the
    main window apart, and a state read of it raises no **Go to the
    Presenter** (`needsPage`), which it always would. Their `aria-label`s must stay distinct (`Which part of the app` / `Which assistant answers` / `Which model answers`) —
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
    only seed a NEW tab. Three models each for Claude, ChatGPT and Kimi (speed + list price on
    hover) plus _More models…_ (the account's `models.list`); a non-reasoning
    OpenAI model gets no `reasoning_effort`.
  - **The assistant list ends in Auto, and a tab on it STAYS on it**
    (2026-10-12, the user's ask with the space under **Free** circled; the
    choosing is in `chatbot-llm.md`). `AUTO_ASSISTANT_VALUE` (`::auto::`) is an
    `<option>` drawn after the rows, not a row of `genAssistantRows` — it is
    no provider and no server, always able to answer and last, so no arrow has
    to step over it. **Auto is the default** (2026-10-13, the user's ask
    with the row circled: _make `Auto` be selected by default_;
    `toIsLlmAuto`): a new tab starts on it while `chatbot-llm-auto` was
    never written, and a named pick writes `false` — but a provider
    stored with nothing in that setting is a pick made before Auto
    existed, and stands. Picking it sets `isAuto` on the tab (and
    `chatbot-llm-auto` for the next new tab) with NOTHING asked of any
    server: a pick in a list must not be a wait. Where the model picker
    stood, **AUTO PICK** (`RenderAutoPickComp`, plain text — a disabled list
    is greyed past reading, and `verify-chatbot-e2e.mjs` already takes a
    missing model list) reads _chosen at each question_ until a question has
    been put, then `autoPick`, who answered last; the folded head reads
    `<window> · Auto · <who>`. A named row ends Auto and drops both fields.
    The image check is skipped at the press (Auto picks among the models
    that see) and the custom-server shortcuts follow the tab's last pick.
    **An Auto tab carries its own notice** (`AUTO_ASSISTANT_WARNING`, through
    `RenderProviderWarningComp`'s `isAuto`): the keyless service is always
    one Auto may ask, so the trade is said BEFORE the first question, and it
    names the service in its first sentence — all a folded notice shows. Its
    subject is Auto, not the provider underneath, or it would unfold itself
    at every pick.
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
    **Bedrock**, **Custom servers** (below), **Free**. The five OpenAI-shaped ones share one loop through
    `OpenAiCompatProviderType` (client, label, `genRequestExtra`, optional model
    filter, optional round cap, `checkIsOneToolCallPerTurn`). `kimiHelpers.ts` is the
    OpenAI SDK at `https://api.moonshot.ai/v1`; every Kimi model thinks, so all
    get the 6000-token budget, `reasoning_effort` goes only to `kimi-k3` (K2
    rejects it and takes `thinking`), and its catalogue gets no filter (OpenAI's
    pattern returns nothing). **Bedrock** (2026-10-09, memory
    `bedrock-llm-provider`) is the OpenAI SDK at
    `https://bedrock-mantle.<region>.api.aws/openai/v1` with an `ABSK…` key as
    the bearer: nine OpenAI-shaped models from three vendors (Palmyra Vision
    7B left out — 4K context), a CLOSED list like Free's (no _More models…_:
    `/openai/v1/models` is 404), each with `regions`, request rules told apart
    by the id's vendor prefix, and `findModelProblem` refusing a model the
    chosen region does not serve before a round is paid for. **Plus Claude
    Haiku 5.5, FIRST in the list** (2026-10-11, the user's ask after the
    research in `extra-work/local-llm/aws-bedrock-info.md`; labelled _Claude
    Haiku 5.5 (best recommended)_ at the user's word): AWS serves every Claude
    model on the Anthropic Messages API, never on Chat Completions, and
    outside GovCloud serves the current ones on the `bedrock-runtime` host
    only as cross-region ids — so that row is `global.anthropic.claude-haiku-5-5`
    on the Anthropic SDK at `https://bedrock-runtime.<region>.amazonaws.com/anthropic`
    with the same key (`bedrockClaudeHelpers.ts`), riding the ANTHROPIC loop
    with its two cache markers (`askAnthropicCompatible` takes an
    `AnthropicCompatProviderType`; the runtime map tells the two Bedrock
    shapes apart by `BEDROCK_CLAUDE_PATTERN`). $0.10/$0.50 per million, cache
    read $0.01: about a third of a cent for a three-round question. The region
    is a plaintext setting off the closed `BEDROCK_REGION_LIST` (us-west-2
    first — the only one serving every OpenAI-shaped row; the Global Claude id
    is served from all four), each one named TWICE in `html/chatbot.html`'s
    `connect-src` — the Mantle host and the runtime host — a test holding the
    three together. `chatSessionHelpers` keeps its own
    `Record<LlmProviderType, true>` so it need not import the SDKs.
  - **Custom servers** (2026-10-09, memory `custom-llm-servers`): the user's
    own OpenAI-compatible servers (LM Studio, Ollama, any URL), added in
    Settings → Others → **Custom servers** with a name, a base URL, an
    optional key and a model list (id + shown name; **Test** and **Load
    models from server** read `/models`). ONE provider key `custom`, shown
    as ONE ROW PER SERVER (`genAssistantRows`), a model id
    `<serverId>/<rowId>` decoded to the row's model at the request
    (`toWireModel`). Every call goes renderer → IPC → the MAIN-process relay
    (`electron/customLlmRelayHelpers.ts`), which forwards only to the saved
    address — or, since 2026-10-10, to a server of the SHARED REGISTRY
    (`electron/llmRegistryHelpers.ts`, `docs/llm-registry/README.md`:
    `https://www.openworship.app/llm/info.json`, read by main at launch and
    on the chatbot's ↻ beside the Assistant picker, its servers offered as
    `registry-<id>` rows with their keys and addresses held in main (a
    window holds a stand-in address, 2026-10-12), `isFree` pricing them
    at $0; a failed read keeps the last good list and says why on the
    button's tooltip) — only `GET /models`, the four root reads below and `POST /chat/completions`, with
    the key read in main — the chatbot CSP is NOT widened and a custom key
    never enters the window. Never stands in or is stood in for; this computer AND
    the church's own network (`checkIsLocalNetworkUrl`) are priced at $0; a
    failure says its own sentence (`CustomServerError`). Measured against
    the user's LM Studio box the same day: the fixed request is ~13 400
    tokens, so a model LOADED under 16k is refused before a round and every
    sentence asks for 32k; a machine that goes to sleep mid-question is
    caught by the relay asking `/models` on a second connection every 20 s
    (`lost` after two failed connections — a slow list is a busy server);
    LM Studio's own `/api/v0/models` (root of a `/v1` or a bare address,
    never under a longer path) is read by Settings' Test / Load — loaded, context, and **Sees pictures**
    (`canSeeImages` on the row, the only way a custom model gets pictures)
    — and by the chatbot before each ask, 5 s cap, for the too-small
    refusal and a round-1 line _Waiting for <server> to load <model>_.
    **Generic since 2026-10-10** (the user's ask, with Ollama failing:
    _make the custom assistant work generically … work with most popular
    llm server like lmstudio ollama_; memory `custom-llm-servers`): the
    server's KIND is read off its root and never stored
    (`readCustomServerModelInfo` → `lm-studio` / `ollama` — `/api/tags` +
    `/api/ps`, `vision` ticks the box — / `llama-cpp` — `/props`, one
    `commonInfo` for every row, or, for a ROUTER (`role: "router"`,
    b11540+), each model's loaded state and `--ctx-size` off `/models`
    (`toLlamaCppRouterModelInfoMap`, 2026-10-10) — / `other`: LocalAI, Jan, GPT4All, vLLM,
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
    `nvidia/nemotron-3.5-super-vl:free` sees pictures (2026-10-16: the gateway
    withdrew Step Flash and Nex Pro, two rows of three, and the list was
    re-qualified through the window; Free has its own `FREE_MAX_TOKENS` 6 000
    because the new models think out of the cap); _More models…_ is hidden for
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
    round that keeps the gathered results. `checkIsReadableReply` keeps an
    option with a Latin letter (one naming a translated button is English)
    or written in a language somebody CHOSE -- the answer's own, or the app's
    (`checkIsChosenScript`) -- and drops a script neither uses (`请确认…`
    under an English answer); its match key reads every script, or a Khmer
    option was a duplicate of nothing.
  - **Every answer ends with things to PRESS**: **Copy**, **Ask again**, and
    options from an `OPTIONS:` line that `parseAnswerOptions`
    (`quickReplyHelpers.ts`) always strips (own line or inline at the end);
    failing that, the answer's trailing yes/no or either-or question, then the
    nearest corpus questions (`genFollowUpQuestions`). LAST message only,
    never duplicating an action button, both rows capped at 5. An option
    loses the quote marks a model put round it, and two things are not
    options at all (`toReplyList`, 2026-10-12, a local model's chips): one
    that says there is none (_No options available_, drawn as a button
    under a state answer) and a decline with nothing beside it to decline
    (_No thanks_ alone — a round spent on being told nothing was wanted).
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
  - With no key at all the window opens on the Free assistant (above), whose
    sticky notice offers Settings → Others; a failed call falls back to the
    offline manual bot. Written for a
    non-technical volunteer, in the language the app is SHOWN in: no ids, no
    paths, manual pages only; `owa_guide_*` walks a task with a numbered card
    in the app window.
  - **It answers in their language** (2026-10-16, the user's ask: _if app in
    Khmer then the chatbot have to be ready for khmer language_, _this is for
    church elderly user_, _chatbot have to be localization friendly_; memory
    `chatbot-follows-app-language`). The app language is the window's own
    `<html lang>` (`getAppLangCode`, `chatLangHelpers.ts`); what a question
    is in, `pickReplyLanguage`: what they TYPED, else the app's -- a "yes", a
    command and anything PRESSED (`handleAsking`'s `isPressed`: a starter
    chip, an option, a suggestion row, an action's ask, a card rescue) are
    the app's words. Every language is DATA in
    `src/lang/data/<code>/assistant.json`: its script, digits, words for yes
    and no (the offline bot's follow-ups take them), the yes/no chip words and
    how such a question is asked (`genQuickReplies`), walkthrough-echo words,
    the markers a model translates (`ជម្រើស:` for `OPTIONS:` -- every frame
    parser reads them) and a glossary for the search. No code names Khmer.
  - **Behind the scenes it works in English, unless the model is a Gemma 4**
    (2026-10-17, the user's ask: _for khmer, behind the scene it should
    translate all khmer to english to work with llm or post directly to llm
    if it is gemma 4 family … make sure to make it generic_, and _use gemma 4
    as sub assistant_; `chatTranslateHelpers.ts`, pure, every rule a test).
    For an answer in a language other than English (`pickReplyLanguage`), a
    Gemma 4 model (`TRANSLATION_MODEL_PATTERN`) is asked in that language
    and answers in it, as before. Any OTHER model is asked in ENGLISH: what
    they typed is put into English, the ask goes out under the English
    prompt with no language line (`appLang`/`replyLang` `en`), and the
    answer, its options riding along on an `OPTIONS:` line, is put into
    their language before it is drawn. The translating is a SUB-assistant:
    a Gemma 4 model Auto would ask at no cost (`findTranslationPick`, the
    same look as the verse finder's), one round with no tools each way
    (`AskExtraType.isTranslation` — `TRANSLATION_SYSTEM_PROMPT`, and 4 000
    tokens on a server of the user's own). Its rounds count in the cost and
    never as who answered (`onHelperUsage`). Per question, not per
    assistant: Auto trying three asks for the English once. A button named
    in English in **bold** is written in the screen's words from the app's
    dictionary first (`toBoldLabelsShown`), and the translator keeps bold
    words as they are. With no Gemma 4 to translate, or when a translation
    fails, the model is asked in their language directly; an answer that
    could not be put into it is shown in English under one sentence saying
    so. Not for a verse being looked for (it has its own English head start
    and names verses a translation would reword), and an answer the app
    wrote itself, already in their language, is left alone. A pressed chip
    asks its row's ENGLISH (`StarterQuestionType.textEn`, `echoText` for
    the transcript), so the readers that know only English -- a verse to
    find, a Bible to import, a song link -- and the hint read the corpus's
    own sentence.
  - **The window's own words are in that language too** (the same day, the
    user's picture with ASKING ABOUT, ASSISTANT, CREDIT USED, YOU, Working in,
    the box's placeholder and STOP circled: _make sure to do maximum
    translation for the page as well_). Through the chatbot's OWN `tran`
    (`chatTranHelpers.ts`: `tran`, `tranLabel`, `fillWords`) -- identity
    until `src/chatbot.tsx` plugs in a translator after `init` (the window is
    drawn from `init`'s callback now, the language loaded), pinned to the
    language the window was LOADED in: the app's `tran()` reads the setting on
    every call, and a language clicked in Settings before Apply would have it
    ask for a dictionary this window never loaded. Not `langHelpers`' `tran`:
    that pulls `SettingManager` → `appLocalStorage` → `appProvider` into every
    helper, which a node test cannot load. The AI Chat window plugs the same
    one in (`plugChatWindowLanguage`, `chatWindowLanguage.ts`, called by
    both entries), with the tab strip they share. **Both draw the language
    in its own face** (the user's picture, Khmer in the OS's fallback: _both
    chatbot and ai chat must have translation and have font-family apply_):
    the pack's `fontFamily` goes on `<html>` as `--chat-lang-font`, which
    every `--chat-font-*` stack in `chatWindowShared.scss` carries AFTER
    the window's own faces, so Latin keeps them and Khmer is Battambang.
    The walkthrough card, the ◎ picker's line and the action banner, drawn
    into the app's windows, take the page body's face the same way. Named `tran` so
    `tranKeyCoverage.test.ts` reads every key (Khmer AND French). One rule
    decides where: words CODE reads back -- an action's label
    (`WALKTHROUGH_ACTION_PATTERN`, `DRAFT_ACTION_PATTERN`, `findTypedPress`),
    a thread's marker -- stay English in what is stored and are translated
    where drawn (`tranLabel`; `chatTranLabels.test.ts` holds those words,
    which no static sweep can read); words nothing reads back are translated
    when written. Whole sentences with `{gaps}`, never a phrase stitched from
    pieces (`progressHelpers` was rewritten so). What goes to a MODEL --
    prompts, hints, tool arguments, a report's body for the maintainers --
    stays English. A saved conversation keeps the language it was written in.
    **Measured, not assumed** (2026-10-17, the user's goal: _work with
    Khmer language, 99% coverage_): `node extra-work/chatbot-language-coverage.mjs`
    drives the RUNNING dev app's help window through 24 states that need no
    assistant -- the empty window, the folded head, a tab's menu, More…, the
    suggestion lists, Report's first press, the `/` commands, the guide's own
    answers, the verse finder's and the Bible import's first steps -- plus
    the ✨ window (its bar, Recently closed, the chooser, the sign-out
    question), each in a tab the run opens and closes itself (it refuses to
    run without one: it once closed a person's site tab through a second
    `.chat-tab-add`). Every visible string, title, aria-label, placeholder
    and picker option is IN THE LANGUAGE, NEUTRAL (names, keys, links, a
    Bible's own key and title, decoration) or NOT; a person's words and an
    assistant's are left out. Khmer read 98.6% first, 99.6% once the
    fill-in questions were translated (the two strings left were server
    names the user typed); French 97.1% before its manual was translated.
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
  a `dataUrl` back in. **Every attachment carries a NUMBER** (2026-10-13,
  the user, with a picture of four chips all named _my screen_: _attachment
  should have id like `1` `2` `3` ... so user can mention in the text_):
  `numberAttachments` gives each the tab's next — one past the highest on any
  message of the tab or still in its box — when it is ATTACHED, and it is
  never changed after, because _in 2 the button is missing_ must still mean
  that picture once another chip is taken off (1 · 3, then 4; only the last
  chip's number is free again). It is drawn on the chip
  (`.chat-clip-number`, inked in `--chat-solid` — the panel colour is a 7%
  wash on a glassy window and drew a blank disc), persisted with the
  message, and TOLD to the model: `toAttachmentLegend`, last in
  `toAskedOfModel`, lists each number with what it is, a picture by its
  ORDER among the ones sent, since a model is handed pictures with no names
  on them. `toAttachmentNote` names them (_picture [2]_) in the history, and
  a report's file list says _(attachment 2)_. A chip an answer draws has
  none. Images are cut to a 1024px long edge — the provider
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
- **A PDF is read as its pages, and a file can be asked about question
  after question** (2026-10-17, the user, with a picture of the assistant
  answering _I cannot open PDF files_ under `1CH.0.pdf`: _convert to images
  for pdf pages then send image as attachment_; then, with the Resources
  panel circled: _add robot icon to each file, click to open file in
  chatbot … let user interact to ask question around the content in the
  file_). **Pictures, not the text layer**: a Khmer PDF is as often as not
  set in a legacy font whose text is Latin letters drawn as Khmer, and a
  scan has none. `public/js/pdf-to-chat-images.mjs` (MuPDF, a child process
  per ask through `main:app:pdf-to-chat-pages` → `pdfToChatPages`) draws the
  first EIGHT pages at the 1024px long edge every picture here is cut to,
  PNG unless photo-sized, handed back as data URLs — nothing written to
  disk, nothing cached in main. `genPdfAttachment` (`fileAttachHelpers.ts`)
  holds them beside the PDF's id: the live store holds a LIST per
  attachment (`putAttachmentPages`), so its ceilings count files and a PDF
  is let go of whole. `toBotImages` sends them in order among the other
  pictures, `toAttachmentLegend` counts them with those (_its pages 1 to 3
  are the 2nd to 4th pictures_), and what the model is told of a PDF is
  worked out AT THE ASK (`toFileSummary`): its pages and which were NOT
  shown, or — no pages held, or a model they are not sent to
  (`toAttachmentText(…, isSeeing)`) — that it cannot be opened. `pageCount`
  is persisted; the pages are not. The 5 MB cap is the report's alone now.
  **A file stays open in its tab** (`findOpenFileAttachments`): the files
  of the LAST question that had one (a file from disk — never a 📷 picture
  or a pointed-at control, which were of the app as it WAS) go to the model
  with every later question until another file is attached or the ×
  of the **Still asking about** line above the box is pressed
  (`ChatSessionType.fileClosedAt`), read again from disk when the window
  has let them go (`reloadFileAttachment`). Only to the model: the
  transcript keeps the question as asked. An empty box with only files is
  `FILE_ONLY_QUESTION` (say what it is, ask what they want), not "help with
  whatever looks wrong". **The Resources panel's 🤖**
  (`ResourcesFileRowComp`, `.app-resources-file-ask`, beside the ⋮ and in
  its menu, only while AI is on and only on `checkCanAttachFileName` — a
  picture, PDF, `.own` or text kind, never a `.docx` or a video) leaves a
  `chatbot-handoff-file` request (`requestChatbotFile`, a whole path, 30 s)
  through `openChatbotWithFile` — the two questions first — and the window
  attaches it in a tab of its own with a brief description and four questions
  to press. **Read** first gives a two-sentence content description, then asks
  for one verse with an example (`1`) and `1`, `2`, `3` / **Full chapter**
  buttons. Each card renders exactly one verse: that verse is pre-read from
  the installed Bible through `owa_lookup_record`, the PDF's narrow reference
  column supplies up to two clickable cross-references, and the matching
  explanation paragraphs come from the commentary below the rule. Full first
  discovers the chapter's final verse, then automatically asks for each verse
  in order as an isolated request/card; the next three verse buttons stop at
  the real chapter end even when a small model writes no valid `OPTIONS:` line.
  `owa_resource_file` returns every PDF page as a picture by default, with
  explicit coverage fields; its embedded text layer is withheld because a
  legacy font can decode into convincing but unrelated characters. Dense pages are
  read at the tool's 2048px high detail, and the unchanged result is reused
  from a bounded OS-temp disk cache between verse cards; the picture
  is the only PDF wording supplied to the model. A repeated-word detector
  rejects a degenerate visual answer and falls back to the exact installed-
  Bible verse instead of displaying invented commentary; raw two/three-letter
  OCR guesses are not offered as cross-reference buttons. A Resources-PDF caution recommends
  reading the Bible and PDF personally; its **Hide for 30 days** uses the same
  timed AI-caution setting as the rest of this window.
  **A Bible note is its words** (`noteFileTextHelpers.ts`): the editor's
  JSON tree walked to headings, lines and list items, a pasted picture as
  `[picture]`, then each marked verse with its highlights and comments —
  sent as it was, the 16 KB cut was the start of a base64 photograph. In
  a narrow panel the row's _Introduction_ tag goes (a container query on
  the row) so the name keeps its room beside the 🤖. **And the rest of
  Resources is the model's to read** (the same day, the user: _let chatbot
  know it is from `Resources`, let chatbot access all in `Resources` …
  like followup other chapter (look into other pdf files)_): a question
  asked while a file inside a Resources folder is open in the tab --
  attached now or still open, however it was attached
  (`findResourceFileNames`, the folder list read fresh) -- is a
  `resources` ask (`resourcesChatHelpers.ts`), shaped like the Lookup
  panel's: the ask names the file as the tool does (`toResourcesAsk`,
  `pdf/LUK.6.pdf`, never a whole path -- a folder's path carries the
  account name), `RESOURCES_SYSTEM_PROMPT` (what Resources is, `LUK.6`
  is Luke 6 and `LUK.0` its introduction, answer from the pages and say
  which file and page), `owa_resource_file` as its on-ask tool plus shared
  `owa_lookup_record` for exact cited passages and `owa_read_website`, five rounds, no
  walkthrough or app hints (`isAppQuestion` is false), and Auto told it
  needs a model that sees. Verified live 2026-10-17 on gemma4:cloud, in
  Khmer: a tab opened on `GEN.4.links.json` asked _what does the file for
  Luke chapter 7 say?_ listed Luke 7, read `pdf/LUK.7.pdf` (the waiting
  lines say both) and answered with its themes by page.
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
  that row is what says `/clear-all` means `/screen-clear-all`; `checkIsAlreadyTyped`
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
  how it stays clear of the auto-hide decision above. Do not merge the two
  or make this one sticky. **Both can be put away for 30 days** (2026-10-10,
  the user's ask with both circled: _it's annoying for some users, let put
  any button to hide it for a while, e.g. hide for 30 days_): a box on the
  opening confirm (`AiCautionBodyComp`, written only on **Open** — ticked
  and cancelled hides nothing) and a **Hide for 30 days** button on this
  one, both writing ONE key, `ai-caution-hidden-until`, in the browser’s `localStorage` — not a setting file (a time;
  `aiCautionHelpers.ts` reads it fresh at each open, the chat window once at
  mount), because somebody who has read one has read the warning; the day
  comes round and both are back — 30 days rather than a "never" box on
  purpose. Not a dismiss for good, and not auto-hide.
- **Opening either AI window asks the caution FIRST** (2026-09-12, `EC-175`,
  the user's own ask, both icons circled in a picture). `askAiCaution`
  (`src/helper/ai/aiCautionHelpers.ts`) is ONE confirm — _Be careful with AI_,
  **Cancel** / **Open** — in front of every user-initiated route into the 🤖
  and the ✨: the two toolbar buttons, the Help button's
  **[en:tran:Open Chatbot]**, the two Tools entries (Ctrl+Shift+A
  included) and the two native Help items, which land on the IPC receivers in
  `domHelpers`. A caution a menu item walks around is a caution nobody is
  given. **One route skips it, by the user's word**: the Windows taskbar's
  **App Help (Chatbot)** (2026-10-15, _open from taskbar no need
  confirmation_) — do not add the caution back there. One of its three sentences is shared and two — the risk and the closing advice — are NOT, because the
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
  Its five strings need Khmer keys like any other label outside
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
  volunteer and NEVER derived from the tool name — `describeToolStep` maps every
  model-visible tool by hand and an unmapped one falls back to
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
answer` under them opens all of it for that window (302 in the Presenter on 2026-10-11),
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
  its own controls is that mistake one level down. **The ✕ after the arrows
  puts the line away for 30 days** (2026-10-15, the user's ask with the row
  circled: _add option to hide it for 30 day_): `chatbot-tip-hidden-until`,
  a setting like the daily tips' own, not believed when set further off than
  60 days, back by itself — the same 30 days as the two cautions.
  **`/tips` brings it back before then** (2026-10-17, the user's ask with
  `/tips` typed in the box: _add `/tips` to open tips again_; also
  `/tip`, `/show-tips`): the hide is forgotten (`showChatTips`), the line
  is told at once by a window event (`CHAT_TIPS_SHOWN_EVENT` — it read the
  setting when it was drawn), and the answer says where the line is and
  gives one tip.
- **A line starting with `/` is a COMMAND, and no model ever sees it**
  (2026-09-02, `src/chatbot/builtinActionHelpers.ts`). Measured on the standing
  corpus the afternoon three of the four providers answered 429 within an hour:
  a paid model spent two rounds and nine seconds saying nothing was showing, and
  the offline bot every failure fell through to said the same and offered no way
  to change it (4 of 12 right). `/screen`, `/screen-show`, `/screen-hide`,
  `/screen-clear-all` … `/screen-clear-foreground` (2026-10-10, the user's
  ask: the clears carry the screen's prefix, the old `/clear-all` spellings
  stay as aliases, and `/clear` alone empties the tab in front — the WINDOW's
  own, done before any message is written, a locked tab refused the way its ×
  is), `/find <words>`, `/goto <page>`,
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
  (`toGeneralQuestionAsk`) under a short system prompt of its own
  (`GENERAL_SYSTEM_PROMPT`, ~60 tokens, its own cached prefix) instead of
  the app's ~5 000-token one, ONE round, NO tools (the MCP session is not
  opened: no _Connecting to the app_ step, no tool schemas), no
  known-question hint, no reader-button shortcut, not refused by a custom
  server's 16k context rule (a local model at Ollama's default 4k holds it
  — measured 2026-10-10 on the user's qwen3.5:4b), the transcript showing
  what was typed. With no assistant, or one that fails,
  the answer says a general question needs an assistant and offers **Open
  AI settings** — the guide never answers it. The bare `/btw` runs as a
  command and says how; `/commands` names it as the exception.
  **A plain follow-up under it stays general** (2026-10-10, the user's ask
  with a picture of _in khmer please_ answered as an app question at 10.2k
  tokens: _the follow up prompt should inherit command from previous_):
  `readInheritedGeneralQuestion` reads the tab's last question — typed with
  `/btw`, or carrying `isGeneral` on the message, so a chain holds and
  survives a reopen — and any `/` line ends it. The prompt tells the model
  to say _type `/btw` before it_ when asked something outside the app or how
  to ask one, and a 💡 tip says the same. **Commands are offered where they
  work** (`COMMAND_PAGE_MAP`, `checkIsCommandOnPage`): the Presenter's own —
  screen show / hide / clears, `/selected`, `/run`, `/next`, `/previous`,
  `/slide`, `/verse`, `/countdown`, `/marquee`, `/marquee-top` — are listed only while the tab asks
  about the Presenter and are refused elsewhere with **Go to the Presenter**;
  `/commands` names them on one line there; the rest work everywhere (a
  Reader command would be filed `['reader', 'presenter']`). **`/slide <n |
  words>`** presents one slide of the selected song by its card's own
  `find` (`presentSlideAndReport`, shared with `/next`); and **on a custom
  server two asks in words skip the model** (EC-206, EC-210 — a 4B model
  offered Clear All for "turn off the screen" with every screen off, and a
  9B ran six rounds on "show verse 1 on screen"): `readScreenToggleAsk` →
  `answerScreenToggleAsk` (the screens' state plus the ONE button that does
  it, never a Clear) and `readSlideShowAsk` → `answerSlideShowAsk` (the
  slide named, **Put "…" on the screen** running `/slide N`; a sentence
  naming no slide of the song — a passage — falls through to the model).
  **And a third, 2026-10-13** (`readSlideStepAsk` → `answerSlideStepAsk`,
  tried before the slide-by-words reader or _the next slide_ is looked up
  as a slide of that name): _Show the next slide?_ / _show the previous
  slide_ name the slide `selectedDocument.next` / `.previous` point at and
  offer the same one button — asked of the model at temperature 0, it
  pressed **Slide 1** itself, said nothing of it and told the volunteer
  to click **Slide 2**, every time.
  **And a fourth, the same day** (`readWhereIsAsk` → `answerWhereIsAsk`):
  _Where is the button for Clear All_ — the list's own fill-in, finished
  — is answered by the guide's own `answerWhereIs`, the control outlined,
  with no model round. Only when the window has a control CALLED that on
  show (a tier-0 match, or the ONE control the words fit: **Clear All
  [F6]**), and never for a question the list has a PAGE for:
  `findKnownQuestion` takes every where-is for the fill-in's own row by
  its phrase, so the test is the row's `recipe`, not the row. Asked of
  the model it was four rounds, 42 500 tokens and _in the header section
  of the Presenter window_; the button is in the Mini Screen panel.
- **Report** (`src/chatbot/reportHelpers.ts`) is for when the app itself is
  wrong. Two presses: the first only ASKS, quoting what will be reported (with
  an empty box, the LAST question asked), cleared by a keystroke. Confirmed, it
  takes a picture BEFORE investigating, reads the build, window, screens and
  console itself — trimmed, since `owa_app_state` carried the data directory
  and dev component names until 2026-09-09 — **the console from the MAIN
  process** (`main:app:recent-console`, `electron/consoleLogHelpers.ts`: the
  last forty errors and warnings of each of the app's own windows, heard
  since the window was made, a repeated line counted once, Electron's
  dev-mode security banner left out — and the `bible-note` package's
  _profiling the playground app … debug view_ advice, which sent the model
  of the user's second inbox report (2026-10-15) after a setting this app
  does not have — through the firewall's `redactSecrets`
  before it leaves main and `toPathScrubbed` in the window). Until
  2026-10-13 it asked the tool host's `list_console_messages` with no page
  named, which that tool has refused since `chrome-devtools-mcp` 1.8 — the
  error was swallowed and EVERY report said _Nothing was logged_; it was
  found in the first report a person sent, about an uncaught error. That
  tool could not have had the line anyway when the error is what opens the
  help window: it hears a page from when its own session starts — then asks the model through `askLlmBot` DIRECTLY,
  not `handleAsking` (which would add "show me step by step" under a bug). The
  answer is a `REPORT:`/`TITLE:`/`STEPS:` frame parsed like `OPTIONS:`; no
  frame is not an error. **Nothing is sent by that**: the report waits on
  **Send report**, held in a bounded in-memory map (the message stores only
  the reference). **Send posts it when the shared registry names a server
  that takes reports** (2026-10-13, the user's ask: _a shared server can be
  type accepting report … collect information and prepare as a prompt (raw
  text) then post to the endpoint_; `chatbot-llm.md`): the report's text
  (`genReportPrompt` — a few lines saying what it is and which parts to
  trust, then the report fenced as DATA, without **How to send this**) goes
  to main over `LLM_REPORT_POST_CHANNEL` and from there to that server. The
  window names no address and is told none; the wait is a stoppable pending
  ask with a _Sending the report_ line. **Its FILES go with it** (the same
  day: _accept json … and accept files like markdown pdf_):
  `gatherReportFiles` runs at the press — the picture of the app, then
  everything attached to the report (`readReportThreadAttachments`: every
  `REPORT_NOTE` message of the thread, so a report written again keeps the
  picture that came with the first words). A picture comes from the
  window's own memory; a text file and a PDF are READ OFF THE DISK there and
  then, size asked first, and held no longer than the sending. Each file
  either goes or is NOTED with why (too large, not a kind a report carries,
  no longer there), and `genReportPromptWithFiles` writes the copy that
  says so — `report.prompt` is the words-only copy, which is also what goes
  again, by itself, when a server answers _too large_. The prepared card
  names the files before the press. `describePostedReport` is the one place
  the outcome is worded: **Sent** only when a server took it — with the
  names of the files that went and of any that did not — otherwise that
  nothing was sent — and why, when a server refused — with the email route.
  A report main KEPT because its server was away (`queued`, see
  `chatbot-llm.md`) is said as such — _I kept it, and the app will send it
  by itself as soon as that server is back … nothing more you need to do_ —
  never as _nothing was sent_ (`PostedReportType.isQueued`).
  **Stop while it is sending** says nothing at the press: `sendReportPrompt`
  gives main two seconds to say what became of the post, and the tab then
  reads _Stopped. The report was not sent_ or _It had already gone when you
  pressed Stop_ — never _stopped_ over a report that was filed.
  Either way it saves
  `OWA-<date>-<id>.md` + `.png` into Downloads with chips that open them.
  **Three ways in** (same day): **Report** under Ask; the Help button's
  third row and the native Help menu's **[en:tran:Report a Problem]**; and
  the question an uncaught error asks before the reload one
  (`offerErrorReporting` in `src/helper/errorReportOfferHelpers.ts`, a
  module of its own so a test holds what the press does -- no automation
  may answer that confirm -- once in ten minutes,
  titled **[en:tran:Something Went Wrong]**). The last two leave a 30-second
  request (`requestChatbotReport`) after the 🤖's own two questions, and the
  window opens a tab on an OFFER card (`genReportOffer`) whose **Report**
  button (`REPORT_START_TOOL_NAME`, a pseudo tool) is the press that lets
  it look. **Every place that asks says what a report carries**
  (`REPORT_COLLECTS_TEXT`: app version and build, system information, window
  and selection, screens, the console log, the end of the conversation, a
  picture) — the user's asks: _let user aware console log also collected_,
  _system and app information also collected_. **A tab that is reporting
  KEEPS reporting** (`readReportThread`, the user's words with a picture of
  their own report gone wrong: _I'm trying to report but it's hard_, _chatbot
  should keep knowing that user try to share information_ — they had typed
  under the card and pressed **Ask**, and it was answered as a question):
  from the offer card or a first press of Report until Send report is
  pressed, `handleAsking` hands whatever is typed or attached to the report
  (a line starting with a slash is still a command), more of it is ADDED —
  the complaint is everything said for it (`genReportComplaint`), the
  transcript shows only what was just typed — the box's attachments go with
  it (pictures shown to a model that sees, a text file's words and a
  pointed-at control's lines folded in after the complaint, every one of
  them SENT with the report), and the
  tab is called **Report: …** (`genChatSessionTitle`, the three marks in the
  leaf `reportMarks.ts`). A report still being WRITTEN counts too (a
  `REPORT_NOTE` message with no card yet), and words typed then are not a
  question either: **Add** stops the write-up and starts it again with them
  (`handleAdding`, the pending ask's `kind: 'report'`) — handed on as an
  ordinary addition they were answered by the assistant and left out of the
  report. **Helping comes before reporting** (the user, the same day: _some
  problem is not issue, it is user problem so before helping user to report
  let try to help user to resolve it first_): the investigation is asked to
  say first whether it is something the person can put right themselves, a
  fault or a wish, and a `TRY THIS:` marker in front of `REPORT:` becomes
  `report.fix` — the answer is then `genFixCard` (_Try this first_, the
  steps, **That fixed it** / **Still a problem — report it**) with the
  report written and held back. **STEPS are only what somebody saw**
  (2026-10-15): the first report a person sent — an uncaught error,
  nothing said of what led to it — came back with three made-up steps
  (open the Presenter, the Documents tab, select a song), so the frame
  asks for what the person said they did or the model saw happen, and
  `unknown` with what was on screen otherwise. **The frame is read in the
  markdown a model dresses it in** (the same day, the user's own inbox
  report: a free model wrote `**REPORT**` alone on a line and
  `**TRY THIS:**`, neither was seen, and the whole answer went out as one
  block under the person's words for a title): a bold or heading marker
  needs no colon when nothing follows it, a field may be bold or bulleted,
  a closing `---` and line-end spaces come off; a sentence that merely
  starts with _Report_ is not a frame, and the words a bold marker carried
  inside it (`**TRY THIS: steps you can try yourself**`) are its heading,
  not a step. Fixed closes the thread
  (`REPORT_RESOLVED_NOTE`, nothing sent); Still puts up the prepared card,
  whose report says what they were told to try. A typed _yes, thanks_ or
  _no_ under that card is its own button (`readFixReply`, short answers
  only — anything that says more IS more for the report). **A PDF can be
  attached** (`kind: 'file'`, `genFileAttachment`): the model is shown its
  pages as pictures (see _A PDF is read as its pages_ below) and it rides
  along for the report to send from its path. **A home folder
  loses the account's name** in the console lines and in the error an offer
  card names (`toPathScrubbed`, a leaf `fileHelpers` re-exports), and a
  turn of the conversation is quoted cut at 2 000 characters. The prepared card carries
  **Copy report** beside Send, so the whole text can be read BEFORE it
  goes. Send
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
  the app never appears in a picture of the app. **It is asked up to four
  times** (2026-10-13, `CAPTURE_WAIT_LIST_MILLISECONDS`): a window that has
  just loaded or RELOADED — what a window does after the error somebody is
  about to report — or sits behind another has no frame to hand over, and
  `capturePage` rejects with `UnknownVizError` (or answers an empty
  image). Measured on a main window reloaded while covered: the first ask
  failed and the one 100 ms later had the picture, and a live report had
  gone out without its picture for that. `invalidate()` between asks; after
  the fourth it throws a sentence, never the engine's word. The same IPC serves the
  chatbot's own 📷 and `owa_screenshot` — which, given a `page`, sends
  `isOwnWindow` and gets THAT page's window, never the main one. A snapshot bound for the chat window is
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
  it was when the answer was written), and a path opens the same preview
  (**Open folder** is in it). A selector never becomes the words on a chip. The
  preview carries **Copy** and **Download** (`downloadImageBase64Data`, the
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

- **A question about READING the Bible, asked off the Bible Reader, ends
  with the way back** (2026-10-13, the user, with a picture of _how can I
  open bible_ answered with the Presenter's lookup steps: _the elderly user
  might accidentally changed page to presenter … add extra follow up to let
  user know they also should change page to reader as well as extra option
  to open lookup panel_; `src/chatbot/readerRouteHelpers.ts`, pure, every
  rule a test). `checkIsBibleReadingAsk` reads the question — a Bible word
  and a reading word (read, open, find, look up, where…), and NOT a word of
  presenting (screen, projector, slide, congregation…), which is the
  Presenter's own work — and `genReaderRouteAdvice` adds one last paragraph
  to the answer and a **Go to the Bible Reader** button, the window's own
  `/goto reader` (`BUILTIN_TOOL_NAME`: the person's press, no model's),
  whichever assistant wrote the answer and when none did. **It goes by the
  page the main window is on NOW** (`toMainWindowFocus` over one
  `owa_app_state`, asked for such a question only), not by the tab's
  _asking about_: a tab keeps the page it was opened from, and the stray
  press comes after — seen live, a tab opened from the Reader still read
  _Bible Reader_ with the Presenter in front. Offered on the Presenter and
  the Document Editor; never on the Reader, never in a window of its own,
  never twice. The line goes at the END of the answer's text, not in its
  `note`, which is drawn above an answer.

- **A question about what the Bible SAYS is read as one, not searched as an
  app question** (2026-10-16, `EC-199`, `src/chatbot/bibleContentAskHelpers.ts`
  — pure, every rule a test; found in the user's own tabs with their server
  down). Any Bible question shares its nouns with this manual, so the guide
  handed _what bible verse talk about lover your enemy?_ the Resources page
  and _what are names of 7 churches …_ the Bible-import page, far above the
  score floor: 8 of 10 such questions measured. `readBibleContentAsk` tells
  two kinds: a verse asked for by what it says (→ `answerFromManual` answers
  with Bible Find's page, the words to try named, its walkthrough from
  **Find**, no way across to the Presenter) and knowledge about the Bible
  (→ how to ask an assistant, `/btw` written out, **Open AI settings**).
  Never a question with a reference, about the projector, naming a part of
  the app or what is open, nor _who/where was_ (the names lookup answers
  that); a test holds all 438 supported questions out of both. `askHelpBot`
  sends one there ahead of the where-is reader, and `/help` reaches it
  through `answerFromManual` — which is how it is checked live with no
  assistant to fail. (Since the evening of 2026-10-16 a typed VERSE ask goes
  to the verse finder instead -- below -- so the guide's page answers it only
  through `/help`, and the Bible Find line only when no Bible is installed.) Under an ASSISTANT's answer in the Bible Reader,
  `genBibleFindAdvice` adds one line and **Show me Bible Find** unless the
  answer names Bible Find already: a model answers such a question with
  `/btw` from memory and says nothing of the search on the page. And
  **`needsPage` from a state read counts only under a projector, selection
  or running-order question** (`needsPageBy`, `EC-280`): a model checks
  where it is with `owa_app_state`, which off the Presenter always says the
  Presenter is needed, and three Reader answers had lost their walkthrough
  to **Go to the Presenter** under a sentence about the projector.

- **A typed chapter or verse in the Bible Reader is answered from the
  Bible's own material** (2026-10-18; the user's goal: _chatbot will help
  bible reader have more power_, with _show resource files of john chapter
  3_, _what names in Genesis chapter 4_, _open genesis 3:203_;
  `src/chatbot/bibleReaderChatHelpers.ts`). A typed line in a tab whose
  ASKING ABOUT is Bible Reader that names a verse (`3:16`, `៣:១៦`) or a
  chapter word + number (`chapter 4`, `ជំពូក 4`, `chapitre 4`) with a book
  before it -- and not a how-to or the app's own work -- is a
  `bible-reader` ask: the names lookup, the Resources reader and the verse
  reader are offered together (`AskExtraType.bibleReader`), the installed
  Bibles are read once so a Khmer ask is quoted from the Khmer Bible, and
  the answer is marked `isBibleReaderAnswer` so the next plain line ("and
  chapter 5?") stays in the conversation. The cue words are DATA
  (`bibleReaderWords` in `assistant.json`); English reads in code. A
  **Presenter** tab is left alone -- it keeps `owa_present_bible` -- so
  "show John 3:16" on a projector still puts it up. Under a Resources
  answer, a file the assistant READ offers **Ask about …**
  (`genResourceAskActions`, `RESOURCE_ASK_TOOL_NAME`); the press attaches
  that file to the tab (`attachHandedFileRef`, after
  `resolveResourceFileName`). Seen live 2026-10-18 on the dev Reader in
  Khmer: the Resources list by `ref: "យ៉ូហាន 3"`, Genesis 4's people and
  places, and "Genesis 3 has 24 verses" for 3:203.

- **The ask box completes a passage or a name as it is typed** (2026-10-18,
  the user's picture of the lookup conversation whose box held `១` and
  offered nothing: _assistant should help the input ... book auto complete ->
  chapter -> verse_, then _if for location/name then should recommend the
  auto-complete_). `useBibleInputSuggestions` (`ChatbotAppComp.tsx`) calls
  the hidden `owa_bible_suggest` on a **350 ms debounce per window**, for a
  passage box (a Reader tab, or a `lookupAwaits` line) and a name
  (`Who was …`, every language's `nameAsk`, a bare non-Latin name); a bare
  Latin word is only searched against a dataset a lookup panel already holds,
  so nothing fetches the 34MB speculatively. The rows sit first in the one
  suggestion list and are DATA (`isData`: drawn untranslated); choosing one
  **keeps the list open**, because it is one step -- book, then chapter, then
  verse (a chapter's fill ends in a colon). A passage box's rows win over
  the corpus ones, and an awaited passage shows them too. Hidden from the
  model (`MODEL_HIDDEN_TOOL_MAP`), so the model's list and ratchet are
  unchanged. Seen live in Khmer: `យ៉ូ` -> the five books, John -> chapters,
  chapter 3 -> verses, `ម៉ូសេ` -> Moses/Moseroth.

- **Waiting questions accept ordinary words** (2026-10-18, EC-354).
  EC-355: the interpreter also receives the originating tab's recent visible
  conversation, current step, Bible title/summary, short name, selected
  language, digits and source. Current settings override historical answers
  and file detection; selected language means the imported Bible, never the
  interface. Ordinary chat gets the same current-task hint, while history
  retains message notes and choice labels. Context is bounded and contains no
  raw action arguments, draft paths or full Bible. Exact native language names
  resolve locally; a correction at numbers/names/review reloads that language
  and clears stale numbers/name selections. At book-name selection, a bare
  URL runs `names-url` against the supplied site; a sentence around one supplied
  URL uses the interpreter's `acceptsLink` context. Both retain the draft and
  selected locale. Multiple proposed URLs need clarification. Source results
  lead the choices and carry clickable links;
  failures retain the prior options. An older host that ignores `url` cannot
  pass off its catalog as the requested source (`requestedUrl` must match).
  Language correction is also allowed at choice steps, but that extra value
  kind must not make short unknown replies fall through to normal chat: without
  an `awaits` field, interpret every unmatched reply. Digit-format choices also
  accept their positions locally (`១` selects the first), observed after the
  restarted host exposed a fallthrough that invented a ready-to-install answer.
  Exact choices, including Khmer/Thai/fullwidth digits and punctuation, run
  locally first. Bible import, the verse finder's Bible chooser and lookup's
  **Open another passage** share `waitingInputHelpers.ts`: one bounded
  JSON interpretation, no tools. Only original choice IDs or validated values
  can continue the existing step; a help/ambiguous/invalid reply keeps the
  question and buttons. An unrelated task goes through the normal router
  with one user echo. Model output never supplies tool arguments or presses
  agreement, install, undo, settings or source buttons.
  Language values use the import tool's `normalizeBibleLocale`, accepting
  **Thai** as well as **th**; an explicit override beats detection. A restart
  after a language change reloads that language's digits and book names.
  Passage values require a whole valid book/chapter reference, and relative
  replies use the last displayed passage. `askWaitingInput` respects the
  tab's selected provider/model; Auto resolves a no-cost assistant without
  changing the tab's selection. Usage and progress are recorded. Stop retains
  the waiting question and actions, and late responses cannot advance it.
  Async work stays with the originating tab, including a resumed verse search.
  Tests: `waitingInputHelpers.test.ts`, import/verse helpers and the LLM
  boundary; live evidence: `test-results/bible-import-input/`.

- **The composer button is Send** (2026-10-18, user's screenshot), with
  **Send — Ctrl+Enter**, Khmer **ផ្ញើ** and French **Envoyer**. Keyboard hints,
  tips, reports and W-42 use the same label. **Ask again** remains the action
  that brings an earlier question back.

- **Two thumbs under every answer, and a thumb down is FOLLOWED UP by the
  window** (2026-10-12, `EC-259`, `src/chatbot/answerRatingHelpers.ts` — pure,
  every rule a test; the user's asks: _each response card should have like and
  dislike icon, when user dislike should follow up_ and _when user complain
  about wrong answer should recommend user to try smarter model_). 👍 / 👎
  beside **Copy** (`aria-label` _Good answer_ / _Bad answer_, `aria-pressed`,
  filled when on) write `rating` on the message; nothing is counted or sent.
  The first 👎 under an answer (`isFollowedUp`, so once per answer however
  the thumb is toggled) appends a line the window writes itself, **no
  model**: what was wrong, the three `DISLIKE_REPLY_LIST` sentences — each
  one `checkIsDisputingAnswer` takes, so pressing it runs the dispute read of
  the guide's newest copy; a test holds the two together — and the advice.
  That line is `isFollowUp`: it has no thumbs, is left out of the history a
  model is shown (joined to the answer above it, it would push that answer's
  last line — the offer a "yes" answers — out of the clip), and
  `findDisputedPage` looks past it to the answer it follows. Under a thumb
  down further up the chat it names the question and offers no sentences
  (pressed, they would dispute the LAST answer); under what a `/` command
  printed it blames no model. **"Smarter" is one step up a list written best
  first, and only three lists are**: `getRankedLlmModelList`
  (`isModelListRanked` in `LLM_PROVIDER_MAP`) answers for Claude, ChatGPT and
  Kimi — Bedrock's list is in the order to reach for them (its most capable
  model is fourth), the keyless three are three makers' models, a custom
  server lists what was loaded — so everywhere else, on Auto, and on the best
  model already, the advice is words and no button. **Ask again with <model>**
  is a pseudo tool (`ASK_SMARTER_TOOL_NAME`, caught in `handleActing`,
  registered nowhere) read against who is answering NOW (`readSmarterAsk`: a
  tab moved to another assistant is told so): it sets the TAB's model, leaves
  the stored choice for new tabs alone, and asks through `handleAsking`'s
  `options.model` — the closure still believes the old model — with
  `SMARTER_ASK_HINT` on the ask alone and a note on the answer that this chat
  now uses the model above, because it costs more. **A typed complaint gets
  the same advice as the answer's note and the same button**
  (`genComplaintAdvice`: by the dispute reader's own test, never for a known
  question, a general one or a rescue, and not right under a follow-up that
  has just said it); the button asks the question the complaint is ABOUT.
  **And what was clicked stays marked** (the user, the same night: _make the
  card and buttons focusable so when I clicked I still see which one got
  clicked_): each `article.cue` is `tabIndex={0}`, and `.cue` styles `:focus`
  — not `:focus-visible`, which a mouse press on a button never sets — with a
  ring round the card's body and the signal ring on the button pressed in it,
  steady, nothing animated. The list scrolls to its end when a message
  ARRIVES or the tab changes (`lastMessageId`), no longer on every rewrite of
  `messages`: a thumb on an answer further up took the card just pressed out
  of sight.
- **A page a PERSON asked to read is shown whole, and without what the page
  tool says to a model** (2026-10-12, `EC-242`). **Read the whole thing**
  under a guide answer presses `owa_help_page`, and what came back was
  printed as it stood: since 2026-10-11 every manual page ends with _(If they
  say this page does not match their window, read its newest copy with
  owa_read_website: https://raw.githubusercontent.com/… )_, and a page past
  the model's cap ended with a note that it had been shortened.
  `runBotAction` now reads every part (`readWholePage`) and shows
  `toShownPage` of it; `manualPage.mjs` is the one module that writes those
  notes and takes them off again. Pressed live: the help window's own page,
  55 560 characters to its last step, no tool name in it.
- **A Bible is installed IN the chat, one question at a time, by buttons and
  with no model** (2026-10-06, `src/chatbot/bibleImportChatHelpers.ts`; asked
  for _for old and non-technical users_ — it used to open Settings with the
  link typed in, leaving four fields nobody had heard of). Four ways in (the
  fourth, a missing Bible's own card, at the end of this note), the typed two
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
  **What counts as asking for one was re-read against the live window**
  (2026-10-10, the user's ask with the three Bible rows of the suggestion list
  circled: _importing bible data is the most important thing right now … make
  this prompt and mcp tool and action working smoothly_). A custom server's
  model is sent the lean tool list, which has no `owa_bible_xml`, so for a
  local model THIS reader is the whole feature. Measured first: _Import a
  Bible in Cambodia_ found nothing; _add bible verse John 3:16 to my bible
  list_ was taken for an import and offered the Chewa, Polish and Turkmen
  Bibles of 2016; five of the seven Khmer Bibles listed were installed and
  nothing said so; a typed `2` drew the same list again; and _How do I import
  a Bible XML file?_ took a local model 31 s to list the Settings form with no
  way to have it done. Now `readBibleImportLanguageAsk` has two strengths of
  verb — `import|install|download` ask by themselves; `add|get|load|want|need|
  give` and _do you have / is there / are there_ only beside a language the
  collection has (`checkIsBibleLanguageWord`) or with nothing else said —
  and `OTHER_TOPIC_PATTERN` (a verse, a list, a note, the screen, the reader,
  a `3:16`) hands the sentence to the guide whatever its verb; `put` and `use`
  count only beside a link. A typed reply is the PRESS (`findTypedPress`: the
  words on a button, the number of a choice, `yes` for the suggested one or
  **Install it**, `cancel`) — before it `yes` at step 1 named the Bible
  "yes" — and a link pasted alone answers the two answers that ask for one
  (`awaits: 'find'` / `'link'`; the dead-link answer's Cancel carries the
  second). An installed Bible is marked in the list and said before step 1
  (`installedAs`, by TITLE; a retitled edition is not claimed), a word no file
  has is answered with **Did you mean** buttons (`suggestions`), and
  `genGuideActions` puts **Import a Bible for me** first on any answer whose
  page is `BIBLE_IMPORT_MANUAL_ID` (W-34) — the how-to is still TOLD from the
  guide, and the button is the guide's own "easy way".
  **A Bible that is MISSING is asked for by its name** (2026-10-13, the
  user's ask with a picture of the Reader on _Bible key "KJV" is not
  available!_: _should have instruction for user to import in chatbot and
  should have button to open chatbot to import the bible like kjv_).
  `BibleNotAvailableComp` (`src/bible-lookup/RenderLookupSuggestionComp.tsx`)
  says how in three steps and carries
  **[en:tran:Let the assistant import this Bible for me]** — the fourth way
  in, through the same handoff and the 🤖's own two questions. What it
  leaves is a sentence a person could type, `Import the Bible called "KJV"`,
  written and read by ONE leaf (`src/helper/ai/bibleImportAskHelpers.ts`, no
  imports: the card must not pull the import conversation into the Reader),
  so the two cannot drift. `readBibleImportLanguageAsk` decides whether it
  is a request off the sentence WITHOUT the name (a Bible called LIST is no
  list), searches the collection for the name (`kjv` alone is the English
  one; a name with nothing to search by asks the language) and keeps it as
  `wantedKey` on the state. `carry` takes it through every step by itself;
  the buttons that write a state afresh hand it on (`keepWanted`: the
  language question's, a dead link's two, a link pasted alone). At the
  download it is the FIRST short name offered (`genKeyChoices`), with one
  sentence saying why — a Bible installed under any other name leaves that
  card exactly where it was — unless it is taken, cannot be a short name,
  or the Bible is already installed under another name (that one is found
  by choosing ITS name on the card, and the two sentences would say opposite
  things). Installed, the card goes away by itself: the import ends in
  `clearBibleXMLCache`, which tells every window, and `useSelectedBibleKey`
  asks again. **The button's text is its name and nothing more** — drawn as
  `… for me (KJV)` it could be found and not pressed, because a press by
  label wants a label part EQUAL to the words (`isPressSafe`); the heading
  above it says which Bible. Seen live on a scratch dev instance, twice
  (once by the user's own hand): _English KJV_ and _English NKJ 1982_
  listed, **KJV (suggested)** ahead of the file's own EK / ENGLISHKJ /
  ENGLISH, the Reader on Genesis 1:1 with no reload; `…called "KHOV"` typed
  — _None of them has “khov” in its name_ — and `Khmer` under it listing
  seven Bibles with the name still on every button.
  **A downloaded Bible is AGREED TO before it is asked about** (2026-10-16,
  the user's ask over the list of seven Khmer Bibles: _ask for user consent
  first, tell user it is randomly found on internet, show user where is from,
  tell user it's not provided by openworship, let user know that they hey to
  responsible for bible publisher. when user agree then keep going_; CB-145).
  `genBibleImportCheckAnswer` answers a download with `genSourceNoticeStep`,
  not step 1: what it is, then **Where it is from** (the collection's page for
  any Beblia file however it is linked — `checkIsCatalogLink` — else the page
  the file was picked from, carried as `sourcePage` on every file button, else
  _the internet, at the address below_), **The file** (the tool's `source`),
  **It is not from Open Worship** and **You are responsible to its
  publisher**, with **I agree** (step `agree` → `genAgreedStep`, which says
  what step 1 needs beside it: a second copy, the wanted name), **Open the
  website** (step `source`, the page in the system browser — only an http(s)
  `sourcePage`, `appProvider` imported at the press) and **Cancel**, which
  deletes the draft. Typed `yes`, `ok`, `agree`, `I agree` press **I agree**.
  The download happens BEFORE the notice, on purpose: one place every way in
  passes (a link, the collection, a model's own `check`), and it is the
  file's own title and address the person agrees to; a decline deletes it.
  A model's download carries the same buttons and, from
  `genBibleImportUnderAnswer`, the notice appended to its words, and a
  model's `owa_bible_xml` **`import` is refused in `runMcpToolCall`**
  (`BIBLE_IMPORT_MODEL_REFUSAL`): the person's press is the agreement, so no
  model may stand in for it. The stdio door is the developer's and unchanged.
  **Its two addresses are LINKS** (same day, the user with a picture of them:
  _make links clickable, open in browser_). An answer carries `links`
  (`BotAnswerType` → `ChatMessageType`, persisted): the addresses the APP
  wrote into it, and a `code` span whose words are one of them is drawn by
  `RenderChatLinkComp` — a button, not an `<a href>`, which followed would
  replace this window — pressed open in the browser through
  `openExternalURL`. Only the app's own: a model's words can carry what a
  page it read told it to say, so its addresses stay words, the provider
  pages' rule above. `chatLinkHelpers.ts` (no imports) is the one check —
  http(s), no user name or password, 600 characters, four a message — read
  by the Bible import, by `toValidLinksField` on load (a hand-edited file
  cannot make anything else a link, and a question carries none) and again
  at the press. The model's answer gets the notice's links with the notice.

- **A verse somebody half-remembers is found in a conversation of its own**
  (2026-10-16, `src/chatbot/verseFindChatHelpers.ts`; the user's ask with
  Bible Find circled, then four more the same evening). The way in is the
  robot at the right end of Bible Find's **[en:tran:All Books]** row,
  **[en:tran:Find a Verse with the Assistant]** (`RenderFindingInfoHeaderComp`):
  `openChatbotAsking` with `Help me find a Bible verse in "KJV"`, a sentence a
  person could type too, written and read by the leaf
  `src/helper/ai/verseFindAskHelpers.ts`; the chat starts it in a new tab
  (`takeHandoff`, on the window's focus AND on main's `chatbotLaunchFocus`
  -- with the window already open, Windows did not always focus it and the
  press did nothing, 2026-10-17; with the strip full, an empty tab), and
  the typed sentence or the corpus row _Can you help me
  find a Bible verse I forgot?_ starts it in the tab in front. **Two steps by
  buttons, no model** (`VERSE_FIND_STEP_TOOL_NAME`, the whole step in the
  args): **Which Bible should I search?**, every installed Bible, Find's
  first and marked _(the one in Find)_ (a typed short name, number or title
  word picks one too, `readVerseFindTypedPick`), then **What do you
  remember about the verse?** with **Search another Bible**. That answer
  carries `verseFind` (the Bible), persisted on the message, and **every
  plain line typed under such an answer is more of the same search**
  (`readVerseFindThread`) until a `/` line or the app's own work (_put it on
  the screen_, _how do I save it_) ends it; meanwhile the box offers no app
  questions. **The assistant is asked under a prompt of its own**
  (`AskExtraType.verseFind` → `VERSE_FIND_SYSTEM_PROMPT`, ~420 tokens, its
  own cached prefix) with `owa_find_verse` and `owa_read_website` as its only
  tools and five rounds at most -- 5k tokens for the answer seen live, where
  an ordinary question carries ~8 350 of schemas a round. It tries every
  way: the words, the words a described verse would use, other forms, the
  KJV with what it translated to English, references it thinks of read with
  `refs`, then a web search page; it names only verses a search or a read
  returned from THEIR Bible, and each one it names gets **Open … in Bible
  Lookup** (`genVerseOpenActions`, off the tool watch's `foundVerses`, in the
  order the answer names them). **The Bible can be changed under every
  answer** (2026-10-17, the user's picture of John 14:6 quoted in French in a
  Khmer window: _I'm looking in khmer then I should be able to change to
  english_; `genVerseChangeBibleAction`): **Show in another Bible** under
  verses found, **Search another Bible** under none -- a step button carrying
  `current` (left out of the list), the `words` and up to five `verses`
  (key + ref, read again at the press, `toVerseFindCarry`). A Bible picked
  with verses quotes them from itself by `refs`, no model
  (`genVersesInBibleAnswer`); with words alone the window asks the one line
  for them (`toVerseFindSearchAgainAsk`, echoed as the pick), so the head
  start, the assistant and the window's own search all run. Either way the
  tab searches the new Bible from then on; with no other Bible the answer
  offers the import. **Nothing found** -- no verse the answer
  names, or the guide's own search empty -- ends with a Google link written
  out and drawn as a link (`genVerseWebSearchLine`,
  `https://www.google.com/search?q=bible+verse+…`, an address the APP wrote)
  and **Search Google for it** (`VERSE_WEB_SEARCH_TOOL_NAME`, a pseudo tool:
  the address is built at the press from the words). **With no assistant**
  the window searches the words itself (`answerVerseFindOffline`): the
  verses holding the most of them, _(4 of 4 words)_, a button each, and words
  not in that Bible's language said so, never _make sure the main window is
  open_ (the user's own Khmer tab, the free service failing). **Every answer
  names its model** (the user's ask with _free_ circled under an answer):
  `answeredBy` on the message, from the last round's provider and model in
  the pickers' own words; the cost line reads _Nemotron Super VL · free · 5k
  tokens_ and its hover, and the **Assistant** label's, _Model: Free ·
  Nemotron Super VL_. **The window searches FIRST** (2026-10-16, the goal
  the user set: _chatbot be smart enough to help user find verses he/she
  forgot_; `genVerseHeadStart`): before any model round it searches the
  chosen Bible for their words, and -- for words in another script
  (`checkVerseFindNeedsTranslation`) -- asks a **Gemma 4** model that can
  answer at no cost for the English in KJV wording (`translateVerseWords`:
  one round, no tools; the user's word, _for any translation attempt please
  prefer Gemma 4 models_) and searches that too, the tool crossing to the
  KJV by itself and quoting back from the chosen Bible. Both lists ride the
  ask (`toVerseHeadStartAsk`, five verses each, cut at 160 characters) and
  seed the tool watch (`AskExtraType.verseFind.found`), so a verse the model
  names from them gets its button with no search of its own; with no
  assistant they ARE the answer (`genVerseHeadStartAnswer`). On **Auto** a
  verse in another script goes to a Gemma 4 model first
  (`AutoRankOptionsType.preferModelPattern`, after setbacks, busy servers and
  an unloaded LM Studio). Measured on the user's Khmer phrase: 41.4k tokens
  over five rounds on the free model before; 3.6k on the local gemma-4-e4b
  with the head start, John 21:17 found. **One line does it all**:
  `Help me find a Bible verse in "KJV": love your enemies` starts the
  search with no step in front (`readVerseFindAsk`'s `remembered`).
  **And a verse asked for by what it says in ANY chat** -- _which verse
  says do not worry about tomorrow_, `readBibleContentAsk`'s verse kind
  (EC-199) -- is that search too, in the Bible the lookup is on, from the
  words the question is about (`EC-285`): an assistant had answered it from
  memory in another translation's words, under **Show me Bible Find**.
  Measured on the standing set
  (`.claude/skills/owa-enhance-chatbot/references/verse-find-asks.json`,
  scored by `scripts/score-verse-find.mjs`): 20 of 20, the typed five from
  17.6-37.1k tokens with no verse to open down to 2.1-6.8k with every one.

- **Scrolled up, a round ↓ takes them back to the newest message**
  (2026-10-16, the user's ask with the corner circled: _when the scrollbar
  not at bottom then should have an icon for quick scroll bottom_, then
  _should have background transparency glassier_). `.chat-log-jump`, sticky
  at the bottom-right of the scroller in a box of no height, drawn only while
  the log is more than `SCROLL_END_SLACK` (48px) above its end; the state is
  set on scroll and after a message lands, and React drops the set when it
  did not flip. Glass: a 42% film with a 6px `backdrop-filter` over the words
  under it -- the one blur in this window, and 32px of it; the window's own
  ground stays the OS's glass. The press scrolls smoothly to the end. It is
  not auto-hide: it is a control that exists only while there is somewhere
  to go back to. Proven with a real mouse event over raw CDP: 559px up, the
  hit-test at its centre was the button, and after the press the log was at
  its end with the button gone.

- **For a reader who reads NO English** (2026-10-17, the user: _when app is
  in Khmer we don't expect user can understand english at all_; the
  elder-persona run, `EC-288`..`EC-292`). Five things hold in a window shown
  in a language other than English, each measured on a Khmer answer that broke
  it. A question carrying two letters of the app's script is answered in the
  app's language whatever English it quotes (`pickReplyLanguage`). The answer
  is cleaned by CODE at the end of `askLlmBot` and on the translated path
  (`answerLanguageHelpers.ts`): a Latin-only bracket after the language's own
  words goes (_រូបកង់ធ្មេញ (Settings)_), an English label the dictionary
  knows is written as the button shows it (_Go Back to Presenter_), never one
  word out of a longer name, never a key cap, never a `REPORT:` -- and the
  letters of a THIRD script, neither the language's own nor Latin, go with
  the signs on them (`dropThirdScriptLetters`, 2026-10-17, `EC-307`: _预览_,
  _పొ_, _কোথায়_, _الخاص_ in Khmer answers and a chip of the whole-corpus
  run, letters the reader cannot even sound out). **What the screen shows in
  English stays English** (`EC-316`): nothing in a code span is translated,
  nor a word after `ol:`, nor a menu-bar name before an arrow -- the menu
  bar reads File … Help in every language -- and a model's own _ជំនួយ → …_
  and _ol:ខគម្ពីរ 1_ are put back to _Help → …_ and _ol:Verse 1_ through
  the dictionary (`restoreEnglishNames`); the cleaner had been translating
  **Help** itself, a one-word key. A verse asked
  for in the person's own words is the verse finder's (`verseAskLanguageHelpers.ts`,
  the patterns DATA in `assistant.json`: `verseFindAsks`, `verseAsks`,
  `verseAskExcludeWords`), searched in an installed Bible of THEIR language
  before the lookup's (`pickVerseFindBible`), and its references are drawn as
  that Bible writes them, on the buttons too (`title` from `owa_find_verse`,
  `toShownVerseRef`, `toShownActionLabel`). A reply chip never offers a
  removal (`checkIsRemovalReply`, `removalWords` per language) — a chip is a
  one-press yes; and a chip with none of the language's letters is dropped
  (`toRepliesShownInLanguage` — a model working in English left its own when
  the translator dropped the `OPTIONS:` line). An answer that says to type
  `/btw` carries **Ask it as a general question** (`GENERAL_ASK_TOOL_NAME`),
  the command written for them. A thank-you under a found verse ends the
  search (`checkIsClosingLine`, `closingWords`) — it was searched as verse
  words and answered with a Google search for "thank you". And an address
  the app writes is drawn decoded and short (`toShownLinkText`): a Khmer
  Google search had been 300 characters of `%E1%9E…`.

- **A person, a place or a passage is asked about from its Lookup Detail
  panel** (2026-10-18, the user's picture of three panels — a verse, Adam,
  the Garden of Eden — the left of each title circled: _add robot icon,
  click to open chatbot, make sure mcp tool provide all information to
  chatbot session then let user interact_; the story _as a user I want to
  ask the chatbot about location/name/bible by opening from the detail
  panel_; and _chatbot should know the location/name is from KJV, in case
  want to know_). The 🤖 at the LEFT of every detail panel's title
  (`RenderAskAssistantButtonComp` in `LocationNameDetailPanelsComp.tsx`,
  **[en:tran:Ask the Assistant About This Person]** / **Place** /
  **Passage**, drawn only while AI is on, like the Resources panel's)
  hands over WHICH record, never its words: `openChatbotWithLookup` → the
  🤖's two questions → `chatbot-handoff-lookup` (`requestChatbotLookup`, 30
  s), the request written and read by ONE leaf with no imports
  (`src/helper/ai/lookupAskHelpers.ts`: kind, the panel's own target — a
  record id or a short verse —, the title it shows, the passage's Bible or
  the record's lookup language, and the address of the window the panel is
  in). The window takes it in a tab of its own (`takeHandoff`) and reads
  the record ITSELF, with no model, through `owa_lookup_record` in the
  panel's window — where the ~34 MB names dataset is already held — and
  anywhere when that window has gone (`openHandedLookupRef`); what came
  back is kept on the card (`ChatMessageType.lookup`, bounded at 16 000
  characters, checked field by field on load) and the card says it was
  read — _drawn from the King James Version_ for a person or a place — with
  three questions to press. **Every plain line under it is about that
  record** (`readLookupThread`, `lookupChatHelpers.ts`, pure, every rule a
  test): it is asked with the record fenced as DATA under the question
  (`toLookupAsk`, the user turn, never the prompt), under a short prompt of
  its own (`AskExtraType.lookup` → `LOOKUP_SYSTEM_PROMPT`, its own cached
  prefix) with `owa_lookup_record` and `owa_read_website` as its only tools
  for five rounds — the record tool aimed at the panel's window by the
  loop (`ToolWatchType.lookupPage`) —, no known-question hint, no Bible
  Find advice, no verse search and no walkthrough; translated both ways like
  any other ask. Its answers carry `isLookupAnswer` (a failed one too), and
  a `/` line, another kind of answer, or the × of the
  **[en:tran:Still asking about]** line above the box (`lookupClosedAt`,
  like a file's) ends it; meanwhile the box offers no app questions. The tab is named by
  the record (`genChatSessionTitle`). With no assistant the window shows
  what the app holds on it (`genLookupOfflineText`) and **Open AI
  settings**. **A passage being read opens the same conversation** (the
  same day, the user's picture of a Bible view's toolbar circled: _add robot
  icon to part of the icon and add contextmenu to verse preview content. to
  open the verse in chatbot like open from floating verse detail panel_):
  the robot at the end of every Bible view's toolbar
  (`RenderAskAssistantBibleItemButtonComp`, in both the plain and the
  editing view's group) and, on its right-click,
  **[en:tran:Ask the Assistant About This Verse]** — the verse under the pointer, read off its
  `data-verse-key` (`readBibleVersesKey`), left out when the passage is
  that verse — and **[en:tran:Ask the Assistant About This Passage]**
  (`genAskAssistantContextMenu` in `BibleViewComp.tsx`), each a verse
  request through `bibleItemAskHelpers.ts`, imported at the press.
  **A record's inline references are written as the lookup's Bible writes
  them** (`toLocalizedReferences` in `agentLookupHelpers.ts`, as the panel
  draws them): seen live, the Khmer dataset's `[Genesis](book-key://GEN)`
  came back in a Khmer answer as _Genesis_.
  **And there is a lot to DO with it, by buttons, with no model**
  (2026-10-18, the user's picture of a chat about Genesis 4:1-26: _add more
  options, like open another verse or open other bible key, and more
  option to let user able be to do a lot of things on bible_;
  `lookupStepHelpers.ts`, pure, every rule a test). Every button is
  `LOOKUP_STEP_TOOL_NAME`, a pseudo tool no model can press, carrying the
  record it acts on (its listed fields only, never the words read of it), so
  an old button acts on its own record. A passage's card carries **Open in
  Bible Lookup** (`owa_find_verse` `open`), **Previous** / **Next chapter**
  (**verse** for a single verse; `owa_lookup_record` `near`, across books),
  **Read it in another Bible** (every other installed Bible a button),
  **Who and where is in it** (`names`: the people and places a button
  each), **Open another passage** (`lookupAwaits` on the answer: the line
  typed under it is read as a passage in that Bible, asked again when it
  cannot be), **Save to my Bibles list** (`owa_bible_item` `add`) and **Copy
  the passage**; a person's or a place's card **Its verses** (the quoted
  ones), **Family and places** / **Related places** and **Read it in another
  Bible**. A name, a place, a verse or a Bible pressed off a list opens its
  own card in the same tab, which the conversation is then about. Every
  answer under it ends with **Previous** / **Next** for a passage and **More
  things to do** (`genLookupAnswerActions`). Labels are stored in English and
  drawn with `tranLabel` (`LOOKUP_ACTION_LABEL_LIST`, held by
  `chatTranLabels.test.ts`), or are the name or reference itself.
