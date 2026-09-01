---
name: agent-access-mcp-chatbot
description: No fixed CDP port any more — the app publishes both agent doors (CDP + its own MCP server) to a temp file, and ships an in-app self-help chatbot whose tabs each carry their own provider, model and conversation
metadata:
    type: project
---

Built 2026-08-31 (branch `enhance-after-release`). The app is now drivable by
an agent on purpose, in dev **and** in packaged builds, because it hosts a
self-help chatbot users ask "how do I …?" — see `electron/aiHelpers.ts`,
`tools/owa-devtools-mcp/`, `src/chatbot/`.

- **No port is hardcoded.** `--remote-debugging-port=0` (Chromium picks a free
  one) + `<userData>/DevToolsActivePort` to learn which. Both doors land in
  `<temp>/open-worship-app-cdp/<pid>.json`: `port`/`url` (CDP) and `mcpUrl`
  (the app's HTTP MCP server, `OWA_MCP_PORT`, default 39223). One file per live
  instance. Nothing stores a port: `tools/owa-devtools-mcp/discovery.mjs` is
  how anything finds the app, and `bin.mjs --bridge --listen=9223` serves a
  client that can only take a fixed URL. `./.mcp.json` is back (2026-08-31) but
  holds NO url — it just spawns `node tools/owa-devtools-mcp/bin.mjs` over stdio
  as **`owa-devtools`**, so an agent gets `mcp__owa-devtools__*`: the whole
  chrome-devtools tool set plus `owa_app_state`, `owa_find_ui`, `owa_list_ui`,
  `owa_click`, `owa_type`, `owa_goto_page`, `owa_list_screens`,
  `owa_hide_screens`, `owa_help_search`/`owa_help_page` and
  `owa_guide_*`. The path in it is repo-relative, so the client must be started
  from the repo root.
- **`enableRemoteDebugging()` must stay synchronous and run before `ready`.**
  The first attempt awaited a free-port lookup, and the switch then landed
  after Chromium had already started the DevTools handler — an endpoint that
  appears only sometimes. It also runs *after* the single-instance lock, so a
  jump-list relaunch never touches it.
- **`createMcpServer` can only be called once per process with telemetry on**
  ("ClearcutLogger is already initialized" — a singleton). The app serves one
  server per MCP session, so `server.mjs` forces `usageStatistics = false`.
- **`browserUrl` is a live getter**, re-read by chrome-devtools-mcp on every
  tool call, so one long-lived MCP server follows the app across restarts. It
  must never be falsy — an empty one makes it LAUNCH its own Chrome.
- **App-level tools read the DOM or use `ipcRenderer`; they never `import()` an
  app module** (that re-runs `document.onkeydown` and kills every shortcut —
  see [[cdp-dynamic-import-hijack]]). `owa_find_ui` can outline the real
  control in the window, which is how the chatbot answers "where is …".
- **Knowledge is bundled at build time**: `extra-work/build-knowledge.mjs`
  (in `electron:build`) copies `docs/manual-sources/**` (`manual`) and
  `.claude/**` (`internal`) into `electron-build/knowledge/` plus a search
  index, so a question is one file read, not 140. Internal hits are labelled —
  they are notes for whoever builds the app, not user instructions.
- **Two ways in, two providers, many models.** The window opens from the **🤖**
  button in the top-right toolbar (left of **?**, on the presenter and the
  reader — it is `ChatbotButtonComp` in `src/others/commonButtons.tsx`, and it
  renders nothing when the master switch is off) or from Help →
  *App Help (Chatbot)*. Inside, **Claude** / **ChatGPT** picks the provider and
  a `<select>` beside it picks the model: three per provider, best first, with
  what each is good for, how quick it is and its list price on the HOVER (the
  line itself shows the name only — the window is 460px). **More models…** asks
  the account's own catalogue (`models.list`) and appends everything else the
  key can run, which is the only reason a model released after the build is
  reachable; the OpenAI list has to be filtered (it answers with speech, image
  and embedding models too) and only reasoning models may be sent
  `reasoning_effort` — `gpt-5-chat-latest` is the trap, so the pattern is
  `/^(gpt-5(?!-chat)|o[0-9])/`. GPT-5 spends reasoning tokens out of
  `max_completion_tokens`, so the OpenAI budget is far larger than the
  Anthropic one and its effort is `low` — at the Anthropic figure the answer
  itself comes back empty.
- **The tab IS the session, and it owns the whole head row.** Several
  conversations at once (`src/chatbot/chatSessionHelpers.ts`): a tab holds its
  messages, its half-typed draft, its focus, its provider AND its model, so one
  tab can be on Claude about the presenter while the next is on a cheap model
  about the reader. Named after its first question until double-clicked and
  renamed. All of it is one JSON setting, `local-storage/chatbot-sessions`,
  capped (12 tabs × 60 messages) because `appLocalStorage.setItem` is a
  SYNCHRONOUS file write on a machine with nothing to spare — hence a 400ms
  debounced save plus a `beforeunload` flush for the last keystrokes.
  `chatbot-llm-provider` / `chatbot-llm-model-<provider>` are no longer what
  answers a question; they are only what the next NEW tab starts on. A stored
  tab whose provider's key was removed is put back on one that can answer
  (`genInitialSessionState`), rather than on a dead one.
- **A key is a thing the user has to be told about.** With no key at all,
  `app guide · offline` in the head is a BUTTON and the empty state adds a line
  and an **Open AI settings** button; both write `setting-tabs` = `o` and open
  `setting.html` themselves rather than importing `openOthersSetting` — that
  module registers a `go-to-setting-home` listener at module scope, and a popup
  that also listens opens a SECOND settings window on one menu press.
- **The chatbot answers a VOLUNTEER, not a developer.** Everything user-facing
  goes through that: the offline bot searches `kind: 'manual'` only (internal
  notes are for the model to read, never to quote), no answer shows a document
  id, a section path or a file name, the window is English-only
  (`toEnglishOnly` strips the Khmer twin the manual writes beside each label),
  and an SDK error is turned into one sentence -- the raw `400 {json}` used to
  land in the bubble, with the markdown renderer eating its underscores.
- **Answers are scoped to the half of the app that asked.** `build-knowledge`
  records a `surface` per manual page (from its `Where:` line and section), and
  a recipe for the other half is dropped unless nothing else matches: the
  reader has no Ctrl+B lookup popup, so being handed W-06 there is being told
  to press something that does not exist. Ranking is word-boundary + IDF +
  three weight bands (title 14 / headings 6-10 / body 1, capped) -- substring
  matching once answered "how do I look up a verse?" with a robot-test note
  about keyboard shortcuts, because "up" is inside "coverage-expansion".
- **`owa_guide_*` is the walkthrough**: a numbered card drawn in the app window
  (shadow root, `#owa-guide-host`) with the step's control ringed in red;
  clicking that control advances it, so the user drives. Steps are taken from a
  recipe's numbered list, every **bold** phrase is a candidate control (a
  shortcut or a verb is not -- "not" once found the Notes button), and leading
  steps for a window the user is already in are dropped (asked from the reader,
  "click the Bible Reader tab" is not a step). `mode: 'demo'` adds **Do it**,
  which clicks or types for the user -- ONE step per press, never a sequence,
  with **Skip** always beside it. The card's own text is set after the step is
  drawn: the branch that finds nothing to ring writes the hint too, and used to
  wipe the "I could not do that" message. **Demo mode lives or dies on those
  bold labels**: a recipe that bolds only keystrokes and stressed words (W-11
  bolds `Tab`, `Escape`, `version`, `history` — every one rejected) yields
  steps with no candidate at all, and every press of **Do it** could only
  apologise. `start()` now tests that up front and reports `canDemo`, turning
  such a demo back into a plain walkthrough with one honest line, so the
  button is never drawn dead; `runBotAction` says the same thing in the chat.
  Targets are picked by RANK, not document order — exact label, then a real
  control over a container, then the shortest label — because the query walks
  ancestors first and their `textContent` is everything they wrap: "KJV" used
  to ring a whole Bible history row instead of the version button beside it.
  `GUIDE_RUNTIME` is a template literal, so a regex inside it needs
  `/\\s+/g` — a lone `\s` is an identity escape and silently ships `/s+/g`.
