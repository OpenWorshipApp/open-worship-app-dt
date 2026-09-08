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
`owa_help_page`, `owa_tran`, `owa_guide_start` / `_step` / `_status`,
`owa_screenshot`, `owa_pick_element`, `owa_highlight_selector`,
`owa_read_website`, `owa_lyric_validate`, `owa_lyric_file`, `owa_slide_file`.
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
- **Firewall**: `tools/owa-devtools-mcp/firewall.mjs` sits on the one seam both
  doors share (`transport.onmessage`, wrapped AFTER `watchToolCalls` so it is
  outermost and runs FIRST — a refused call must not also raise a banner saying
  the app did it). Every renderer has `nodeIntegration: true`, so
  `evaluate_script` reached `require('os').userInfo()` and
  `require('fs').readFileSync(setting.json)` from a script with NO credential,
  and that tool was in the list sent to the chatbot's model on every round —
  one sentence of injected text in an attachment was a shell on a church's
  computer. The rule is now **the assistant may point, the human presses**:
  `evaluate_script`/`take_heapsnapshot`/`upload_file` are refused AND dropped
  from `tools/list` (both, because a client can call a tool never listed — the
  filter saves ~668 tokens/round, the refusal is the safety); `navigate_page`
  /`new_page` are allowlisted to pages the app serves (reload/back/forward
  carry no address at all and were refused for it — an agent could not reload
  the window in front of it); `owa_click`/`owa_type`
  refuse a label that cannot be undone (delete, trash, discard, erase, remove,
  uninstall, overwrite, *clear all*, *reset all*, factory, sign/log out — NOT
  bare `reset` or `clear`, which are `Reset Widgets Size` and `Clear Bible`);
  **and so do `click`/`fill`/`fill_form`/`drag`, which carry no label at all**
  — they aim by a uid out of a snapshot, so the interlock was two
  `take_snapshot` lines away from being irrelevant, and the label is now
  recovered from the snapshot that minted the uid on its way back out
  (`genUidLabelMemory`, per session, holding ONLY the destructively-worded
  interactive rows — one entry for the presenter's whole tree — replaced
  per page because chrome-devtools mints fresh uids each snapshot, and fed by
  EVERY result because every acting tool takes `includeSnapshot`). It fails
  open on a uid it never saw, deliberately: a uid the model was not shown is
  one it cannot aim with. Only ACTIONABLE roles count, or a verse reading
  "remove" would make its own text unpressable;
  acting calls are capped at 25 per rolling minute ACROSS sessions because the
  thing protected is one window; **`owa_read_website` inverts the URL rule and
  gets a budget of its own** (10 per 5 minutes — a separate counter, because
  the thing protected there is the one network rather than the one window);
  and provider keys, bearer tokens and JWTs are
  scrubbed out of every result — the chatbot calls its provider FROM THE
  RENDERER with the key in a header, so a network log or a snapshot of Settings
  hands it to the model otherwise. A refusal is an `isError` RESULT written FOR
  the model (what, why, what to do instead), never a JSON-RPC error: a block
  that reads as an instruction becomes correct behaviour, one that reads as a
  failure becomes an apology. Off switch is `OWA_MCP_FIREWALL=off`, an env var
  only — nothing on the wire can reach it. `probe-mcp.mjs` walks the policy
  against the live app; it spawns a FRESH server because the running host
  cached `server.mjs` on its first session.
- **A press is reported as what it CHANGED, not as what it hit** (2026-09-03).
  `owa_click` used to answer `clicked: <the control>` and stop, which is a tool
  reporting its own ACTION where the caller needs the action's EFFECT — and a
  model that manages to click something then reports the goal achieved. Asked to
  turn a projector on, it pressed a toolbar-reveal decoration and said *"Done —
  the screen is now showing"* to a room with nothing on the wall. The answer now
  carries `isOnNow` (a control with an on/off state), `didChange`, and
  `unverified` — a SENTENCE, not a flag, because a missing key is something a
  model infers past. The control is read back ~250 ms AFTER the press: this app
  re-renders on an event, so reading it straight away reports the state before.
  Three kinds of evidence, weakest last — a control that is GONE did something, a
  toggle that flipped is the state itself, a label that turned Show into Hide is
  the same fact in words. The other half was the AIM: `handleAutoHide` injected
  four `<i title="Show">` decorations into the presenter's auto-hide footers, and
  `matchTier` ranks an exact label above every looser fit, so the bare word beat
  the screen's own `Toggle showing screen` control every time. They are
  `Reveal Hidden Controls` now — renaming them to *Show Hidden Controls* first
  still won `Show` on a whole-word match, so the word had to LEAVE the label
  rather than move within it. `ShowHideScreen`'s own title went through `tran()`
  in the same change (it was hardcoded English, so the app's most important
  control answered to nothing in a Khmer window), and `owa_list_screens` gained
  `isAnyShowing` and stopped returning Electron's whole `Display` object twice —
  ~2 800 characters to answer "no" is what makes a model skip the check.
- **The walkthrough card presses only what the step NAMES, and only what is
  REACHABLE** (2026-09-08, `guide.mjs` + `domMatch.mjs`, measured by
  `.claude/skills/owa-enhance-chatbot/scripts/demo-failure-rate.mjs`, which
  presses Do it through every step of every recipe, paced under the
  firewall's 25 acting calls a minute). Two things every measure the card had
  was blind to. A control can be on screen by every test — laid out, painted,
  enabled — and behind the Bible Lookup popup, which covers the window: the
  ring was drawn THROUGH the popup onto a line of Genesis and Do it clicked a
  tab nobody could see. `coverOf` asks `elementsFromPoint` what the window
  paints at the control's own centre, `layerOf` names the layer (the modal
  container with its own red ✕; a right-click menu, closed by a click on its
  backdrop; a `.floating-widget`, its toolbar ✕; a blocking confirm / alert /
  input, which is NEVER answered for anyone) — a layer the target sits INSIDE
  is not in its way, or the Foreground widgets' own panel got closed — and the
  first press closes it, the next does the step; `owa_guide_status` says
  `behind`. And the matcher's tiers 1–3 (a whole word inside a longer label,
  a word-start, every word somewhere) are right for a ring near a misspelt
  step and wrong for a click: of 92 presses the harness first counted as
  done, at least ten had pressed the WRONG control — the projector's *Clear
  All [F6]* for the drawing panel's *Clear*, *Break lines following model
  formatting* for *Follow*, the help window opened for a bolded *ASSISTANT*.
  `isPressSafe` (tier 0, or a label part equal to the words once a
  `[shortcut]` and a leading glyph come off, or the very panel asked for) is
  the bar; `findBest` keeps scanning a step's candidates for one that clears
  it (`preferPressSafe`) instead of returning the first candidate's loose
  match; a loose fit is refused with the label it found, reported as
  `nearest`, and never ringed. A step that only describes what to see (*The
  bar under the search box says how many matched*) is `kind: "look"` — Next
  instead of Do it, no failed press, no model round. A bold is read from 1 to
  120 characters (40 dropped W-08's tab row and misaligned the rest; a `**✕**`
  did the same the other way). Pages with no numbered step (W-01, W-09, W-10,
  W-17) walk their bold-led bullets and paragraphs. Do it across the manual:
  wrong presses ≥10 → 0, recipes that start 33 → 37, honest refusals go UP
  because a wrong press is now a refusal that names what it found.
