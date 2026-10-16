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
  attached** (`kind: 'file'`, `genFileAttachment`): no bytes are held and
  no model is shown it — the model is told it is there and cannot be opened
  — it rides along for the report to send from its path. **A home folder
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
