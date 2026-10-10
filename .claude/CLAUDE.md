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
- Renderer entry points and `boot.ts` import only leaf helpers. Do not make a
  startup helper import a mixed feature module such as `fileHelpers`,
  `appHelpers` or drag helpers for one small primitive: Rolldown can then put
  document, screen and React server-rendering code in every renderer's static
  closure. Split the primitive into a dependency-light module and re-export it
  from the broad helper for existing callers. Memory `renderer-entry-static-closure`.
- No `infinite` CSS animation of a PAINT property (`color`, `border-color`,
  `text-decoration-color`, `box-shadow`, `background`) on anything that stays
  mounted at rest — run it a few times or animate `opacity`/`transform` only.
  One noted verse held the idle Reader at 235 paints/s (EN-09), one on-screen
  slide card the Presenter at 59 frames/s (EN-10), the Mini Screen's show/hide
  icon the Presenter at 60 frames/s + 120 paints/s for as long as a screen was
  up (EN-19 — invisible to a trace taken with the screen hidden); memory
  `infinite-paint-animation-at-rest`.

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
(e.g. `ScreenCloseButtonComp`, `ForegroundCountDownComp`).

Every label a user reads goes through `tran()` (in render, never at module
scope) with its Khmer string in `src/lang/data/km/index.ts` AND its French
string in `src/lang/data/fr/index.ts`. A missing one THROWS in dev.
`src/lang/tranKeyCoverage.test.ts` fails the gate on any STATIC key without
Khmer, and on any difference between the French and Khmer key sets — write
keys as literals so it can read them (EN-20). A dynamic `tran(prop)` still
needs the live Khmer pass (memory `tran-missing-key-throws-in-dev`).

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
one and the app publishes it (see _Agent access_ below). Nothing needs that
number: the project's `./.mcp.json` registers `owa-devtools` →
`node tools/owa-devtools-mcp/bin.mjs`, which discovers the running instance
itself (same thing per-user, if that file is missing:
`claude mcp add owa-devtools -- node tools/owa-devtools-mcp/bin.mjs`). Its tools
arrive as `mcp__owa-devtools__*`: the chrome-devtools tools the firewall does
not hide (`list_pages`, `take_snapshot`, `click`, …) PLUS app-level ones —
`owa_app_state`, `owa_find_ui`, `owa_list_ui`, `owa_click`, `owa_type`,
`owa_goto_page`, `owa_list_screens`, `owa_hide_screens`, `owa_help_search` /
`owa_help_page`, `owa_list_questions`, `owa_tran`, `owa_guide_start` / `_step`
/ `_status`, `owa_screenshot`, `owa_pick_element`, `owa_highlight_selector`,
`owa_read_website`, `owa_lyric_validate`, `owa_lyric_file`, `owa_slide_file`,
`owa_present_bible`, `owa_foreground`, `owa_bible_item` / `_note` / `_xml`,
`owa_presenting_flow`, `owa_undo`, and — the developer's, withheld from the
chatbot's model — `owa_press_key`, `owa_drag`, `owa_menu`, `owa_scroll`,
`owa_media_file`.
Reach for those first: `owa_find_ui` locates (and optionally outlines) a control
by its visible text, `owa_list_ui` enumerates the visible controls of a window,
`owa_click` / `owa_type` act on a control by its label (`owa_click` right-
or double-clicks with `button` / `clicks`; `owa_press_key`, `owa_drag` and
`owa_menu` press a shortcut, drag by label and use the menu bar), `owa_goto_page`
switches the main window between presenter and reader, and `owa_app_state`
reports which window, page, language and theme are live — all without a
snapshot. `owa_hide_screens` takes content
off a projector, so confirm with the user before calling it. For a client pinned
to a fixed URL, `node tools/owa-devtools-mcp/bin.mjs --bridge --listen=9223`
forwards 9223 to wherever the app is.