- **A `Do it for me` press is the model's job, not the recipe's.** A demo
  built from a `manualId` can only press what the recipe bolded, so the
  chatbot's button now ASKS the model instead (`BotActionType.ask`, routed
  by `handleActing` back into `handleAsking`) and the model writes its own
  steps with a `find` on each. Three things had to be true before that
  worked live: the ask has to NAME what to demo (without it the model can
  only ask "demo what?"), it must not spend the 6-round tool budget
  checking every label with `owa_find_ui` (it then never reaches
  `owa_guide_start` and the user gets "could not settle on an answer"), and
  `owa_guide_start`'s own description had to stop saying "offer the demo,
  do not assume it" without exception -- pressing the button IS the yes.
  The ask text is shown in the chat as the user's own message: no tool
  names (the markdown renderer eats the underscores) and no jargon.
- **Every acting tool call announces itself in the window** (`notify.mjs`):
  a pill at the top saying "Assistant clicked something", 2.6s, its own
  shadow root, `OWA_MCP_NOTICE=0` to silence it. Reads (snapshot,
  screenshot, `owa_app_state`) stay quiet -- a banner per read would cry
  wolf and photograph itself. It hangs off `server.connect`, wrapping the
  transport's `onmessage` AFTER the SDK has installed its own: the SDK
  CHAINS the handler it finds, so an accessor that answers "me" on read and
  stores what it is given feeds the SDK a closure that calls back into it --
  every message recursed and the whole MCP host answered 500 to
  `initialize`. Wrap after, never before.