- **Reaching OUT is `owa_read_website`** (2026-09-02), the only tool here that
  opens a socket to somewhere a MODEL chose rather than driving a window the
  operator is already looking at. It answers with a page's text, optionally its
  links and a picture of it, for questions about the world outside the app — a
  link the user pasted, what a Bible translation is. It is NOT a second source
  for how the app works; the system prompt says so, because a page about some
  other worship program handed over as though it were this one is worse than
  "I don't know". The address policy is `tools/owa-devtools-mcp/webUrlPolicy.mjs`,
  enforced at TWO layers that are not the same check twice: the firewall
  refuses synchronously what it can see (scheme, address literals, local names,
  a 600-character cap), and `electron/webPageHelpers.ts` re-checks WITH DNS
  immediately before it connects, which is the authoritative one. Both are
  needed — `localtest.me` is a real public domain whose A record is
  `127.0.0.1`, and loopback is where this app serves its own CDP and MCP doors
  with no credential on either. Node's `new URL()` canonicalises `0177.0.0.1`,
  `2130706433`, `0x7f.1` and `127.1` to `127.0.0.1` before the policy reads
  them, so the checks read the canonical hostname and must never be "improved"
  to match the raw string. The page loads in a window locked down separately
  from every other renderer in this app — no Node, no preload, sandboxed, its
  own memory-only session, popups denied (`window.open` here would reach
  `handlePopupWindowOpen` and its `nodeIntegration: true`), downloads denied,
  permissions denied, audio muted, every redirect re-checked — deliberately NOT
  `captureWebScreenShot`, which runs `webSecurity: false` on the app's own
  session for website canvas items and is a different trust level (`MC-16`).
  What comes back is FENCED as a document that was read rather than as anything
  talking to the model, which is the second line; the first is that no refusal
  in the firewall cares what a page says. Exfiltration is narrowed, not closed:
  a URL is a channel out, so the address is capped, the reads are rationed, and
  every one raises a banner in the operator's window **naming the site**. Two
  things the page script must keep: `\s` needs DOUBLE backslashes in the
  TypeScript template literal or it reaches the page as `s` (which silently
  turned `replace(/\s+/g, ' ')` into "replace runs of the letter s"), and the
  text is cut IN the page so ~80 KB of a long article never crosses the IPC.
