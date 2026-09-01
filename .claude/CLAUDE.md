# Project instructions

## Performance is the top-priority requirement

This app is designed to run on very low-spec machines (old/weak hardware in
church/volunteer setups). Performance outranks convenience and code elegance in
every design and review decision. Memory bloat or eager loading that is
invisible on a dev machine makes the app unusable for the target users.

- Do not read or hold data that isn't needed for what's currently on screen —
  load lazily/on demand and release it when no longer used.
- Caches must be short-lived: cache data only for a short period; never
  accumulate long-lived caches that grow memory.
- Weigh memory footprint and I/O cost first when writing or reviewing any
  change; prefer the lighter approach even if it costs a little more code.
- Watch for eager imports, preloading whole files/collections (e.g. bibles,
  media) when only a slice is needed, and unbounded in-memory maps.

### Debounce expensive work fired by frequently-firing events

Wrap expensive work that fires on high-frequency event subscriptions
(`useScreenUpdateEvents`, `useFileSourceEvents`) in a `genTimeoutAttempt(500)`
debounce so rapid repeats collapse into one trailing execution. Exemplar:
`useFileSourceIsOnScreen` in `src/_screen/screenHelpers.ts`.

- **Multi-instance hooks** (one per list item / tab / bible item / stage pane)
  need a **per-instance** timer:
  `const attemptTimeout = useMemo(() => genTimeoutAttempt(500), [])`.
  A module-level shared timer collapses ALL instances into one, leaving N-1
  items stale — that's a bug. It bites hardest when the instances share a
  `filePath`, because then ONE `update` event reaches every one of them and the
  last caller `clearTimeout`s all the others.
- A module-level `const attemptTimeout = genTimeoutAttempt(500)` is fine only
  for helpers that are single-instance **for good** — assume nothing from the
  current mount count. `VarySlidesComp`'s `useVarySlidesData` was listed here as
  the safe example until the Lyric Stage Previewer started mounting one per
  stage over the same file, at which point only one stage ever refreshed.
- Only debounce when the latest result is all that matters (setState). Skip
  cheap callbacks and skip sites whose tests assert synchronous post-event
  state (e.g. `useSlideWrongDimension`) unless you also update the test.
- Event hooks fire callbacks fire-and-forget (not awaited), so converting
  `async () => {...}` to `() => { attemptTimeout(async () => {...}) }` is safe.

## Naming conventions

Every React function component must have a name ending in `Comp`
(e.g. `FormComp`, `ForegroundCountDownComp`).

## Running the app for verification (`npm run dev`)

