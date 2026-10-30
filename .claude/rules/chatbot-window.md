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

**Split by topic on 2026-10-29** (`AD-22`: this file had grown to 156 KB,
about 39k tokens, loaded by any read under `src/chatbot/`). Each part loads
with its own files; before changing one, read it whole:
`chatbot-files-report.md` (attachments, a PDF read as its pages, Resources
files, Report, the Presenting Control's snapshot), `chatbot-commands.md`
(the `/` commands), `chatbot-bible-import.md` (waiting questions and the
Bible import), `chatbot-verse-find.md` (the Bible Reader's own asks, Bible
content questions, passage completion, the verse finder) and
`chatbot-lookup.md` (a person, a place or a passage from its Lookup panel:
the record's chat, family line, related verses, word study).

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
  press reads the switch and offers Settings → AI Providers, because a vanished
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
    **At the cap `+` is NOT disabled** (2026-10-22, the user with the greyed
    `+` circled: _should have message tell user about it rather than
    disable_): `RenderSessionTabsComp` draws a `role="status"` line under
    the strip naming the cap and what to do (unlock first, when every tab
    is locked), dropped by render once `canAdd` is true again. Shared with
    the ✨ window (8 tabs). A driver still gets no tab: count tabs, never
    read `disabled`.
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
    main window is no aim at all (the old way). **The help opened FROM a
    window starts working in it** (2026-10-23, the user, Settings' 🤖 working
    in the Reader: _open from setting should select setting_;
    `findOpenerWindowId`): its opener's address on the first open, its path
    when main says a later press came from it; the main window, and a path
    two windows share, stay no aim. **And a tab ASKING ABOUT a popup kind
    works in it** (the same day, the user: _chatbot's do it for me appear in
    wrong page, I ask for setting page and appear in main windows_;
    `toFocusWindowAim`): with no window chosen, Settings, a Bible Note or an
    editor is aimed at when exactly one is open -- a model's card names no
    window, and came up in the Reader for a button in Settings. With one chosen, the prompt
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
  - **A gear ends the picker row and opens Settings → AI Providers**
    (2026-10-23, the user's picture with the empty end of the limit's line
    circled: _add setting icon there to easy open setting from chatbot_;
    `.chat-head-setting`, `openAiSetting`, labelled **Open AI settings**). It
    is ABSOLUTE at the bottom-right of `.chat-head-picks`, the row's last
    line, and the limit (always last) keeps `margin-inline-end: 24px` clear
    for it. Not an in-flow auto margin: two auto margins split the slack, and
    a row that fits on one line would float the model mid-row again. The
    reserve sits on the limit, so the model's line loses nothing at 412px.
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
    Settings → AI Providers → **Custom servers** with a name, a base URL, an
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
    never enters the window. A paid key never stands in for it nor it for a
    paid key; when the one a tab NAMES fails before answering, the question
    goes down Auto's no-cost line (`chatbot-llm.md`, 2026-10-22); this computer AND
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
    sticky notice offers Settings → AI Providers; a failed call falls back to the
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
    the app's words. Latin-script languages are told apart by their little
    words (`functionWords`; a French elision `l'` counts at the front of a
    word, 2026-10-29, `EC-446`: an English line with none of English's had
    been answered in a French window's French), and
    `chatLanguageParity.test.ts` asks every row in each language under each
    other app language. Every language is DATA in
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
    **And a face picked in Settings → General → Font Family heads every
    stack** (2026-10-20, the user's picture with the chatbot's tab title
    circled: _custom font-family not effect everyting in chatbot page_,
    then _not effect ai chat as well_): boot's `* { font-family }` loses to
    every class stack in these windows, so `plugChatWindowAppFont`
    (`chatWindowLanguage.ts`, called by both entries) sets the picked face
    as `--chat-app-font` on `<html>` and each `--chat-font-*` stack starts
    with it; the ✨ window's guest pages get it through
    `genGuestAppFontScript` (`aiChatGuestFontHelpers.ts`) — `local()`
    faces under the site's own face names plus a body rule, and `local()`
    needs the face's FULL or PostScript name, not the family (see
    `aichat.md`). The walkthrough card, the ◎ picker's line and the action
    banner, drawn into the app's windows, take the page body's face the
    same way — and boot's `*` rule already gives those windows' bodies the
    picked face, so no extra carry is needed there. Named `tran` so
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
    `minimize()` docked the presenter instead. **Windows** (2026-10-20): an
    OWNED window minimises on its own but its caption strip (icon + restore +
    maximise + close) is drawn at the bottom-left of the OWNER's client area,
    over the content, until restored. `detachFromParentWhileMinimised`
    calls `setParentWindow(null)` first (macOS and Windows; Linux minimises
    owned windows cleanly) and rejoins on the window's own
    `restore` EVENT — Electron attaches only a VISIBLE window to its parent.
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
  purpose. **The provider warning hides too, on a key of its own** (2026-10-20,
  the user with the banner circled: _shoudl be able to hide it for 30 days_):
  `ai-provider-warn-hidden-until`, the same button in its body
  (`RenderProviderWarningComp`), ONE key for Auto and the free service both
  (it is one warning); it is not the cautions' key, because where the words
  GO is not whether an answer is RIGHT. Not a dismiss for good, and not
  auto-hide. **Everything a hide button put away is named in Settings →
  General** (the same day, the user: _everything that can be hidden for 30
  days should be seen in setting general … to be able to restore_): the Other
  General Options card's `genHiddenItemRows` — the tips of the day, the help
  window's tip line, the AI caution, the free-service notice and the
  data-folder move ask — each row only while hidden, with its day read the way
  its owner reads it and a **Show again** that clears the stamp
  (`show…Again` helpers / `showChatTips`).
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
  `AppLayoutComp`, `PopupLayoutComp`, `setting` and — while no data folder is
  in use, in place of the window — `NoDataDirGateComp` mount `HandleAlertComp`) —
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

- **The composer button is Send** (2026-10-18, user's screenshot), with
  **Send — Ctrl+Enter**, Khmer **ផ្ញើ** and French **Envoyer**. Keyboard hints,
  tips, reports and W-42 use the same label. **Ask again** remains the action
  that brings an earlier question back — **with what it was asked with**
  (2026-10-22, the user, the re-asked _Explain it in simple words_ without its
  `MAT.18.pdf` chip: _it should include the context_): `toReusableAttachments`
  puts the question's files, pointed-at controls and still-held pictures back
  in the box beside its words, each with its own id and number, nothing in the
  box dropped; a file whose pages the window let go of is read again at the
  ask (every box attachment goes through `reloadFileAttachment`, not only an
  open one).

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
  word out of a longer name, never a key cap, never a `REPORT:`. **A
  SENTENCE-CASE label is read whole in bold or in quotes**
  (2026-10-19, `EC-373`): the run pass wants every word capitalised, so the
  lookup card's own labels -- **Its verses**, `"Family and places"` -- were
  read as their first word and stayed English in Khmer answers (seen live:
  _ចុចប៊ូតុង "Its verses"_); `toBoldLabelsShown` and a quoted-label pass now
  translate the span as one, and `restoreEnglishNames` still puts a menu
  name back. A label the model mixed word by word (_អាន it in another
  ព្រះគម្ពីរ_) is not repaired -- `EC-374` is open on it. And the
  letters of a THIRD script, neither the language's own nor Latin, go with
  the signs on them (`dropThirdScriptLetters`, 2026-10-17, `EC-307`: _预览_,
  _పొ_, _কোথায়_, _الخاص_ in Khmer answers and a chip of the whole-corpus
  run, letters the reader cannot even sound out), and so does a lowercase
  Latin word inside the language's own words (`dropStrayLatinWords`,
  `EC-424`: _គូស podkre_, _អ្នកleថា_). **Never what the answer is ABOUT**
  (2026-10-23, `EC-429`, `AnswerKeepType`): a passage chat passes its
  passage's text and the letters of every script in it stay -- the Greek
  Bible's verse had been quoted in a Khmer answer as empty guillemets --
  and a word study of an English verse keeps its English words and
  glosses too (`isLatinKept`); an ordinary answer about the KJV still loses
  a stray English word. **What the screen shows in
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
