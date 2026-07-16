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

- **Multi-instance hooks** (one per list item / tab / bible item) need a
  **per-instance** timer: `const attemptTimeout = useMemo(() => genTimeoutAttempt(500), [])`.
  A module-level shared timer collapses ALL instances into one, leaving N-1
  items stale — that's a bug.
- A module-level `const attemptTimeout = genTimeoutAttempt(500)` is fine only
  for clearly single-instance helpers (e.g. `VarySlidesComp`'s
  `useVarySlidesData`).
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
  redirects dev's `userData`/`sessionData` to `%APPDATA%\open-worship-app-dev`
  (packaged keeps `%APPDATA%\open-worship-app`), so dev and packaged builds hold
  separate single-instance locks and run side by side. Dev app data (settings,
  bibles, IndexedDB) lives in the `-dev` dir — NOT `%APPDATA%\open-worship-app`.
  Only two same-kind instances (dev+dev or prod+prod) still conflict.

## Verifying code changes

Always verify any code change against the running app using `chrome-devtools`
(the chrome-devtools MCP). A passing typecheck/build is not sufficient — take a
screenshot of the live app and confirm the change actually renders/behaves as
intended before considering the work done. The CDP endpoint is on port 9223.

After any code change, also run `npm run lint`. It is the full gate: tests
(`test:all`), typecheck (`lint:all:error`), prettier (`lint:pre`, which rewrites
files — expect formatting diffs), eslint with `--max-warnings 0` (`lint:es`),
and a production `build`.

- **Known pre-existing lint failure:** `npm run lint` currently aborts at the
  `test:electron` step on an unrelated test —
  `electron/ElectronMainController.test.ts` asserts `windowOptions.icon`
  `toContain('icon.png')` but dev builds use `icon-dev.png`. Because the `lint`
  script is `&&`-chained, `lint:all:error`, `lint:pre`, `lint:es`, and `build`
  never run after it. To validate your own change, run those stages directly.
- Don't pipe `npm run lint` through `tee`/`grep` and trust the exit code — bash
  has no `pipefail`, so the pipeline reports the last command's status and masks
  the real failure. Check the log body, not just the exit code.

## Mapping DOM elements to components in dev

The dev server (and only the dev server — `apply: 'serve'` in
`vite-plugin-comp-name.ts`; production DOM has neither attribute) stamps the
root DOM element of every `*Comp` React function component with:

- `data-react-comp-name="<ComponentName>"` — e.g. `RenderBibleLookupHeaderComp`
- `data-react-comp-fp="src/<path>.tsx"` — repo-relative source file, e.g.
  `src/bible-lookup/RenderBibleLookupHeaderComp.tsx`

The DOM carries the **innermost** component's name: when a component's root is
another component, the outer one is not stamped.

Use these when working against the running app via chrome-devtools:

- To locate a component's element: query `[data-react-comp-name="FooComp"]`.
- To find which source file renders something on screen: read
  `data-react-comp-fp` off the element (or
  `el.closest('[data-react-comp-fp]')`) and open that file directly — no
  grepping class names to find which component rendered what.

## chrome-devtools / CDP driving notes

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
  button only (see below).
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
- **Events dispatch via a real 10ms `setTimeout`.**
  `BasicEventHandler.addPropEvent` (`src/event/EventHandler.ts`) routes every
  fired event through `genTimeoutAttempt(10)` (see `src/helper/timeoutHelpers.ts`),
  debounced/deduped by an MD5 of the payload. So `WindowEventListener.fireEvent`,
  `FileSource.fire*Event`, DirSource events, etc. fire asynchronously on a
  macrotask. In jsdom/vitest tests that drive these events (e.g. open/close via
  `openSlideQuickEdit`), flushing microtasks (`await Promise.resolve()`) is NOT
  enough — wait a real macrotask: `await new Promise((r) => setTimeout(r, 25))`
  inside `act(...)`.

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
  `@page page-WxH { size: Wpx Hpx; margin: 0 }` + `break-after: page`, with
  `preferCSSPageSize: true`. Slides render UNSCALED.
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
  returning JSX (`src/playlist/PlaylistFileComp.tsx`,
  `src/setting/bible-setting/BibleXMLEditorComp.tsx`). `useAppEffect`/`useMemo`
  deps were left alone on purpose.
- **Test-suite mock gotcha.** Many `*.test.tsx` still
  `vi.mock('.../debuggerHelpers')` — a dead path since that module became
  `appHooks`; inert but confusing, and it silently fails to stub `useAppEffect`.
  Repoint them to `appHooks` via a partial mock (`importOriginal`) so
  `useAppEffect` is overridden to plain `useEffect` while sibling exports like
  `useAppCurrentRef` (used by `useWindowEvent`) survive. `appProvider` mocks need
  `systemUtils.isDev` because `appHooks` reads it at module load.

## owa-robot-test skill

`.claude/skills/owa-robot-test` serves two roles: (1) QA robot testing with
honest coverage accounting (`references/coverage-matrix.md`, resumable via
`test-results/robot-test/coverage-<runid>.json`), and (2) the **source of truth
for user-facing documentation** (`references/user-workflows.md`, stable `W-xx`
recipes). When app UI behavior changes, update `user-workflows.md` +
`coverage-matrix.md` in the same change and bump their version dates; never
publish a tutorial step not observed working live. (A stale copy exists under
`.github/skills/owa-robot-test` — don't extend it by accident.)

**Screen controlling & presenting testing is mandatory in every run**, whatever
the focus area — presenting to a screen is the app's core purpose and screen-only
bugs never reproduce in the mini-preview. Each run must present a real item,
verify clear-button states, show the screen, drive the `screen.html?screenId=N`
CDP target, then clear/hide/restore. The only exclusion is *leaving* a screen
taken over or touching a display the user says is in live use.