- **A ring that beats means "you press it".** The guide ring animates only
  while the guide waits on the USER (show mode, or a demo step it could not
  perform) and holds still when the card is about to press it itself;
  `owa_find_ui`'s highlight always beats, since it only ever answers "where
  is it?". Both honour `prefers-reduced-motion`, and find_ui removes its
  injected keyframes with the marker -- that one draws into the app page,
  which has no stylesheet of ours.
- **The card goes up from the recipe INSTANTLY; the model only repairs it.**
  A model-built walkthrough takes 30-100s, and a volunteer who presses a
  button mid-service cannot watch a blank window that long -- so
  `runBotAction` starts the recipe card first (~1s) and returns
  `isNeedingModel`, true only when the card cannot do what was asked:
  `isTargetFound === false` for a walkthrough, `canDemo === false` for a
  demo. `handleActing` then fires the `ask`, and the recipes that were
  already good cost nothing. Measured live: 1.1s to the first card, 31s to
  the rebuilt one. `handleAsking` takes an `isForced` flag for that
  follow-up -- `setIsBusy(false)` has run but React has not re-rendered, so
  the busy flag the closure sees is still true and the ask is dropped
  silently without it.
- **`status()` reports `find`, `isTargetFound` and `nearMisses`.** A guide
  whose steps name controls that are not there looks exactly like a working
  one from outside, so the step says which label it used and whether it
  landed -- that is what the repair decision and the model self-correction
  ride on. When it did not land, `nearMisses` names the closest labels that
  ARE on screen, so the retry is written in real words ("reference box"
  finds nothing, but the "Bible Reference" box is right there). Matching
  lives in ONE shared matcher, `domMatch.mjs` (`window.__owaDomMatch`), used
  by the guide, `owa_find_ui`, `owa_click` and `owa_type` alike: tiered
  (exact, word-boundary, substring, any-order tokens), length-bounded
  ("book" was ringing a Resources row for `khmer-study-bible-pdf`, and a
  confidently wrong ring is worse than none, because the user presses it),
  and `perform`/`owa_click`/`owa_type` poll ~1.5s for a panel that is still
  rendering before declaring nothing on screen.
- **A guide can only run where the window IS.** Focus says Presenter but the
  main window is the Bible Reader → `owa_guide_start` dies with "no open
  page matching" (the error now lists the pages that ARE open). The chatbot
  turns that into "Go to the Presenter first" + an outlined switch control +
  an "I'm there -- start it" retry button (`genPageSwitchAnswer` in
  `helpBotHelpers.ts`); the LLM path is taught the same in the system prompt
  and can switch the window itself with `owa_goto_page` (which is
  `location.pathname` assignment + target-list confirmation, since the
  navigation unloads the page before it can answer). The card itself can
  NEVER cross a page change -- it lives in the page's DOM and dies with it.
- **`MAX_TOOL_ROUNDS` is 10, and the last round goes out with no tools.** At
  6 a walkthrough (search, page read, one look, start) ran the budget out
  mid-answer and the user got "I looked several things up but could not
  settle on an answer" having paid for the whole run.
- **Master switch**: Settings → Others → *Enable AI features* writes
  `ai-enabled` to `clientSetting` in `<userData>/setting.json`; the main
  process reads that file directly before `ready`. Off = no CDP, no MCP host,
  no chatbot menu item, and the AI providers refuse a client. Next launch only.
  **Unset = OFF packaged, ON in dev**, and the renderer's `getIsAIEnabled()`
  has to default the same way — two halves that disagree give you a ticked
  switch over a process with no doors open.

**Why:** the same endpoint serves the user's chatbot and every QA/agent
workflow, so it had to stop being a dev-only hardcoded number without becoming
undiscoverable.

- **The window has a design of its own** (`ChatbotAppComp.scss`): a cue-sheet
  rail with a marker per turn, brass for the rail and the live marker, the
  app's cyan kept for the one primary action, Bahnschrift/DIN for every label
  and the system face for answers. No webfont is loaded -- the building's
  internet is the first thing to go mid-service -- and no `.btn`/`.app-data`
  class is used, because neither bootstrap's sizing nor the app's global sheet
  belongs in a 460px window (the latter is not even loaded here).

**How to apply:** never reintroduce a fixed port, nor a `.mcp.json` that names
a URL; one that merely spawns `bin.mjs` is fine, because discovery still happens
through the published file. Editing anything under `tools/owa-devtools-mcp/`
needs an app RESTART to take effect — the modules are imported once per process,
and the knowledge index needs `node extra-work/build-knowledge.mjs` re-run.
The chatbot popup loads bootstrap and its own sheet only: `.app` / `.app-data`
and every other global rule is absent there, so it sets `data-bs-theme` AND its
own `color`, or the text keeps the light body colour on a dark background.