- **Writing the user's own documents is `owa_lyric_file` / `owa_slide_file`**
  (2026-09-02) — `list` / `info` / `create` / `update` / `rename` over songs
  (`.owl`, Open Lyric content) and slide documents (`.ows`, document JSON).
  They are the only tools whose effect OUTLIVES the session — a click can be
  clicked again, a created file stays created — so four rules hold, and the
  safety ones live in the worker (`src/helper/agentFileHelpers.ts`) rather
  than the tool, because the worker is what touches the disk: **nothing is
  deleted** (there is no delete action) and `create` never overwrites;
  **`update` writes the EDITING HISTORY, never the file** — undoable with
  Ctrl+Z, left visibly dirty with its `*`, the human presses Save, which is
  *point, don't press* applied to content and is also why a song already on a
  screen is untouched (a presented slide is a snapshot until re-presented); **a
  name is REFUSED, never quietly cleaned**; and **content must pass the app's
  OWN validator**. Two things are checked in TWO places on purpose, the same
  split `webUrlPolicy.mjs` uses. The NAME is checked first in `owaTools.mjs`
  and again at the disk boundary, sharing one module
  (`tools/owa-devtools-mcp/agentFileName.mjs`, plain ESM so the renderer
  bundles what the server runs) — checked first because it used to reach the
  content validator first and answer "your song is malformed" when the real
  complaint was the path in the name, and checked twice because
  `createNewFileDetail` still carries a `// TODO: verify file name before
  create`. The CONTENT is checked by `validateOpenLyric` in the tool (line
  numbers and what to write instead, no round trip — `owa_lyric_validate`
  already owns that grammar) and by the app's own `checkMarkdown` /
  `AppDocument.validate` at the disk boundary. They reach the app the way the
  guide card's rescue does — a page expression fires `owa-agent-file`,
  `domHelpers.ts` relays it, and the worker is imported LAZILY there to dodge
  the app-document/lyric import cycle — because this package may never import
  an app module and open-lyric is browser-only. Two tools rather than one
  merged one is the operator's call, paid for at ~800 tokens a round rather
  than ~450; the lifecycle is written once and the differences live in
  `AGENT_FILE_KIND_MAP`. Both are in `ACTING_TOOL_SET` (a loop must not fill
  somebody's Documents folder) and both name the file in their banner, while
  `list` and `info` stay silent like every other read. **Open Lyric Config
  fields need a leading `- `** (`- Title: ...`) — the mistake a model makes,
  now named in the refusal.
- **The chatbot window is locked down separately.** It is the one renderer
  whose content comes from outside the machine and the one holding the API
  keys. `electron/client/rendererLockdown.ts`, called from the preload AFTER
  `fullProvider` has finished requiring, takes `require`/`module`/`exports`/
  `__dirname`/`__filename` off `chatbot.html` and replaces `process` with a
  frozen decoy holding an empty `env` — a decoy, not a deletion, because every
  SDK in that window probes `process.env` on start-up and would throw instead
  of shrugging, and the empty `env` also closes reading the launch
  environment's secrets plus `binding`/`dlopen`/`mainModule`. A global that
  will not delete is redefined as a thrower; one that survives that is reported
  as NOT revoked, because a lockdown that quietly did nothing is worse than
  none. `html/chatbot.html` also carries its own CSP, tighter than the app-wide
  one: `connect-src` names the assistants it may speak to plus the loopback MCP
  host and nothing else, so an answer that tried to post the user's key
  somewhere has nowhere to send it. None of that is the FIRST line — the first
  line is that answers render as TEXT, there is no `dangerouslySetInnerHTML`
  anywhere in `src/chatbot/` and there must never be one.
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
  It also lifts the app's own `tran()` dictionary out of
  `src/lang/data/<code>/index.ts` into `knowledge/tran.json`.
  **Every edit under `.claude/` — `CLAUDE.md`, `memory/`, `skills/` — must
  re-run `node extra-work/build-knowledge.mjs` in the SAME change**, or the
  chatbot keeps answering from the previous text. Run that script ALONE while
  the app is up (`npm run build` / `electron:build` `rm -rf`s all of
  `electron-build/`, the running app's own main entry; this one clears only
  `knowledge/`). No restart is needed — `listKnowledgeEntries()` re-reads
  `index.json` per call — unlike a change to the MCP `.mjs` modules.
- **Labels are i18n templates**: the knowledge is English, the buttons are not.
  A document names a control as `[en:tran:Clear Bible]`, never as an English
  label with a hand-written Khmer twin beside it, and `tran.mjs` fills it in
  with what that key reads as in the language the app is DISPLAYING — so
  `owa_help_search`, `owa_help_page` and a guide card built from a recipe all
  come back already in the user's own language, and a guide's `find` matches the
  DOM instead of missing every control in a Khmer window. `owa_tran` answers the
  same question for a label the model wrote itself, and `owa_find_ui` /
  `owa_click` / `owa_type` try the translation when the English label matches
  nothing. The key must be a real `tran()` key: an unknown one silently falls
  back to its own English text, so `tran.test.mjs` walks the whole corpus and
  fails on one that no language can translate — and on a twin coming back. The
  chatbot ANSWER stays English-only; only the button names inside it move.
- **Questions**: `tools/owa-devtools-mcp/questions/*.json` is the curated list of
  questions the assistant is prepared to be asked — one file per page
  (`presenter`, `reader`, `editor`, `settings`, `screen`, `presenting-flow`,
  `troubleshooting`, and `common` for what is true everywhere), split into
  sections
  matching the panel the user is looking at, each entry carrying the resources
  that answer it (`recipe` `W-xx`, `related`, `find`, `menu`, `shortcut`,
  `tools`, `guide`) so a lookup replaces a search round. It feeds the ask box's
  **type-ahead suggestions**, its "Try asking" chips (via `starterRank` — there
  is no hardcoded list any more, only a `FALLBACK_STARTERS` for a failed import)
  and the `owa_list_questions` tool. **Whenever the knowledge changes, this
  folder changes in the SAME commit** — a new or reworded `W-xx`, a renamed
  control, a new or removed feature — and the file's `updated` date is bumped; a
  suggestion the assistant cannot answer is worse than no suggestion.
  `questionMatch.mjs` holds the one ranking both consumers run (deliberately no
  `node:fs`, so the renderer bundles the same module the server runs);
  `questions.mjs` is the disk-reading wrapper; `questions/schema.json` documents
  every field; `questions.test.mjs` runs against the REAL corpus and fails on a
  question with no recipe and no tool, a duplicate id, a malformed recipe id, a
  recipe with **no page on disk** under `docs/manual-sources/`, or a demoted
  starter. That page check is not the id check: `W-01b` passed the id PATTERN
  for months while `build-manual.mjs` matched `W-\d+` only, so its `### W-01b`
  heading was never read as a heading, the recipe was silently folded into
  W-01's page, and four supported questions named a document that did not exist.
  That generator now takes an optional letter and THROWS on a `### W-` heading
  it cannot parse — a recipe must never be absorbed in silence.
  **Adding a page file is adding a file**: the file NAME is
  the page id and everything else reads the directory — the loader, the ask
  box's `import.meta.glob`, and `owa_list_questions`' `page` enum through
  `listQuestionPageIds()` (names only, no parse). `starterRank` is the one
  field that is not local to its file: the empty window sorts every starter a
  focus can see, so ranks must be unique ACROSS the files sharing a focus, and
  a rank in a `focus: null` file (`common`, `troubleshooting`) competes in
  EVERY window. A new question is safest with no rank at all. A page file's
  `focus` may also be a LIST, for one that belongs to several windows.
  `questions.test.mjs` now enforces the uniqueness rule (it was prose only, and
  already broken) and checks every declared focus against `botFocus.mjs`.
  `FALLBACK_STARTERS` in `questionHelpers.ts` is a hand-written copy of each
  window's opening four for when the corpus fails to load; a test holds the two
  together, because nothing in normal use would ever show it had gone stale.
- **A song PAGE is not a song** (2026-09-04,
  `tools/owa-devtools-mcp/lyricPageText.mjs`, gated by `checkIsPageText` so a
  plain paste is untouched). A chord site serves the song inside a toolbar, a
  strumming diagram, a fretboard chart, a related-songs rail and a footer, and
  lays the words out in COLUMNS that text extraction flattens to one fragment
  per line — `|`, `E`, three words, `|`, `A`, four more. Read as lyrics that is
  bar lines sung out loud and every line broken in half. Four rules, none of
  them about any particular site: the song is the REGION between the walls of
  wordless lines (a chart is a wall; scored on CHORDS first, because a footer
  has as many words as a verse and no chords, and word-count alone picked the
  footer), fragments rejoin with NOTHING between them (a chord lands mid-word
  more often than between words, and where it lands between them the page's own
  trailing space is still on the fragment — so `toCleanLines` must not strip it
  before this runs), a fragment following a fragment starts a NEW line, and a
  label never joins to anything (a chord between `Verse 1:` and its words made
  them one line, found no labels, and drafted a whole hymn as a single verse).
  **The rule that was missing is the one the user could see**: a chord site does
  not print `|` and `D` as two things — it prints `|D`, one token, glued to the
  syllable it lands on — and that matched neither the bar pattern nor
  open-lyric's chord pattern, so every chord on such a page read as an ordinary
  WORD. The row then never joined (a bare word line following a bare word line
  flushes), so one sung line came out as four, each with `|D` sitting in front
  of it as text somebody sings. `readChordToken` pulls the bar off the chord,
  `splitLeadingChords` takes the run off the front of the words, and the chord
  is WRITTEN where it lands rather than dropped: `|[D]`, **bar OUTSIDE the
  brackets**, because `[|D]` — which is what the page looks like and what
  anybody would reach for first — is refused by open-lyric and by our own
  validator alike (the brackets hold a chord symbol, and a root is `A`–`G`).
  Both forms were probed against `checkMarkdown` before the form was chosen and
  the probe is kept as a test. `toSafeLyricLine`, whose job is to rub out every
  bracket, now keeps exactly the ones holding a chord — it was turning
  `|[D]morning` back into `|(D)morning` one line later. **A page that hands a
  whole ROW over at once puts every chord but the first in the MIDDLE of the
  text** (2026-09-02), and `splitLeadingChords` only ever read the front: a
  Khmer draft came out `|[D]ខ្ញុំ |D ឡើង |D ឡើង |A អស់`, bracketed once and sung
  three times. `writeInlineChords` walks the rest of the row under the same
  three tests and the same one-chord-per-run rule, glued to the word after it;
  the script test there is made against the row's WORDS with the chord tokens
  taken out, because a `|D` three words on is a Latin letter too and made a
  bare `A7` in a Khmer line read as a word. Two bounds hold it: a
  leading chord is taken as a chord only when the page wrote a BAR on it, or the
  rest of the line is in another script entirely, or the page has been shown to
  glue its chords AND the token is more than one character — because `A` is a
  chord and also a word in half the languages written in Latin script; and a run
  of SEVERAL chords before one fragment writes nothing at all, since it says
  which chords are played and not where any of them lands (a fretboard chart is
  four chord lines in a row, and its last one was landing on the licence line
  printed under the chart). Two more fell out of the same page. A wall is only
  broken by a line of WORDS, so the `|` and the chord over the first syllable
  sat INSIDE the wall that ends the page furniture and the song's opening
  chord — the one that says where to start — was the only one missing from the
  whole document; `toRegions` now carries that run into the region it opens and
  deliberately does NOT count it, because three chords is exactly what
  `pickLyricRegion` takes as proof a region is a song, and three carried ones
  handed that proof to the view-count line under a fretboard chart, which then
  won on word count and was drafted as the entire song. And nothing printed
  UNDER a credit line is a translation of it: `Guitar chords` was pairing with
  the songwriter's name above it, and because the tail sweep stops at
  translations the pair rode into the last verse as its closing couplet.
  Measured on the page this came from: four verses, three lines each, every
  chord where the page puts it, and the two furniture lines named in the report
  instead of sung. **Two of the page's own facts ride out with the song**: its
  address, off `owa_read_website`'s header line and ONLY from in front of the
  fence — the header is written by this package and the body by a stranger, so
  a `Read https://…` planted in a page cannot be filed as the song's source —
  which becomes `- Attachments:`, the field open-lyric keeps a song's link in
  and the Public Domain Songs importer already fills; and the copyright notice,
  which most pages print in the FOOTER, nowhere near the song and outside the
  region this file works to isolate, so a page that says whose the song is in
  plain sight was producing `Copyright: Unknown`. That one is read from the
  BOTTOM up, trimmed at the footer's own menu (`© 2026 Somebody | Terms of
  Service | Privacy Policy`), and only ever a real notice — the SIGN or
  `(c) 2026`, never the bare word, which is a menu item (`Copyright Policy`)
  whose name would otherwise land in the song's own field.
  A page with no chords at all — a hymn-text site — is a different document and
  gets its own reader, keyed on LINE LENGTH: a menu item is two words, a sung
  line is eight. Nothing sniffs for that one; `stripWebsiteWrapper` finding its
  fence is the proof the text came off a page. **Length alone was wrong on a
  hymnal's own text page** (2026-09-08): *Printable scores: PDF, MusicXML* is
  four words, so the region ran ninety lines and drafted sixteen verses of
  menus. Where such a page prints its stanzas NUMBERED (`1 Amazing grace…`),
  `pickNumberedStanzas` takes the run 1…n (plus a labelled refrain among or
  after them) as the song, and `readPageFields` reads the `Title:` /
  `Author:` / `Copyright:` table it prints far below the words — *Public
  Domain* was in plain sight and the draft said *Unknown*. Neither model
  hands a page over whole whatever the prompt says, so the drafter also reads
  what they DO pass: their own copy with a title line and `Tune:` on top, and
  `from`/`to` around the stanzas — the markers are believed on plain words
  now, a short unlabelled block above numbered stanzas is dropped as the
  heading (and names the song when nothing else did), a `copyright` slot takes
  what the page said, and with no `mode` plain words are drafted rather than
  "checked". Four things it reads that
  nothing else could: `Key: D · Time: 4/4 · Tempo: 73bpm` off the strip a page
  prints it in (checked against open-lyric's closed sets first — a key it has
  no name for defaults instead of taking the whole song down to tier 2), a
  verse number in the script the hymnal is PRINTED in (`១.`; every rule that
  reads a numeral goes through `toAsciiDigits`), `(2x)` on a label and
  `Repeat Chorus` as the PLAY ORDER rather than as more words, and — the one
  worth the most — a Latin line under a non-Latin one as its TRANSLATION,
  which open-lyric already has a place for (an indented line, schema.md §2, no
  `Locales` needed). That is the only indent `toSafeLyricLine` keeps, and it is
  safe only because this module flattens every tab it is given before re-adding
  exactly one. **It reports the area it chose**, first line to last, because
  the thing most likely to be wrong about a drafted song is not its notation
  but WHICH PART OF THE PAGE it came from; `from`/`to` are how a caller who can
  see the page overrides it. Measured over 14 real song pages: 14/14 valid,
  structures matching the page's own play order. `owa_read_website`'s
  screenshot became WHOLE-PAGE in the same change (capped at 2400px — it was a
  768px viewport, which on a song page is the site's toolbar and nothing else),
  and its `executeJavaScript` gained a timeout: without one a heavy page never
  settled, the `finally` never ran, and two hidden windows were left alive with
  every later read timing out against them.
- **Writing a song from whatever the user has**: `owa_lyric_validate` with
  `mode: "draft"` (2026-09-03, `tools/owa-devtools-mcp/openLyricDraft.mjs`)
  takes RAW words — a paste, the text of a page `owa_read_website` fetched, a
  file dropped on the chat window — and writes the notation. A MODE on the
  existing tool rather than a tool of its own: +61 tokens a round against
  ~450 for a second registration. **The model may not write this format and
  the prompt says so**, because measured against the real validator a
  plausible attempt makes 9 mistakes and a CAREFUL one still makes 2 — `CC`
  where `Cx2` is required, and free text inside `Instrumental`, which takes
  chords only. Both are invisible from the outside, so no amount of prompt
  text fixes them. Everything emitted is round-tripped through
  `validateOpenLyric` before it is returned, so a drift cannot quietly produce
  a broken song, only a report saying it is broken; when tier 1 is refused for
  any reason tier 2 rebuilds every part as `Breakdown`, the fence open-lyric
  does not look inside. `[Instrumental]` is RECOGNISED as a label and sent to
  `Breakdown` — leaving it out of the label map does not keep it away from
  that fence, it stops the line being read as a label at all and the word
  becomes a lyric somebody sings. The trap nothing else here guards is that
  **an indented line is the TRANSLATION of the line above it**: a hymn scrape
  is full of leading whitespace, it stays valid, and no validator would ever
  catch it. In the chatbot the draft never reaches the answer as text —
  `applyToolWatch` lifts it out of the tool RESULT and mints two buttons
  (`lyricDraftHelpers.ts`, pseudo-tools the server does not register, exactly
  like the Report send): **Create "<title>"**, which finds a free name and
  goes through `owa_lyric_file` so the whole hardened path applies, and
  **Copy song text**. It IS shown, though: `RenderLyricPreviewComp` draws the
  document in a read-only box above those buttons, off the same in-memory
  reference they use — keeping the notation out of the ANSWER had also kept it
  out of sight, so the one thing the user is being asked to approve was the one
  thing they could not look at. Nothing new is persisted by it, so a window
  reopened since draws no box rather than an empty song. **Those two buttons
  are the ONLY thing to press under a draft** (2026-09-08): a model's own
  `OPTIONS:` pills — *Create the file*, *Copy the text* — are drawn brighter
  than the real buttons, and pressing one sends the words to a model that
  retypes the notation by hand, fails the validator twice, hits the taken
  name and offers to *Overwrite the old one*; `checkIsDraftEcho` drops them
  beside those buttons, and no corpus follow-ups are offered under a draft.
  **The offline bot drafts a lyric paste itself** (`checkIsLyricPaste` →
  `answerLyricPaste` in `helpBotHelpers.ts`, same two buttons): on Kimi's
  FREE tier a paste that follows the chip's own two rounds is a 429, and the
  manual was being searched for sixteen lines of Amazing Grace. And a create
  under a taken name is refused WITH the free name (`findFreeName` in the
  worker), because *use "update"* first had a model offering to overwrite.
  A created song answers with two chips: **Show it in the
  list**, a `SHOWS:`-style control ref scoped `Document List > <name>` that
  RINGS the new row in the window behind at press time, and the file itself,
  which opens its folder. Fixing that exposed a chip tooltip which had promised
  *press to open its folder* for every named-control chip the assistant has
  ever offered. The document rides a bounded in-memory map, never the session
  file.
- **Checking a song**: `owa_lyric_validate`
  (`tools/owa-devtools-mcp/openLyric.mjs`) takes song text and answers with
  every mistake — line, section, and what to write instead — then what the song
  IS: title, key, tempo, its sections and their play order. It is the ONE tool
  here that asks the app nothing, so it works with no window open and while the
  user is still typing. It deliberately does NOT call open-lyric: that
  package's validator takes a Monaco model and pushes markers into an editor,
  its one headless entry (`api.document.checkMarkdown`) answers a **boolean** —
  which is the one thing this tool must not answer — and reaching either drags
  an 863 KB monaco-touching bundle into a plain-node server. So the grammar is
  written out, and **two tests are what stop it drifting**: `openLyric.test.mjs`
  re-reads `node_modules/open-lyric/schema.md` §8.1 (the machine-readable
  grammar the package ships) and fails when a table disagrees — fences,
  structure codes, Config fields, `Key`/`Time` enums, all 229 locale tags, the
  chord pattern character for character; and `openLyricOracle.test.mjs` runs
  122 documents through open-lyric's own `checkMarkdown` AND through ours and
  fails on a disagreement. Both were written first, against the live oracle,
  which is what caught the `(2x)` repeat being refused. `problems` are what the
  editor rejects the song for; `warnings` are what it accepts and a musician
  still wants (a section `Structure` never plays, a `{p: #3}` pointing past the
  patterns `Config` lists) — both probed as accepted, so neither may be raised
  as an error. A `Structure` that broke mid-way reports its play order marked
  PARTIAL and accuses nothing of being unplayed: past the broken token, unread
  is not the same as unplayed.
- **Two things every window carries**: `AppWindowToolsComp`
  (`src/others/`) mounts `PresentingControlComp` and `AppAssistantComp` on all
  nine renderer entries — presenter, reader, appDocumentEditor, bibleNote,
  setting, webEditor, lwShare, lyricEditor, experiment — and deliberately NOT on
  `about`, `chatbot`, `finder` or `screen` (an overlay or a help window on the
  projector is the one place they must never appear). Both draw nothing until
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
  take *Start Controlling* away from the presenter. Both pass
  `{ isRoutedToFocusedWindow: true }`, which routes the click to the window in
  front instead; `lang`, `file`, `insert` and `view` keep owner routing on
  purpose.
- **The focus vocabulary is declared ONCE**, in
  `tools/owa-devtools-mcp/botFocus.mjs` (no `node:fs`, so the renderer bundles
  the module the server runs). Eight windows, each `{key, label, window,
  isMainWindow, howToOpen, openFind}`, and the `key` is NOT a label: it is
  spliced into `page: "<key>.html"` by `owa_find_ui`/`owa_app_state`, so it
  must stay the
  html base name. It used to be a two-value union written out by hand in the
  type, the picker list, the opener sniff, the session validator, the fallback
  starters, two zod enums and a `focus !== 'presenter' && focus !== 'reader'`
  guard. `isMainWindow` is what tells `genSystemPrompt` whether `owa_goto_page`
  can take the user there at all — three of the eight are pages the ONE main
  window navigates between, and that tool's enum is DERIVED from them
  (`BOT_MAIN_WINDOW_PAGES`), having refused the Document Editor for as long as
  the prompt had been promising it. The rest have to be OPENED, and `openFind`
  names the one control that opens each where one does — only Settings, of the
  five; three need something selected first and one lives in the native menu
  bar. Those names are read the other way round too: `detectRecipeWindow` takes
  the window a RECIPE is about out of its own first step (the one the drop
  rule throws away), and `owa_guide_start` uses it OVER the page it was asked
  for — a recipe about Settings walked in the Presenter rings whatever word
  happens to match there, reported as a card about Settings ringing a Bible
  version off “Language: click **English**”, that button reading `KJV English
  KJV`. 5 of the 44 recipes name one window; the rest keep the caller's page.
  Between them those fields are why a walkthrough of a window nobody
  opened now opens it instead of reporting that it is not there: the chatbot's
  `genPageOpenAnswer` navigates or presses, starts the walkthrough it was asked
  for, and falls back to that window's own `howToOpen` words — once, never in a
  loop (`runBotAction`'s `canOpenPage`). **A tool's own error text may never
  reach the user**: `describeActionError` is the one place a failed button press
  is put into words, and the reason goes to the log. It used to be printed at
  them, naming page files and the list of open windows.
- **Chatbot**: `html/chatbot.html` → `src/chatbot/*`, opened by the **🤖**
  toolbar button (`ChatbotButtonComp`, left of Help on the presenter, the slide
  editor and the reader — the only windows with a top bar — hidden with the
  master switch), by Help → *App Help (Chatbot)*, or from anywhere by
  `AppAssistantComp` (above). It
  talks to the MCP host over HTTP (the port comes from
  `main:app:get-ai-endpoints`), and answers from the manual, from live app
  state, and by outlining the real control in the window. Each question goes
  back with the tab's own recent turns behind it (`toHistoryTurns`: 6 turns,
  clipped, 2400 chars, oldest dropped first) — bounded because the history
  rides EVERY round of the tool loop, and clipped at BOTH ends because an
  answer's last line is the offer a "yes" is answering. It holds several
  conversations at once — a **tab strip** above the head row, persisted whole to
  `local-storage/chatbot-sessions` (`src/chatbot/chatSessionHelpers.ts`, capped
  at 12 tabs × 60 messages, debounced save + `beforeunload` flush). Each tab
  carries a `⋮` (right-clicking the tab does the same) opening its own menu:
  rename, **lock**, close, *Close other chats…*, *Clear all chats…*. The last
  two take more than one conversation, so they are confirmed on a line under
  the strip and `saveChatSessions` on the spot instead of on the debounce; a
  LOCKED tab (`isLocked`) has no `×`, is refused by `handleClosingSession`,
  and is what both of them step around. The
  ENTIRE head row belongs to the tab in front, not to the window, and it is
  three `<select>`s: the *asking about* one (eight windows from
  `BOT_FOCUS_LIST`, following the opener window until the user picks one), the
  assistant one, and the model picker. The
  first two were segmented button pairs until 2026-09-01 — six uppercase words
  spent most of a 460px window on two either/or choices and ellipsised the
  model name, and a third provider would not have fitted at all. A provider
  with no key is a disabled `<option>` reading `<name> — needs an API key`,
  in the option TEXT: Windows draws no tooltip over an OS-drawn list row. Their
  `aria-label`s must stay distinct (`Which part of the app` / `Which assistant
  answers` / `Which model answers`) — the last two used to share one string,
  which was survivable only while one of them was a `<div>`;
  `extra-work/verify-chatbot-e2e.mjs` finds all three by that label.
  The provider and model settings (`chatbot-llm-provider`,
  `chatbot-llm-model-<provider>`) are now only what a NEW tab starts on. The
  picker lists three models per provider with speed and list price on the hover
  and a *More models…* that asks the account's own `models.list`; a
  non-reasoning OpenAI model is sent no `reasoning_effort`.
  **Four providers since 2026-09-01**: Claude, ChatGPT, **Kimi**
  (Moonshot) and **Free**. Kimi speaks OpenAI's protocol, so one loop serves
  all three of the OpenAI-shaped ones — a small
  descriptor per provider (`OpenAiCompatProviderType`: client, label,
  `genRequestExtra`, an optional chat-model filter, an optional round cap) is
  all that differs, and
  `src/helper/ai/kimiHelpers.ts` is the OpenAI SDK pointed at
  `https://api.moonshot.ai/v1`. Its budget rule is NOT OpenAI's: every Kimi
  model offered thinks before it answers, so all of them get the 6000-token
  budget, while `reasoning_effort` goes only to `kimi-k3` — the K2 family
  rejects the parameter and takes a `thinking` object instead. Its catalogue
  needs no filter (Moonshot lists chat models only); reusing OpenAI's pattern
  there would silently return nothing. **The provider set is declared ONCE**,
  in `LLM_PROVIDER_MAP`, with `Record<LlmProviderType, …>` lookups for the ask
  and list-models paths and a `keyField` naming its credential — three two-way
  ternaries used to decide that, and each sent an unrecognised provider to
  OpenAI without a word. `chatSessionHelpers` keeps its own
  `Record<LlmProviderType, true>` so a saved tab's provider survives a reload
  without dragging the SDKs into that module.
  **The fourth needs no key at all** (`src/helper/ai/freeHelpers.ts`): `Free` is
  two public services — LLM7 (`api.llm7.io`, the default) and Kilo Code
  (`api.kilo.ai`) — and the SERVICE is a property of the MODEL, not of the
  user's choice, so `getInstance` takes the model and `getFreeService` resolves
  it. Its `keyField` is UNSET, and that is the whole mechanism: unset means
  always available, and the map's order puts it LAST, so any real key still
  outranks it while a fresh install lands on it automatically. Only one free
  model can see a picture (`stepfun/step-3.7-flash:free`, on Kilo), and *More
  models…* is hidden for it — both hosts answer with a catalogue that is mostly
  paid and mostly toolless, so the row would offer a model that cannot do the
  job. It carries a `warning` no other provider has, drawn STICKY at the top of
  the log (a notice scrolled past has stopped warning anybody) and repeated in
  Settings while no key is set: the questions and attachments leave the machine
  and may be kept. It also carries `warningLinks`, built off `FREE_SERVICE_MAP`
  so the two disclosures cannot come to name different companies — these are the
  only providers the user has no account with and agreed nothing to, so the
  window opens each one's own site rather than asking them to accept a stranger
  on the app's word. In Settings those links must NOT reuse
  `RenderOpenPageButtonComp`: it puts its label and title through `tran()`,
  which THROWS on a missing key in dev, and a company name and a URL are not
  translatable strings. The notice folds itself after ~9s to its own first
  sentence (which still names both services) and a fold by hand sticks. Free models are not merely weaker but differently BROKEN, and
  three guards in the loop exist only for them: `toCleanToolName` cuts a harmony
  `<|channel|>` marker a gateway leaked INTO the function name, a
  `maxToolRounds` of 6 stops one question costing ~79k tokens for no answer at
  all, and a 429 arriving mid-loop buys ONE tools-less salvage round instead of
  discarding every tool result already gathered. `checkIsReadableReply` in
  `quickReplyHelpers` drops an option with no Latin letter in it — a weak model
  keeps "answer in English" in the prose and loses it in the `OPTIONS:` line —
  while keeping one that merely names a translated button. Every answer has
  **Copy** and every question **Ask again**, and **every answer ends with a row
  of things the user can PRESS instead of typing** — the model writes them on an
  `OPTIONS:` line that `parseAnswerOptions` (`src/chatbot/quickReplyHelpers.ts`)
  strips off whether or not it parsed, and whether it sits on its own line or
  inline at the end of the last sentence; when the model writes none the window
  reads the answer's own trailing yes/no or either-or question, and failing that
  offers the nearest questions from the corpus (`genFollowUpQuestions`). Only
  the LAST message shows them — a stale one-press "Yes" would be answering the
  wrong question — they never duplicate an action button, and the two rows
  together are capped at 5. The **walkthrough** buttons beside them
  (`genGuideActions`) walk the recipe the model actually SETTLED on, which is
  not the same as the one it first searched for: `applyToolWatch` prefers the
  page it opened with `owa_help_page` (last one wins), lets a later search
  overwrite an earlier one, and offers nothing at all once the model has
  started its own card. Latching the first search's top hit is what put an
  eight-step walkthrough of the keyboard screencast under a correct answer
  about the mini screen — `runBotAction` starts the guide with those args
  before the model is asked anything, so a stale id is pressed, not reviewed.
  **An answer on its way can be STOPPED** — the Ask
  button becomes Stop while it is coming, Escape does the same (ignored while
  the caret is in a field), and both mean the request is ABORTED, not ignored:
  one `AbortSignal` per ask (`src/chatbot/cancelHelpers.ts`) runs through
  `askLlmBot` into both providers' request options and into every `callTool`
  fetch, and the round loop checks it before buying another round. A stop is
  said in the transcript AT THE PRESS, not when the dropped call gets round to
  rejecting, and it must never be dressed as a failure: `describeLlmError`
  reads an abort as an unreachable service, and falling through to the offline
  bot would answer a question the user just called off. The busy flag is the
  pending list's length, because two asks can overlap (a stuck guide card asks
  while the user's own question runs) and the first one home used to take the
  other's spinner with it. What it does NOT undo is a tool that already
  clicked something. With no key at all the window says
  so and offers a button that opens Settings → Others. It falls back to the
  offline manual bot when a call fails, and is written for a non-technical
  volunteer and English-only: no ids, no paths, manual pages only, and
  `owa_guide_*` can walk them through a task with a numbered card drawn in the
  app window itself. **A step the card cannot press asks the model instead of
  apologising**: `owa-guide-help` (card) → `all:app:guide-help` (`domHelpers`)
  → `askGuideHelp` (main) → the chat window, which asks with the live app in
  front of it and sends one line back the same way onto the CARD — the chat
  window is minimised for the length of a walkthrough and restoring it would
  cover the control being pointed at. 68 of the manual's 251 steps used to end
  there. Once per step per run, bounded by a 30s wait, and `unavailable` (the
  old plain instruction) when nothing is listening. The model is held to
  `DO: <instruction>` and the code parses it out — told merely not to narrate,
  a small model still opened 3 answers in 4 with "I can see the verse ...".
  `owa_guide_status` reports it as `help`. **Starting a walkthrough minimises the chatbot window and
  closing the card restores it** — the card dodges its own ring, but this
  window is a separate OS one on top of the app and hides whatever it covers.
  The runtime cannot reach the main process (an injected expression may not
  import an app module), so it fires an `owa-guide-running` DOM event that
  `src/helper/domHelpers.ts` relays as `all:app:guide-running` to
  `setGuideRunning` in `electron/electronHelpers.ts`. That only acts on a
  window actually OVER the guided one, and only ever undoes its own doing.
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
  presses of *Yes* to reach the sentence worth keeping. Index -1 is the user's
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
- **A recipe id is scrubbed in code, at both ends** (2026-09-08,
  `scrubRecipeIds` in `help.mjs`, `src/chatbot/recipeIdHelpers.ts`). The
  prompt has forbidden "an id like W-06 -- not even in passing" since the
  first run, and a where-is answer still opened with *"W-08 has exactly what
  you need"* -- twice on the same question, written from a search hit without
  opening the page. A rule the model can ignore is not a rule. Page bodies had
  been scrubbed since `EC-21`; search EXCERPTS never were ("(W-08 step 1)",
  "see W-28"), and a two-round answer is written from the excerpt. Now one
  `scrubRecipeIds` serves the page tool and every excerpt (the hit's `id`
  FIELD stays: it is the handle `owa_help_page` / `owa_guide_start` take),
  and the window reads the answer once more at the seam the `OPTIONS:` frame
  leaves by -- LAST, so a title lands in clean text -- replacing an id with
  the page's own title, which `learnPageTitles` folded into the tool watch
  off that ask's search hits and opened pages (`pageTitles`, per ask, never
  kept), or with *the guide page*. Real-world tokens of the same shape
  (`UTF-8`, `USB-3`) are left alone. The guide card's `stripInternalIds` got
  the lettered id (`W-01b`) in the same change -- it was leaving "see b".
  Beside it, `checkIsWalkthroughEcho` drops a model option that says **Show
  me step by step** in other words (*Yes, walk me through it* sat beside it on
  7 of 7 walkthrough answers), only ever when those buttons are present.