- The harness shell exports `ELECTRON_RUN_AS_NODE=1` (inherited from VS Code),
  which makes Electron run as plain Node and crash at
  `electron_1.protocol.registerSchemesAsPrivileged` ("Cannot read properties of
  undefined"). Launch with `env -u ELECTRON_RUN_AS_NODE npm run dev`. This looks
  like the dev script being broken; it isn't.
- Dev runs its own profile: `applyLaunchOverrides()` in `electron/index.ts`
  redirects dev's `userData`/`sessionData` to `<userData>-dev` — on Windows
  `%APPDATA%\open-worship-app-dev`, on macOS
  `~/Library/Application Support/open-worship-app-dev` (packaged keeps the
  un-suffixed dir) — so dev and packaged builds hold separate single-instance
  locks and run side by side. Dev app data (settings, bibles, IndexedDB) lives
  in the `-dev` dir, NOT the packaged one. Two higher-precedence overrides
  exist: the `OWA_USER_DATA_PATH` env var and an `--owa-user-data-path=` argv
  value (`findUserDataPathArg`, used by taskbar jump-list relaunch). Only two
  same-kind instances (dev+dev or prod+prod) still conflict.

## Verifying code changes

Always verify any code change against the running app using `owa-devtools` (the
app's own MCP server, `tools/owa-devtools-mcp`). A passing typecheck/build is
not sufficient — take a screenshot of the live app and confirm the change
actually renders/behaves as intended before considering the work done.

The CDP endpoint has **no fixed port** since 2026-08-31: Chromium binds a free
one and the app publishes it (see *Agent access* below). Nothing needs that
number: the project's `./.mcp.json` registers `owa-devtools` →
`node tools/owa-devtools-mcp/bin.mjs`, which discovers the running instance
itself (same thing per-user, if that file is missing:
`claude mcp add owa-devtools -- node tools/owa-devtools-mcp/bin.mjs`). Its tools
arrive as `mcp__owa-devtools__*`: every chrome-devtools tool (`list_pages`,
`take_snapshot`, `click`, `evaluate_script`, …) PLUS app-level ones —
`owa_app_state`, `owa_find_ui`, `owa_list_ui`, `owa_click`, `owa_type`,
`owa_goto_page`, `owa_list_screens`, `owa_hide_screens`, `owa_help_search` /
`owa_help_page`, `owa_guide_start` / `_step` / `_status`.
Reach for those first: `owa_find_ui` locates (and optionally outlines) a control
by its visible text, `owa_list_ui` enumerates the visible controls of a window,
`owa_click` / `owa_type` act on a control by its label, `owa_goto_page`
switches the main window between presenter and reader, and `owa_app_state`
reports which window, page, language and theme are live — all without a
snapshot. `owa_hide_screens` takes content
off a projector, so confirm with the user before calling it. For a client pinned
to a fixed URL, `node tools/owa-devtools-mcp/bin.mjs --bridge --listen=9223`
forwards 9223 to wherever the app is.

After any code change, also run `npm run lint`. It is the full gate: tests
(`test:all`), typecheck (`lint:all:error`), prettier (`lint:pre`, which rewrites
files — expect formatting diffs), eslint with `--max-warnings 0` (`lint:es`),
and a production `build`.

- The `lint` script is `&&`-chained, so the FIRST failing stage stops everything
  after it — a `test:all` failure means `lint:all:error`, `lint:pre`, `lint:es`
  and `build` never ran at all, not that they passed. When a stage fails on
  something unrelated to your change, run the remaining stages directly rather
  than assuming the gate is green. (The long-standing `test:electron` failure on
  `windowOptions.icon` `toContain('icon.png')` vs dev's `icon-dev.png` is FIXED —
  the assertion is now `toMatch(/icon(-dev)?\.png$/)`.)
- Don't pipe `npm run lint` through `tee`/`grep` and trust the exit code — bash
  has no `pipefail`, so the pipeline reports the last command's status and masks
  the real failure. Check the log body, not just the exit code.

## Agent access (`electron/aiHelpers.ts`, `tools/owa-devtools-mcp`)

Everything that makes the app drivable by an agent — the in-app self-help
chatbot first, an outside client second — lives in `electron/aiHelpers.ts` and
the `tools/owa-devtools-mcp` package. Two doors, one discovery file:

- **CDP**: `enableRemoteDebugging()` appends `--remote-debugging-port=0` (any
  free port) BEFORE `ready` and after the single-instance lock. It must stay
  synchronous — Chromium reads the switch when it starts the DevTools handler,
  so an `await`ed free-port lookup loses that race and the app silently gets no
  endpoint. Packaged builds open it too (the chatbot needs it), bound to
  `127.0.0.1`.
- **MCP**: `startMcpHost()` serves `owa-devtools-mcp` over streamable HTTP on
  `OWA_MCP_PORT` (default 39223, next free port if taken). Only `node:http`
  loads at startup; chrome-devtools-mcp and puppeteer are imported on the first
  MCP session. The SAME server is what `./.mcp.json` spawns over stdio for an
  outside agent (as `owa-devtools`), so the chatbot and the agent share one tool
  set — chrome-devtools' plus the `owa_*` ones.
- **Discovery**: `publishAiEndpoints()` writes
  `<temp>/open-worship-app-cdp/<pid>.json` with `{port, url, mcpUrl, isDev,
  userDataPath, startedAt}` — one file per live instance, swept when a pid is
  gone, removed on `will-quit`. Chromium reports its chosen port through
  `<userData>/DevToolsActivePort`, which is polled after `ready`.
- **Master switch**: Settings → Others → *Enable AI features* writes
  `ai-enabled` into `clientSetting` in `<userData>/setting.json`.
  `checkIsAiEnabled()` reads that file directly (before `ready`, before the
  setting manager exists); off means neither door opens, the Help menu drops
  the chatbot item, and the renderer's AI providers refuse to hand out a
  client. It only takes effect on the next launch — that is the point.
  **Unset means OFF in a packaged build and ON in dev**, and the renderer's
  `getIsAIEnabled()` (`src/helper/ai/aiHelpers.ts`) MUST agree with the
  main-process twin or the Settings toggle, the 🤖 button and the provider
  clients contradict a process that opened no door. Nobody gets a CDP endpoint
  by upgrading: anything reaching it drives a renderer with node integration.
- **Knowledge**: `extra-work/build-knowledge.mjs` (part of `electron:build`)
  bundles `docs/manual-sources/**` (kind `manual`) and an ALLOWLIST of
  `.claude/` — `CLAUDE.md`, `memory/`, `skills/` — (kind `internal`) into
  `electron-build/knowledge/` with a search index, so answers
  are one file read, not 140. The main process passes the path in through
  `OWA_KNOWLEDGE_DIR`.
  **Every edit under `.claude/` — `CLAUDE.md`, `memory/`, `skills/` — must
  re-run `node extra-work/build-knowledge.mjs` in the SAME change**, or the
  chatbot keeps answering from the previous text. Run that script ALONE while
  the app is up (`npm run build` / `electron:build` `rm -rf`s all of
  `electron-build/`, the running app's own main entry; this one clears only
  `knowledge/`). No restart is needed — `listKnowledgeEntries()` re-reads
  `index.json` per call — unlike a change to the MCP `.mjs` modules.
- **Chatbot**: `html/chatbot.html` → `src/chatbot/*`, opened by the **🤖**
  toolbar button (`ChatbotButtonComp`, left of Help on both the presenter and
  the reader, hidden with the master switch) or Help → *App Help (Chatbot)*. It
  talks to the MCP host over HTTP (the port comes from
  `main:app:get-ai-endpoints`), and answers from the manual, from live app
  state, and by outlining the real control in the window. It holds several
  conversations at once — a **tab strip** above the head row, persisted whole to
  `local-storage/chatbot-sessions` (`src/chatbot/chatSessionHelpers.ts`, capped
  at 12 tabs × 60 messages, debounced save + `beforeunload` flush). Each tab
  carries a `⋮` (right-clicking the tab does the same) opening its own menu:
  rename, **lock**, close, *Close other chats…*, *Clear all chats…*. The last
  two take more than one conversation, so they are confirmed on a line under
  the strip and `saveChatSessions` on the spot instead of on the debounce; a
  LOCKED tab (`isLocked`) has no `×`, is refused by `handleClosingSession`,
  and is what both of them step around. The
  ENTIRE head row belongs to the tab in front, not to the window: the
  Presenter/Reader switch (which follows the opener window until the user
  presses one), the Claude/ChatGPT switch, and the model picker beside them.
  The provider and model settings (`chatbot-llm-provider`,
  `chatbot-llm-model-<provider>`) are now only what a NEW tab starts on. The
  picker lists three models per provider with speed and list price on the hover
  and a *More models…* that asks the account's own `models.list`; a
  non-reasoning OpenAI model is sent no `reasoning_effort`. Every answer has
  **Copy** and every question **Ask again**; with no key at all the window says
  so and offers a button that opens Settings → Others. It falls back to the
  offline manual bot when a call fails, and is written for a non-technical
  volunteer and English-only: no ids, no paths, manual pages only, and
  `owa_guide_*` can walk them through a task with a numbered card drawn in the
  app window itself.

`chrome-devtools-mcp`'s `usageStatistics` is forced off in `server.mjs`: its
telemetry is a process-wide singleton that throws on the second
`createMcpServer` (one per MCP session), and it would phone home from the
operator's machine.

## Mapping DOM elements to components in dev

The dev server (and only the dev server — `apply: 'serve'` in
`vite-plugin-comp-name.ts`; production DOM has neither attribute) stamps the
root DOM element of every `*Comp` React function component with:

- `data-react-comp-name="<ComponentName>"` — e.g. `RenderBibleLookupHeaderComp`
- `data-react-comp-fp="src/<path>.tsx"` — repo-relative source file, e.g.
  `src/bible-lookup/RenderBibleLookupHeaderComp.tsx`

The DOM carries the **innermost** component's name: when a component's root is
another component, the outer one is not stamped.

Use these when working against the running app via `owa-devtools`:

- To locate a component's element: query `[data-react-comp-name="FooComp"]`.
- To find which source file renders something on screen: read
  `data-react-comp-fp` off the element (or
  `el.closest('[data-react-comp-fp]')`) and open that file directly — no
  grepping class names to find which component rendered what.

## owa-devtools / CDP driving notes

- **Screen output window.** The presentation screen is a separate Electron
  `BrowserWindow` (`screen.tsx` / `ScreenAppComp`, `appProvider.isPageScreen`).
  While it is SHOWING it appears on the CDP endpoint as its own `list_pages`
  target (`https://localhost:3000/screen.html?screenId=N`) and is fully drivable
  (snapshot/click/screenshot the target itself); the target vanishes the moment
  the screen hides. When hidden or during early mount, its console is forwarded:
  `loggerHelpers.callConsole` → `appProvider.messageUtils.sendData('all:app:log', …)`
  → `electron/electronEventListener.ts` `ipcMain.on('all:app:log', …)` →
  electron main-process stdout (the `npm run dev` terminal). Screen-only bugs
  (e.g. full-width PDF) don't reproduce in the presenter's mini-preview, which
  reuses the same components without `isPageScreen`/StrictMode.
- **Monaco editors use the EditContext API.** The editable element is
  `div.monaco-editor .native-edit-context` (there is no classic
  `textarea.inputarea`). Non-mutating commands work via CDP (Ctrl+A, arrow/Home/
  End nav) but model mutations (`type_text`/`Input.insertText`, printable
  `press_key`, `Delete`/`Backspace`) do NOT change the model unless the Electron
  window has genuine OS **foreground** focus. `select_page` bringToFront alone is
  not enough; if real typing is required, ask the user to click the window.
- **Verifying file-drop features.** Synthetic `DragEvent` drops can't exercise
  `readDroppedFiles` (`src/others/droppingFileHelpers.ts`) — `webkitGetAsEntry()`
  returns null for programmatic `DataTransfer`s. The drag-over mimetype gate IS
  testable synthetically (dispatch `dragover` with a typed `File`; canvas opacity
  0.5 = accepted). For the drop pipeline, get the live `CanvasController` by
  walking React fibers up from a shadow-pierced `.slide-canvas-editor` until
  `memoizedProps.value` has `.addNewItems` + `.canvas`, then call the controller
  method directly. A real `video/webm` `File` can be synthesized in-page via
  canvas `captureStream()` + `MediaRecorder`. Restore with the Undo toolbar
  button only (see below). What DOES drive the whole real pipeline: dispatch a
  plain bubbling `Event('drop')` and `Object.defineProperty` a fabricated
  `dataTransfer` onto it — `{items: [{kind: 'file', webkitGetAsEntry: () => ({
  isFile: true }), getAsFile: () => file}]}` — since React only forwards the
  property. Stamp `appFilePath` on the `File` (the electron preload does this
  for real drops) and handlers that resolve a real path, e.g. the presenting flow
  archive import, run end to end against a real file on disk.
- **Never "Discard changed" during automated QA.** Only ever use Undo/Redo
  (non-destructive, reversible) to probe or restore editor state. The toolbar's
  "Discard changed" → "Yes" resets the document to its last-saved-on-disk state
  and permanently clears the undo/redo stack. If a Save button is already enabled
  at the start of a session, the on-screen state is NOT the last-saved state —
  note that before making changes.

## Rendering & event architecture gotchas

- **Shadow-root previews don't get React enter/leave events.** Slide previews
  (`VarySlideRenderComp` → `ShadowingFillParentWidthComp`,
  `src/others/ShadowingFillParentWidthComp.tsx`) render into a separate
  `createRoot` inside a shadow root. React can't synthesize
  `mouseenter`/`mouseleave` across that boundary, so `onMouseEnter`/`onMouseLeave`
  handlers inside the shadow content never fire — use bubbling
  `onMouseOver`/`onMouseOut` (equivalent on childless elements). Dev-HMR of
  modules imported by that inner root can crash with "TypeError: Invalid
  Instance" / "useScreenManager must be used within a Provider" → "Reload is
  needed"; per-file `.histories/` head files stay on disk and remain recoverable.
- **Event dispatch is microtask-async, NOT debounced/deduped.**
  `BasicEventHandler.addPropEvent` (`src/event/EventHandler.ts`) dispatches
  immediately into an async `checkOnEvent`, whose `await checkShouldNext(...)`
  means listeners run on microtasks. There is no `setTimeout` debounce and no
  payload dedup — identical consecutive events all fire (rapid draw points are
  never swallowed). Some flows still hop a real macrotask for other reasons
  (`sendSyncScrollPercentage`'s `setTimeout(0)`, `genTimeoutAttempt` call
  sites), so in jsdom/vitest tests that drive UI through events (e.g.
  open/close via `openAppDocumentEditorExternal` in
  `src/app-document-list/AppDocument.ts`), flushing microtasks may not be
  enough —
  when in doubt wait a real macrotask:
  `await new Promise((r) => setTimeout(r, 25))` inside `act(...)`.

## Printing

- `all:app:print` IPC with an htmlText arg loads the HTML in a hidden
  `BrowserWindow` and runs `previewPrintCurrentWindow` → `printToPDF` → opens a
  "Print Preview" window with the PDF. Load the HTML from a temp `file://` URL,
  NOT a `data:` URL (Chromium caps URLs at 2MB; documents with embedded images
  exceed it and `loadURL` fails silently).
- App/bible-lang @font-face rules must be copied into the print HTML with
  `url()` absolutized (`collectFontFaceCss`) and the electron side must await
  `document.fonts.ready` before `printToPDF`, or glyphs rasterize as fallback.
- Layout: one slide per PDF page, page size == slide px size via
  `@page page-WxH { size: Wpx Hpx; margin: 0 }` + the inline style
  `breakAfter: 'page'` (`appDocumentPrintHelpers.ts:245`, not a raw CSS rule),
  with `preferCSSPageSize: true`. Slides render UNSCALED.
- **If slide HTML ever needs scaling for print, use CSS `zoom`, not
  `transform: scale()`.** Transform only scales painting; the element keeps its
  full-size layout box, and print fragmentation works on layout coordinates, so
  text/boxes crossing a page boundary get silently dropped (backgrounds/images
  print, text vanishes). Verify via the real Print flow (a `print-preview-*.pdf`
  CDP target appears — screenshot it); an iframe in the presenter is continuous
  media with no fragmentation and does NOT prove the PDF is correct. Entry point:
  `printAppDocument` in `src/app-document-list/appDocumentPrintHelpers.ts`.

## Codebase patterns

- **`useAppCurrentRef` (branch refactor10, 2026-07-08).** A codemod converted
  341 `useCallback` hooks to the pattern (wrap unstable deps in a ref, read
  `ref.current` in the callback, empty the deps array, add
  `// eslint-disable-next-line react-hooks/exhaustive-deps` as the last body
  line). Exemplar: `src/_screen/ScreenCloseButtonComp.tsx`. ~63 sites were
  deliberately NOT converted — do not "finish" them blindly: callbacks whose
  identity is in another hook's dependency array (making them stable would stop
  the consuming effect re-running; concentrated in
  `src/presenter-foreground/Foreground*.tsx`, `src/router/layoutHelpers.tsx`,
  `src/others/color/*`, `src/toast/ToastComp.tsx`), and render-prop callbacks
  returning JSX (`src/presenting-flow/PresentingFlowFileComp.tsx`,
  `src/setting/bible-setting/BibleXMLEditorComp.tsx` — both now PARTLY
  converted: only specific callbacks in them remain deliberately unconverted,
  not the whole files). `useAppEffect`/`useMemo` deps were left alone on
  purpose. The hook also has a second, semantically different use as a
  **staleness oracle** for post-`await` state — see the memory
  `useappcurrentref-race-guard`; do not "clean up" such refs as redundant.
- **Test-suite mock gotcha.** Four test files still
  `vi.mock('.../debuggerHelpers')` — a dead path since that module became
  `appHooks`; inert but confusing, and it silently fails to stub `useAppEffect`:
  `src/_screen/screenInfrastructure.test.tsx`,
  `src/app-document-editor/AppDocumentEditorComp.test.tsx`,
  `src/server/appHelpers.test.tsx`, `src/event/KeyboardEventListener.test.tsx`
  (plus a stale `describe('debuggerHelpers')` label in
  `src/helper/appHooks.test.tsx`). Repoint them to `appHooks` via a partial mock
  (`importOriginal`) so `useAppEffect` is overridden to plain `useEffect` while
  sibling exports like `useAppCurrentRef` (used by `useWindowEvent`) survive.
  `appProvider` mocks need `systemUtils.isDev` because `appHooks` reads it at
  module load.

## owa-robot-test skill

`.claude/skills/owa-robot-test` serves two roles: (1) QA robot testing with
honest coverage accounting (`docs/test-paths/coverage-matrix.md`, resumable via
`test-results/robot-test/coverage-<runid>.json`), and (2) the **source of truth
for user-facing documentation** (`references/user-workflows.md`, stable `W-xx`
recipes). When app UI behavior changes, update `user-workflows.md` +
`coverage-matrix.md` in the same change and bump their version dates; never
publish a tutorial step not observed working live.

`.github/skills/owa-robot-test`, `.github/memory/` and
`.github/copilot-instructions.md` are the Copilot MIRROR of this skill, of
`.claude/memory/` and of this file (`.claude/CLAUDE.md`). `.claude/` is the
source of truth: edit here first, then copy across in the SAME change. They have
already diverged more than once (the skill mirror was several revisions and
seven memory files behind; `copilot-instructions.md` missed two CLAUDE.md
updates before being re-synced), so a mirror file that disagrees with its
`.claude/` twin is stale by definition — re-copy it rather than reconciling the
two by hand.

**Screen controlling & presenting testing is mandatory in every run**, whatever
the focus area — presenting to a screen is the app's core purpose and screen-only
bugs never reproduce in the mini-preview. Each run must present a real item,
verify clear-button states, show the screen, drive the `screen.html?screenId=N`
CDP target, then clear/hide/restore. The only exclusion is *leaving* a screen
taken over or touching a display the user says is in live use.

**`presentingFlow` is a tracked MODE, not a focus area.** `/owa-robot-test presentingFlow` runs the
11-phase deep pass (SKILL.md §6f, recipe test-plan §S20, model knowledge-base §14) over
the 69 run-sheet rows `PL-10, PL-29, PL-32..76, PL-81..102` with coverage accounting on
(`coverage-<runid>.json`, `"focus": "presentingFlow"`), a scratch `zz-robot-<runid>` fixture that
is torn down at the end, and the mandatory blocks ridden from the presenting flow itself. The
other PL rows are the Documents/Lyrics lists — same prefix, different subsystem — including
the newer `PL-103..104` (Import From SongSelect) and `PL-105` (Import From Public Domain Songs).

**Media download (video AND audio) is mandatory in every run too** (matrix rows
`MD-01..06`, SKILL.md §6e). `downloadVideoOrAudio` is the only **product** code
path that runs the `yt-dlp`/`ffmpeg`/`qjs` binaries (the dev-only experiments
page `src/experiments/html-in-canvas/youtubeDemo.tsx` also runs yt-dlp via
`resolveMediaStreamUrl` in `src/server/appHelpers.ts`), so a missing or broken
binary passes typecheck, tests, build and every other matrix row —
`checkIsExtraBinInstalled` only checks file existence, never executes. The video half proves the
ffmpeg merge, the audio half proves its mp3 encoder; both use the canonical link
recorded in the matrix. (The matrix lives at
`docs/test-paths/coverage-matrix.md`, not under the skill's `references/`.)

**Those three binaries are NOT bundled with the app** (refactor27). They ship as
a separate `bin-<ver>.tar.gz` the user installs from **Settings → Others → Extra
Binaries** into `<data parent dir>/extra-bin/` (`yt/`, `ffmpeg/bin/`, `qjs/`,
plus `info.json` and the archive itself, which is kept on purpose so a corrupted
binary can be re-extracted offline). Consequences:

- A run on a fresh machine must **install the pack first** (`MD-05`) — a media
  download with it absent raises a confirm dialog that jumps to that panel
  (`MD-06`), which is correct behaviour, not a bug.
- In **dev the download is mocked**: it copies
  `extra-work/experiment-building/release/bin-<ver>.tar.gz`, which
  `extra-work/build-extra-bin.mjs` produces on `npm i` (the `install` npm
  lifecycle → `extra-work/build.sh`). No local pack means nothing to install.
- `electron/client/ytUtils.ts` no longer resolves any path; the renderer passes
  the yt-dlp path in (`src/helper/extra-bin/`). `extra-work/copy-build.mjs`
  still copies `eot2ttf` and `db-exts` — only the three media binaries moved.
- `extra-bin` is deliberately absent from
  `src/setting/directory-setting/dataDirectories.ts`, so it stays out of the
  `.owadata` whole-data archive.

**The media block deletes what it downloaded (`MD-04`).** It is the only part of
a run that writes ~100 MB into the user's data dir, and the app de-duplicates by
suffixing rather than overwriting, so an uncleaned run adds a copy every time —
17 stale copies (≈635 MB) had piled up in
`Desktop\open-worship-data-dev` by 2026-08-07. Sweep the videos/audios dirs
before downloading, and trash both files (row → **Move to Trash**, hidden while
the item is on a screen) as soon as the on-disk evidence is captured. A failed
download also leaves a `temp-*.part` behind. Deleting on disk needs piped
objects, not a glob — the names start with `[MV]` and `[` is a PowerShell
wildcard — and must match the **canonical video's title**, never `*YouTube*`:
the user's own library holds real downloads whose names also end in `- YouTube`.

## owa-enhance-chatbot skill

`.claude/skills/owa-enhance-chatbot` is the counterpart to owa-robot-test for the
**AI subsystem**: robot-test QAs the chatbot (`CB-01..CB-14`), this one changes
it. Scope is everything in *Agent access* above — `src/chatbot/*`,
`tools/owa-devtools-mcp/*`, `electron/aiHelpers.ts`,
`extra-work/build-knowledge.mjs` — with the MCP tool surface as its main subject.

**The chatbot is not good enough yet, and the skill is written as a climb, not as
maintenance.** It carries a six-rung ladder (it answers → answers correctly and
usably → acts reliably → trustworthy under pressure → situational → the fastest
way to use the app; currently around rung 2) and a `references/scoreboard.md` that
takes one row per run — pass rate, leaks, median tool rounds, cost, rung. Every
run must leave the assistant measurably better and say by how much, a question
that passed before must never come back failing, and when the evidence says the
current design *caps* a rung, the finding is that — size the structural change and
put it to the user rather than shaving another 200 tokens off a description.

- **Tool surface IS chatbot performance.** `llmBotHelpers.ts` sends every tool
  `tools/list` returns to the model on EVERY round of the loop
  (`MAX_TOOL_ROUNDS` 10). Measured 2026-08-31: **42 tools, ~8.5k tokens/round,
  ~85k worst case for one question** — 29 of those tools are chrome-devtools' and
  include `evaluate_script`. Baseline it with
  `node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs` (reads
  `mcpUrl` from the published instance file, `--json`, and warns when an acting
  tool is missing from `notify.mjs`'s `ACTING_TOOLS`).
- **Every run researches before it builds** (`references/research.md`): ask the
  live assistant a standing corpus of real volunteer questions, grade each answer
  (correct? actionable? internals leaked? rounds used? did the walkthrough ring
  land?), mine the app for gaps it cannot see or do, and only then implement —
  graded against three axes, *smarter / easier / more impressive*. The argument
  `research` runs that phase alone and ships nothing.
- Tracked work carries stable `EC-xx` ids in the skill's `references/backlog.md`;
  add what you find there even when you don't do it.
- Same mirror rule as owa-robot-test: `.github/skills/owa-enhance-chatbot` is a
  copy, `.claude/` is the source of truth.
- **A tool change is not done until it was driven against the running app.** The
  gate ends in a `build`, which deletes `electron-build/` and kills that app, so
  verify live first and run `npm run lint` last — except knowledge changes, which
  need the build before they exist at all.