After any code change, also run `npm run lint`. It is the full gate, and it only
CHECKS (2026-09-18, `EN-16`): typecheck of `src` AND `electron` (`lint:all:error`
— `tsconfig.json` includes `src` alone, so the second `tsc -p
electron.tsconfig.json --noEmit` is the only electron typecheck outside a build),
tests (`test:all`), prettier `--check` (`lint:pre`; `npm run format` is the
write), eslint with `--max-warnings 0` (`lint:es`), and a production vite build
into a throwaway temp dir (`lint:build`, `extra-work/check-build.mjs`). It writes
nothing in the repo and never touches `dist/` or `electron-build/`, so it is
SAFE beside a running dev app and beside another session's unfinished files —
run it whenever. `npm run build`, `electron:build`, `test:e2e` and `pack:*`
still delete `electron-build/` (memory `build-kills-running-dev-app`).
`src/test-setup/lintGateScripts.test.ts` holds the gate to that — no stage
writes or builds for real, `lint:all:error` names the electron config — and to
**every `**` glob in a script QUOTED**: npm runs scripts with `/bin/sh` on
macOS/Linux, which has no globstar, and an unquoted `src/**/*.ts*` made
`lint:es` lint 573 of 952 files there, skipping every top-level `electron/*.ts`
(`EN-13`); `cmd.exe` expands nothing, so a Windows run never saw it.

- The `lint` script is `&&`-chained, so the FIRST failing stage stops everything
  after it — a `lint:all:error` failure means `test:all`, `lint:pre`, `lint:es`
  and `lint:build` never ran at all, not that they passed. When a stage fails on
  something unrelated to your change, run the remaining stages directly rather
  than assuming the gate is green. (The long-standing `test:electron` failure on
  `windowOptions.icon` `toContain('icon.png')` vs dev's `icon-dev.png` is FIXED —
  the assertion is now `toMatch(/icon(-dev)?\.png$/)`.)
- Don't pipe `npm run lint` through `tee`/`grep` and trust the exit code — bash
  has no `pipefail`, so the pipeline reports the last command's status and masks
  the real failure. Check the log body, not just the exit code.

## Agent access (`electron/aiHelpers.ts`, `tools/owa-devtools-mcp`)

Everything that makes the app drivable by an agent — the in-app chatbot first,
an outside client second. The full notes live in `.claude/rules/`, split by
subsystem. Claude Code loads a rule file by itself once a file matching its
`paths:` is read; **before changing anything in one of these areas, read its
rule file whole** — it records why each thing is the way it is.

- `agent-access.md` — the CDP and MCP doors, the bearer token, the firewall
  (denied tools, destructive interlock, rate limits, secret scrub), discovery,
  the master switch, the chatbot window lockdown, `owa_read_website` and the
  slide-website capture box
- `agent-tools.md` — what each `owa_*` tool does: a press reports its effect,
  the walkthrough card, demos and tips, the screens / state / run-sheet readers,
  Bible and foreground doors, dividers, the picker, document and data tools
  (backup + undo), the focus vocabulary
- `agent-knowledge.md` — the knowledge bundle, `[en:tran:…]` label templates,
  the question corpus, known-question labels, the recipe-id scrub
- `agent-songs.md` — Open Lyric: reading a song page, drafting, finding by
  title, validating
- `chatbot-window.md` — the 🤖 window: tabs, pickers, attachments, `/` commands,
  Report, the AI caution, chips, progress, history, tips
- `chatbot-llm.md` — providers, the tools withheld from the model, prompt
  caching, cost, the spend guard, the stand-in key, provider-issue doors
- `aichat.md` — the ✨ AI Chat `<webview>` window

What holds everywhere:

- **Two doors, one discovery file.** CDP on a free port
  (`--remote-debugging-port=0`, appended synchronously before `ready`); MCP over
  streamable HTTP on `OWA_MCP_PORT` (default 39223) behind a per-launch bearer
  token that never enters a URL, a log, a result or model context.
  `publishAiEndpoints()` writes `<temp>/open-worship-app-cdp/<pid>.json`. A port
  named on purpose (`pinCdpPort`, `OWA_CDP_PORT`) is a PIN: that port or
  nothing. `OWA_CDP_TARGET=dev|prod` selects only that published instance kind
  across restarts; explicit port pins take priority, with no other-kind or
  legacy fallback for a kind selection.