- **A supported question is a LABEL, not a search** (2026-09-03,
  `findKnownQuestionRecipe` in `help.mjs`). Measured on all 258 corpus
  questions that name a recipe: `owa_help_search` put that recipe first for
  57% of them, and the two rankers (`help.mjs` and `questionMatch.mjs`)
  agree on only 28% — when they agree the recipe is right 85% of the time,
  when they disagree the search is right 47% and the corpus 19%. So the
  corpus is NOT a better ranker, and corpus-first offline answering would be a
  regression; what the corpus IS is a set of labels. `searchHelp` now looks
  the query up in the corpus by normalised text and, on an exact row, puts its
  recipe first with `isKnownQuestion: true` — a paraphrase never fires it
  (held-out 22/45 before and after), so it cannot regress a typed question.
  The window does the same on the model's side: `findKnownQuestion` /
  `genKnownQuestionHint` (`questionHelpers.ts`) append the recipe and the
  live tools to the ASK (never the transcript) when the typed text is a corpus
  row — a chip, a suggestion, the More… list — because the model rewrites
  every query in its own words and would search anyway; told the page, it
  opens it (5 rounds → 2 on the panic chip). And `MIN_HELP_HIT_SCORE` (6,
  `helpBotHelpers`) is the floor under which a hit is not a hit — no right
  top hit in 258 scored under it, three wrong ones did — read by the offline
  `answerFromManual` and by `applyToolWatch`, so *Can it stream to
  Facebook?* no longer offers to walk the user through the Presenter overview
  (score 2). The score distributions overlap everywhere above 6, so this floor
  is garbage removal, not a confidence measure.
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
  with no argument asks on the press, one with an argument fills the box).
  Three rules: a command reports what CHANGED (the screens are read back before
  AND after the press — `EC-76`'s lesson); typing it IS the consent, so the
  offered-never-done rule for the congregation's screen does not apply, but a
  MODEL cannot fire one because the button's `BUILTIN_TOOL_NAME` is a pseudo
  tool the server never registers, caught in `handleActing` like the report's
  Send; and a tool's own error text never reaches the user. `BUILTIN_TOOL_NAME`
  is declared in `helpBotHelpers` (the offline bot offers *Turn the screen on*
  under "nothing is showing", and the command module imports that one). The
  same research fixed two offline-bot defects: `TASK_QUESTION_PATTERN` keeps a
  how-do-I that mentions the screen away from the state answer, and the focus is
  a FILTER of `owa_help_search`, no longer a query word — "presenter" is in the
  overview page's TITLE and outranked the real answer 83 to 42. **Driving that
  window over CDP from Git Bash: `/screen` in an argument is rewritten to
  `C:/Program Files/Git/screen`** unless `MSYS_NO_PATHCONV=1` is set — three
  paid calls answered "that looks like a file path" before that was noticed.
- **Report** (`src/chatbot/reportHelpers.ts`) is the one button in that window
  that is not a question: the app itself is wrong, and the report that would help
  a maintainer is the part a volunteer standing in a hall cannot write. Two
  presses, and the first one only ASKS — a warn line quoting back what is about
  to be reported (with an empty box that is the LAST thing they asked, which
  nobody would guess from the button), cleared again by another keystroke.
  Confirmed, it takes a picture of the app BEFORE the investigation starts
  clicking about it, reads the build, the window, the screens and the console for
  itself — trimmed, not dumped: `owa_app_state` carries the user's data directory
  and forty dev-only component names — and only then asks the model to
  investigate, through `askLlmBot` DIRECTLY rather than `handleAsking`, because
  an ordinary answer comes back with walkthrough buttons on it and "show me step
  by step" under a bug report offers to demonstrate the fault. The answer is
  written in a `REPORT:`/`TITLE:`/`STEPS:` frame parsed off exactly like
  `OPTIONS:`; no frame at all is not an error, the account stands and the
  evidence still goes. **Nothing is sent by any of that**: the prepared report
  waits on its own **Send report** button, held in a bounded in-memory map (the
  message carries only the reference — the same rule the attachment bytes
  follow), and a window reopened since says so rather than sending an empty one.
  There is NO issue tracker endpoint yet; `ISSUE_TRACKER_ENDPOINT` is the seam,
  and while it is null the window SAYS nothing was sent and saves
  `OWA-<date>-<id>.md` + `.png` into Downloads with chips that open them. A
  window that told a volunteer their problem had been filed with someone, when it
  had not, would be worse than no button. The Send press is caught in
  `handleActing` by a pseudo tool name (`REPORT_SEND_TOOL_NAME`) that the server
  does not register at all, so nothing outside this window can file a report in
  the user's name.
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
- **Every chip is pressable, and what it shows depends on what it is**: a
  pointed-at control is RUNG where it lives (`owa_highlight_selector`, by the
  stored selector rather than by its words — half the labels in this app are on
  more than one control), a picture opens full-window, and anything that came
  from disk opens its folder (`showFileOrDirExplorer`, off a `filePath` the
  preload's `File.prototype.appFilePath` getter supplies for a drop and for the
  paperclip alike). The chip's NAME comes from `labelPartsOf`, not `describe`'s
  joined `label`: joined, the settings button reads "Setting Setting".
- **An ANSWER can carry materials too.** A `SHOWS:` frame -- `SHOWS: <control
  name> | file:<path>` -- is stripped by `parseAnswerShows` exactly like the
  other two and drawn as the same chips: pressing a control name rings it
  through `owa_find_ui` AT PRESS TIME (against the window as it is now, not as
  it was when the answer was written), and a path opens its folder or, for a
  picture, the preview. A selector never becomes the words on a chip. The
  preview carries **Copy** and **Save a copy** (`downloadImageBase64Data`, the
  app's own save-and-reveal), so a picture worth opening is a picture the user
  can keep.
- **19 tools the chatbot's model never sees**, declared ONCE in
  `tools/owa-devtools-mcp/modelTools.mjs` (no `node:fs`, so the renderer
  bundles the module the audit script reads). All 45 stay registered on the
  server, so the developer's door is whole — what is withheld is withheld from
  the MODEL, which is the untrusted party. Same two enforcement points as the
  firewall and for the same reason: `askLlmBot` filters the list, and
  `runMcpTool` REFUSES the call, because these tools are named in the app's own
  manual and a filtered list alone is a suggestion. Every refusal says what to
  use instead. Four groups: the three the window presses itself
  (`owa_screenshot`, `owa_pick_element`, `owa_highlight_selector`) plus
  `take_screenshot`, which quietly undid that same decision; the acting tools
  aimed by a snapshot uid (`click`, `fill`, `fill_form`, `drag`, `hover`,
  `type_text`) — `owa_click`/`owa_type` say what they press, in the user's own
  language, and are what the interlock reads; the window openers (`new_page`,
  `close_page`, `navigate_page`, against `owa_goto_page`); and the developer
  instruments (`emulate`, `resize_page`, `lighthouse_audit`, three
  `performance_*`). Measured 2026-09-02, after `owa_read_website`: **the host
  bill and the model's bill are different numbers** — 45 tools / ~9 835 per
  round at the host, 26 / ~6 088 to the model, ~32 000 tokens off a worst-case
  ten-round question.
  `audit-mcp-tools.mjs` reports both and prints a withheld tool as `(name)`;
  reporting only the total is how a tool added "for the developer" ends up
  billed to every volunteer.
  `owa_pick_element` draws an outline that follows the mouse
  (`tools/owa-devtools-mcp/picker.mjs`) and swallows the choosing click in the
  CAPTURE phase — pointer-down as well as click, because a dropdown opens on
  mousedown — so pointing at **Clear Bible** to ask what it does does not clear
  the bible. It answers with `describe()` plus `selectorOf()`, a selector built
  shortest-first and TESTED against the document before it is returned (null
  rather than one that matches two things), preferring `data-widget-name` /
  `aria-label` / a hand-written id over `:nth-child`.

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

Because they are dev-only, nothing shipped may match on them. The one name that
IS in production DOM is `data-widget-name` on every resizable pane — its English
`toWidgetLabel` key, present whether the panel is open or collapsed and whatever
language the app is in. That is what `domMatch.mjs` reads for the parent path
(`Background > Videos`) and for the `inPanel` a match reports.

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
- **Much of the UI is painted only under the mouse.** Toolbars like the six
  icons above a bible view are laid out and clickable the whole time and
  hidden with `visibility` (a `:hover` rule on an ancestor several levels
  up), so `getBoundingClientRect` says they are on screen and a screenshot
  says they are not. `domMatch.mjs` classifies with `checkVisibility` —
  `shown` / `hidden` (painted away, revealable) / `gone` (no box) — reports
  `showsOnHover` on a match, and FORCES the hover before ringing, clicking
  or typing: the page's own `:hover` rules re-aimed at a `data-owa-hover`
  attribute, one reveal at a time, always released. Driving the app by
  hand, remember a control can be real, clickable and invisible at once.
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

## owa-enhance-mcp skill

`.claude/skills/owa-enhance-mcp` owns the SERVER the other two skills use.
`owa-enhance-chatbot` owns the assistant (is the answer right?); this one owns
`tools/owa-devtools-mcp` itself — what the tools ARE, what they COST, and what
they are ALLOWED to do. If the complaint is "the answer was wrong" it is the
chatbot skill; if it is "the tool did the wrong thing / cost too much / should
not exist", it is this one.

Four properties held at once, and every change says which it trades away:
**safe** (§A + `references/threat-model.md`, which carries the proven exploit
and the harness that re-proves it), **cheap** (`references/tool-budget.md` — the
surface grew 19% in a day because adding a tool is easy and nobody is billed at
the time), **good for a developer** driving QA over stdio, and **good for the
chatbot** answering a volunteer over HTTP. Preference order for any change is
**remove → deny → merge → sharpen → add**. Tracked work carries `MC-xx` ids in
`references/backlog.md`; `MC-01` (the HTTP door has no credential) and `MC-16`
(`captureWebScreenShot` loads a slide's website with `webSecurity: false`, on
the app's own session, with no popup/download/permission handler) are the two
open holes worth knowing about — `MC-02`, the uid-aimed acting tools, is
CLOSED. Same mirror rule: `.github/skills/owa-enhance-mcp` is a copy.