- **The assistant may point, the human presses.** Every renderer has
  `nodeIntegration: true`, so `tools/owa-devtools-mcp/firewall.mjs` refuses and
  hides `evaluate_script` / `take_heapsnapshot` / `upload_file`, allowlists
  navigation, refuses a label that cannot be undone in every language the app
  is shown in (read on the control as well as on the words), rations acting
  calls (25 a minute), web reads and removals (10 per 5 minutes each), and
  scrubs provider keys and tokens out of every result. The off switch is the
  env var `OWA_MCP_FIREWALL=off` only. Never weaken it to make a task easier.
- **Master switch** (Settings → Others → _Enable AI features_, `ai-enabled`):
  unset means OFF in a packaged build and ON in dev, main's `checkIsAiEnabled()`
  and the renderer's `getIsAIEnabled()` must agree, and it takes effect on the
  next launch.
- **Chatbot answers render as TEXT** — no `dangerouslySetInnerHTML` anywhere in
  `src/chatbot/`, ever. Nothing a preload reaches may evaluate a string at load
  (memory `preload-must-not-eval-at-load`).
- **Every edit under `.claude/` — `CLAUDE.md`, `rules/`, `memory/`, `skills/` —
  re-runs `node extra-work/build-knowledge.mjs` in the SAME change**, or the
  chatbot keeps answering from the old text. Run it alone while the app is up
  (`npm run build` deletes `electron-build/`); under `npm run electron:dev` it
  relaunches the dev app. **Whenever the knowledge changes,
  `tools/owa-devtools-mcp/questions/*.json` changes in the same commit**, and the
  manual names a control as `[en:tran:Clear Bible]`, never as an English label.
- **An edited MCP `.mjs` needs a fresh server**: the running host cached its
  modules on its first session (memory `mcp-tool-edit-two-processes`), and
  under `electron:dev` nodemon relaunches the app on any save in
  `tools/owa-devtools-mcp`.
- **Opening either AI window asks a caution first** (`askAiCaution`). For
  automated chatbot verification it stays person-only by default. The one
  exception: when `owa_app_state` confirms a DEVELOPMENT instance and the user
  explicitly authorizes acceptance in the current conversation, automation may
  press that caution's exact **Open** button through the development CDP
  endpoint. A generic "continue" is not consent; it never applies to a
  packaged instance, **Allow more**, projector or destructive confirmations, or
  any other blocking dialog, and it is not a reason to weaken the firewall.

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

Because they are dev-only, nothing shipped may match on them. The one name that
IS in production DOM is `data-widget-name` on every resizable pane — its English
`toWidgetLabel` key, present whether the panel is open or collapsed and whatever
language the app is in. That is what `domMatch.mjs` reads for the parent path
(`Background > Videos`) and for the `inPanel` a match reports.

**A FLOATING panel carries it too** (2026-09-24, `FloatingWidgetComp`'s
`widgetName`, passed by every foreground component). Reported as _"component
shared between background and foreground got highlighted at the same time"_:
each foreground component reuses the Background tabs' own windowed file grid,
so the same file name, folder box and search icon are on screen twice, and the
floating panel drew its name nowhere — everything inside it reported the
Presenter pane BEHIND it as the panel it was in. `owa_find_ui "clock"` answered
four matches with nothing to tell them apart and rang all four. The panel is
named now, so `inPanel` reads `Web Show` against `Background` and a scope picks
one: `Web Show > clock`. Naming it also makes the panel itself a control that
answers to its own name — which is why `checkIsControl` counts `role="menuitem"`
(see the demo catalog in `.claude/rules/agent-tools.md`): the launcher row
that OPENS a panel carries the same words as the panel it opened.

## owa-devtools / CDP driving notes

- **Screen output window.** The presentation screen is a separate Electron
  `BrowserWindow` (`screen.tsx` / `ScreenAppComp`, `appProvider.isPageScreen`).
  While it is SHOWING it appears on the CDP endpoint as its own `list_pages`
  target, `http://127.0.0.1:<port>/screen.html?screenId=N` -- every screen
  window loads from the Screen Mirror server (ports 39240-39259,
  `screenMirrorRuntime.screenUrl`), and from `https://localhost:3000` only
  when that server did not start. It is fully drivable
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
- **Much of the UI is painted only under the mouse.** Toolbars like the
  icons in a bible view's header are laid out the whole time and painted
  away by a `:hover` rule on an ancestor (`visibility` on most such rows;
  that one is `opacity` + `pointer-events: none`, floated over the title's
  end), so `getBoundingClientRect` says they are on screen and a screenshot
  says they are not. `domMatch.mjs` classifies with `checkVisibility` —
  `shown` / `hidden` (painted away, revealable) / `gone` (no box) — reports
  `showsOnHover` on a match, and FORCES the hover before ringing, clicking
  or typing: the page's own `:hover` rules re-aimed at a `data-owa-hover`
  attribute, one reveal at a time, always released. Driving the app by
  hand, remember a control can be real, clickable and invisible at once.
  How a walkthrough step hovers, types into a range or runs a demo:
  `.claude/rules/agent-tools.md`.
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

## Printing, Screen Mirror

Printing slides to PDF — the hidden window, fonts, one slide per page and why
scaling must use `zoom` — is in `.claude/rules/printing.md`. Screen Mirror,
virtual displays, intercom and casting are in `.claude/rules/screen-mirror.md`.

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

## Project skills

Each skill's `SKILL.md` is authoritative for how to run it; the long notes on
all of them are in `.claude/rules/project-skills.md`.

- **`owa-robot-test`** — QA of the running app, and the **source of truth for
  user-facing documentation** (`references/user-workflows.md`, stable `W-xx`
  recipes). When UI behaviour changes, update it and
  `docs/test-paths/coverage-matrix.md` in the same change and bump their dates;
  never publish a tutorial step not observed working live. Every run, whatever
  its focus, presents a real item to a real screen and drives the
  `screen.html?screenId=N` target, and downloads one video AND one audio
  (`MD-01..06`) — the only product path that runs yt-dlp/ffmpeg/qjs, which are
  NOT bundled but installed on demand (memory `extra-bin-on-demand`); the
  media block deletes what it downloaded. `prod` drives the packaged build;
  `presentingFlow` is a tracked mode.
- **`owa-enhance-chatbot`** — the assistant: is the answer right? A six-rung
  ladder and a scoreboard; research before building; `EC-xx`.
- **`owa-enhance-mcp`** — the server itself: what the tools are, cost and are
  allowed to do. Remove → deny → merge → sharpen → add;
  `audit-mcp-tools.mjs --ratchet` holds the model's token ceiling; `MC-xx`.
- **`owa-enhance-aichat`** — the ✨ AI Chat window; the guest stays a
  stranger; `AC-xx`.
- **`owa-enhance`** — the whole app: research, report, then STOP until
  `apply EN-xx`. True for any session driving the live app:
  `performance_start_trace` and `lighthouse_audit` RELOAD the window they aim
  at unless told `reload: false` / `mode: "snapshot"`.
- **`owa-upgrade-unit-test`** — toward 99% line coverage measured over EVERY
  source file by `scripts/coverage-gap.mjs`; `npm run test:coverage` counts
  loaded files only (memory `coverage-number-is-loaded-files-only`). No shared
  `appProvider` mock may come back, and a test must be able to fail.
- **`owa-enhance-agent-docs`** — the agent docs themselves (this file, rules,
  memory, skills, the Codex mirror): fixes what the code contradicts and
  proposes `AD-xx` ways agents could help more. Code is the truth for facts,
  a doc for decisions; history stays history.

**The Codex mirror.** `.claude/` is the source of truth. After any edit under
it, `node extra-work/sync-agent-mirror.mjs` copies it into `.codex/` and
`.agents/skills/` (rules in `AGENTS.md`; a new skill's Codex preamble is written
by hand), and the gate's `agentDocsMirror.test.ts` fails until you do.
