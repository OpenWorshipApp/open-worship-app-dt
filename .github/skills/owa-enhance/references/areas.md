# The seven areas — scope, leads, research, already known, proof

Every playbook has the same shape. **Who it protects** is the person a finding
is about. **Scope** is where to look. **Leads** are the signals that matter
here: `scripts/triage.mjs` prints them under the area's name, and
`scripts/app-vitals.mjs` measures the running app. **Research** is the deep
work, all of it inside the research contract in SKILL.md. **Already known**
names what is fixed, decided or filed — a finding that repeats one is not a
finding. **Proof on apply** is what the change will be judged by.

Commands run from the repository root; `<tmp>` is the OS temp directory.
`triage.mjs` opens with *Evidence already on disk* — the newest robot run's
failing rows, memory notes marked OPEN, the sub-skills' open ids — and every
area reads that first.

## Mapping a plain description

| The user says something like | Area |
| --- | --- |
| "it is slow", "the laptop freezes", "startup takes ages", "the installer is huge" | `performance` |
| "the screen went blank", "I lost my song", "it crashed when I imported" | `reliability` |
| "is it safe to open a file somebody sent me", "what can a website do" | `security` |
| "volunteers cannot find X", "it looks wrong in Khmer", "the error made no sense" | `ui` |
| "the lint takes forever", "tests are flaky", "setting up the repo is painful" | `dev-flow` |
| "this file is a mess", "we keep breaking X", "our dependencies are old" | `code-health` |
| "the manual is wrong", "the assistant said a button that is not there", "notes are out of date" | `docs` |
| "the chatbot answered wrong", "a tool misfired", "ChatGPT will not sign in" | routed: chatbot / MCP / AI Chat skill |

---

## security

**Who it protects:** the operator's machine, the church's network, the user's
files and credentials — from content that came from outside: a presenting flow
handed over on a memory stick, a song page, an archive, a Bible XML link, a
website slide item, a downloaded binary.

**The fact that frames every finding here:** app renderers run with
`nodeIntegration: true` and `contextIsolation: false` (`genWebPreferences` in
`electron/electronHelpers.ts`, beside its own `TODO: fix security issues`). So
HTML injection in any app window is code execution on the machine, and the
first class to hunt is outside text reaching an HTML sink or a node-integrated
window.

**Scope:** `electron/electronEventListener.ts` (every `ipcMain` handler);
`electron/client/` (the provider bridge each renderer calls — `fileUtils.ts`,
`httpUtils.ts`, `ytUtils.ts`); `electron/protocolHelpers.ts` and
`electron/fsServe.ts` (what `owa://` serves); `electron/electronHelpers.ts`
(window creation, `handlePopupWindowOpen`, `captureWebScreenShot`);
`electron/archiveCryptoHelpers.ts` and the archive importers (`.owapf`,
`.owadoc`, `.owbible`, `.owanote`, `.owadata`, `.owabdata`);
`electron/electronOfficeHelpers.ts` and `electron/msHelpers.ts` (PPTX, DOCX);
`electron/oauthHelpers.ts`; `electron/electronSecureSettingHelpers.ts`
(`safeStorage`); `src/helper/extra-bin/` (yt-dlp, ffmpeg, qjs — downloaded,
extracted and EXECUTED); the CSP in `html/*.html`; every `shell.openExternal`.

**Owned elsewhere:** `tools/owa-devtools-mcp`, the CDP and MCP doors,
`electron/client/rendererLockdown.ts` and the chatbot CSP → `owa-enhance-mcp`,
whose `references/threat-model.md` frames this whole area and is worth reading
first; the AI Chat guest → `owa-enhance-aichat`.

**Leads:** HTML sinks; `ipcMain` handlers; `shell.openExternal` calls;
`nodeIntegration: true` and `webSecurity: false`; the open `MC-xx` and `AC-xx`
ids.

**Research:**

1. **HTML sinks.** For each sink `triage.mjs --area=security` lists, trace the
   string back to where it came from. Text a file, a page or a person supplied —
   lyric HTML, Bible text, PPTX-derived markup, a note, a page title — reaching
   a sink unescaped is S1. Where it IS escaped, say where.
2. **IPC handlers.** Which take a path, an address or a command? Does the main
   process keep a path inside the data folder (`..`, absolute paths), refuse
   `file:`, `javascript:` and custom schemes before `shell.openExternal` or
   `loadURL`, and bound what it spawns? Every renderer can call every handler.
3. **Archive import.** Is every entry name contained in the destination —
   `..`, absolute names, symlink entries? Does a wrong password or a truncated
   archive leave half-written files behind?
4. **Downloaded binaries.** What proves an Extra Binaries pack is the one that
   was published before its binaries run — a hash, a signature, https alone?
   (memory `extra-bin-on-demand`, `http-downloads-protocol-aware`)
5. **Remote content** outside the AI surfaces — `captureWebScreenShot`
   (`MC-16`).
6. **Dependencies.** `npm audit --omit=dev` — runtime dependencies ship, dev
   ones do not. Electron currency: `npm view electron version` against
   `package.json`; every Electron release carries Chromium security fixes.
7. **Credentials.** Where each key lives, and whether any reaches a log, a bug
   report, the knowledge bundle, or a window that does not need it (`MC-04`).

**Already known:** `MC-01` (the MCP HTTP door has no credential), `MC-03`
(`window.open` reaches a node-integrated popup), `MC-04` (full `fs` in the
chatbot window), `MC-16` (`captureWebScreenShot`); memory
`injected-app-document-file-param` (FIXED), `secure-storage-safestorage`,
`archive-password-protection`, `http-downloads-protocol-aware`,
`evaluate-script-disposablestack`.

**Proof on apply:** the attack tried for real and refused — a harmless payload,
a traversal name — with a test that pins the refusal, AND the legitimate path
still working, because a wall that blocks the feature is a brick. An open
security finding is filed by class and location, never as a working exploit.

---

## performance

**Who it protects:** a volunteer driving a projector from an old laptop — the
requirement CLAUDE.md ranks above convenience and elegance in every decision.
Memory a dev machine never notices is the difference between working and not
working there.

**Scope:** the renderer entries (`html/*.html` → `src/<page>.tsx`); screen
windows (`src/_screen/`, one renderer per shown screen); backgrounds and media
(`src/background/`); Bible data (`bb-cr.gz.bundle` under `src/lang/data/`, the
Bible XML cache); document previews (PDF, PPTX, DOCX); `FileSource` and its
caches; subscribers of `useScreenUpdateEvents`
(`src/_screen/managers/screenManagerHooks.ts`) and `useFileSourceEvents`
(`src/helper/dirSourceHelpers.ts`); the main process; startup
(`electron/index.ts`, `src/boot.ts`); the bundle (`vite.config.ts` —
sourcemaps ship on purpose); the installer.

**Rules to measure against:** CLAUDE.md *Performance* — load lazily and
release, short-lived bounded caches, a per-instance `genTimeoutAttempt(500)`
on a multi-instance event hook — and
§1 of `.claude/skills/review-stagged-change/references/checklist.md`, this repo's real
traps: eager loading, sliding TTLs, a whole file read for a slice, per-row ×
per-screen work, parsing in getters, per-row subscriptions.

**Leads:** `app-vitals.mjs` — private memory by process, JS heap by page, the
renderer's DOM nodes and listeners (an open DevTools window is a renderer of
its own and not the app); `triage.mjs` — module-level `Map` / `Set`, event-hook
files with no debounce, `setInterval` calls, synchronous file reads and writes
in renderer code.

**Research:**

1. **Idle baseline** per window: `app-vitals.mjs --gc` with the presenter, the
   reader and — only with the user's OK, since it lights a projector — a shown
   screen. Record which windows were open; numbers compare only like for like.
2. **Growth.** Repeat a flow that changes nothing the user keeps — switch
   between two documents twenty times, open and close a popup, scroll a long
   chapter — then `app-vitals.mjs --gc` again. A heap, node count or listener
   count that climbs and stays up is a leak lead; halve the repetitions to see
   whether it scales with them.
3. **Traces.** `performance_start_trace` with `reload: false` and
   `autoStop: false`, do the flow, `performance_stop_trace`, then
   `performance_analyze_insight`: long tasks, forced layouts, style storms.
4. **Low-spec approximation.** `emulate` with `cpuThrottlingRate: 4` on a
   window that is not presenting makes jank visible on a fast machine; reset it
   to 1 before anything else.
5. **The bundle.** `NODE_OPTIONS=--max-old-space-size=8192 npx vite build
   --outDir <tmp>/owa-dist --emptyOutDir` (minutes, and the heap the
   `vite:build` script asks for), then the largest chunks per entry. A chunk
   every page loads costs every window; an entry importing a whole subsystem at
   the top is an eager-import lead.
6. **The code sweep** — the checklist traps above, across the files the leads
   and the last 30 days of commits point at.
7. **Startup** — launch to the first presenter paint — only on an app started
   for the purpose; never restart the user's to measure it.

**Already known:** memory `pdf-preload-decodes-all-pages` (FIXED),
`filesource-cache-sliding-ttl` (FIXED), `onscreen-setting-parse-amplification`
(FIXED), `presenting-flow-expanded-doc-stale` (FIXED),
`onscreen-check-must-not-parse`, `presenting-flow-onscreen-marking-design`,
`bible-xml-cache-key-scoped`, `vite-dep-optimizer-504-restart`.

**Proof on apply:** the SAME measurement — same windows, same flow, same
`--gc` — before and after, both numbers in the backlog entry.

---

## reliability

**Who it protects:** the service in progress and the user's files. The two
worst things this app can do are blank or take over a projector mid-service
and lose a document, a setting or a run sheet.

**Scope:** persistence — `src/server/fileHelpers.ts` (`fsWriteFileSync` writes
in place), `appLocalStorage`, `src/setting/`; the editing history
(`src/editing-manager/`, the `.histories/` folders); the screen managers and
their sync across windows (`src/_screen/managers/`); presenting-flow runs
(`src/presenting-flow/`); archive import and export; error handling
(`src/helper/errorHelpers.ts`, `loggerHelpers`); anything more than one process
reads and writes — the presenter, one renderer per shown screen, the popups.

**Leads:** the memory notes marked OPEN and the robot run's failing rows (the
*Evidence already on disk* block); empty `catch` blocks and file write calls
(`triage.mjs`); live console errors.

**Research:**

1. **The live console** of every open window — `list_pages`, then
   `list_console_messages` with `types: ["error", "warn"]` — each error traced
   to its line. A `SyntaxError` out of `parseJsonSafely` is not noise (memory
   `settings-write-race-corrupts-onscreen-map`).
2. **Cross-process read-modify-write.** A setting or local-storage key written
   from more than one kind of window — presenter AND screen — with nothing
   serialising the two; `unlocking()` guards one renderer only.
3. **Fallbacks that get persisted.** A `catch` that returns `{}` or `[]` to a
   caller that then saves it turns one unreadable file into a deleted one.
4. **Fire-and-forget async** in event hooks with no `catch`: a rejection nobody
   sees, a state that quietly stops updating.
5. **Tests, twice.** `npm run test:all` two times; a test that flips is a flake
   lead — read memory `vitest-env-leak-flakes` before blaming the code.
6. **The robot run's rows** — each FAIL, PARTIAL and FINDING re-checked against
   HEAD: does it still happen?

**Already known:** memory `settings-write-race-corrupts-onscreen-map`, **OPEN
since 2026-08-07**: a per-renderer lock (`src/server/unlockingHelpers.ts`) and
an in-place write let the presenter and a screen window corrupt the on-screen
map, and every screen goes blank after the next reload. Re-verify it before
anything else; if it holds, it is an S1 candidate. Also
`history-read-cache-stale-paths` (FIXED, `MC-25`),
`screen-sync-group-echo-guard`, `apply-settings-skips-popups` (FIXED),
`screen-change-bible-dead-ipc` (FIXED), and `qa-intentional-not-bugs` —
behaviour that looks broken and is not.

**Proof on apply:** a test that fails before and passes after; for anything
across processes a live reproduction as well, because a unit test cannot race
two renderers.

---

## ui

**Who it protects:** a non-technical volunteer — often reading Khmer, often
minutes before a service — on a small laptop screen beside a projector.

**Scope:** every window a volunteer touches — `presenter`, `reader`,
`appDocumentEditor`, `lyricEditor`, `bibleNote`, `setting`, the popups; the
`--app-*` tokens (memory `console-design-system-tokens`) under light and dark
`data-bs-theme`; `src/lang/` and `tran()` — a missing Khmer key THROWS in dev
and blanks the page, and shows English in a packaged Khmer window;
accessibility (names, roles, keyboard, focus, contrast); controls painted only
under the mouse (memory `hover-hidden-controls`); empty, loading and error
states; what effects cost to paint (blur, glass, animation — `performance`
too).

**Owned elsewhere:** the chatbot and AI Chat windows (their own skills, and
English-only by decision); QA walks and the manual → `/owa-robot-test`.

**Leads:** literal English `title`, `aria-label`, `placeholder` and `alt`
text outside `tran()` — each shows English in a Khmer window and is a label the
app's own tools cannot match there; hard-coded colours outside the tokens;
the robot run's findings.

**Research:**

1. **Look.** `take_screenshot` of each window as it stands. For the theme and
   language NOT showing, use the newest robot run's screenshots
   (`r*-km.png` under `test-results/robot-test/`) — switching either is a
   settings change and waits for an OK.
2. **Names and keyboard.** `take_snapshot` for controls with no name
   (`button ""`); Tab through a window — can every control be reached, and is
   the focus visible? `lighthouse_audit` with `mode: "snapshot"` on a window
   that is not presenting.
3. **Khmer.** Clipped or overflowing labels, fallback fonts, English left in a
   Khmer window — the literal-attribute leads, checked on screen.
4. **Discoverability.** `owa_list_ui` marks `showsOnHover`: which of those must
   a first-time volunteer find to do a core task?
5. **The words a volunteer reads when something fails** — `showSimpleToast`
   (`src/toast/toastHelpers.ts`) and `showAppConfirm`
   (`src/popup-widget/popupWidgetHelpers.ts`) call sites: do they say what
   happened and what to do next?
6. **The robot run's UX rows**, re-checked against HEAD.

**Decisions, not findings:** the chatbot and AI Chat windows are English-only;
nothing in the chatbot auto-hides and its caution has no dismiss; the
hover-only toolbars are deliberate — finding them is fair game, hiding more is
not; memory `app-ellipsis-left-reverses-names`,
`confirm-popup-labels-auto-tran`, `qa-intentional-not-bugs`.

**Proof on apply:** before and after screenshots of the same window; the Khmer
window too when a label changed, with its key added; the keyboard path walked;
for any behaviour change, `user-workflows.md` and `coverage-matrix.md` updated
with their dates bumped — and no manual step published that was not watched
working.

---

## dev-flow

**Who it protects:** the maintainer's hour, and every agent session that drives
this repo and this app.

**Scope:** `package.json` scripts; `extra-work/` (builds, knowledge, release);
`vite.config.ts`, `vitest.config.ts`, `vitest.electron.config.ts`;
`tsconfig.json` and `electron.tsconfig.json` (TypeScript 7's native `tsc` —
memory `typescript-7-side-by-side`); `eslint.config.mjs`;
`playwright.config.ts` and `e2e/`; packaging (`electron-builder`, `pack:*`);
agent tooling (`.mcp.json`, `tools/owa-devtools-mcp/bin.mjs`, discovery).
`.github/` holds the Copilot mirror and, when `triage.mjs` finds none, no CI —
then `npm run lint` on one machine is the only gate the code ever passes.

**Leads:** CI workflows; `.only` / `.skip` left in tests; dead
`debuggerHelpers` mocks; test files per root (`triage.mjs`); and, from `docs`,
mirror drift and a stale knowledge index — both chores done by hand.

**Research** — wall-clock is the measure, so write every duration down:

1. `npm run test:all` — duration and failures; a second run for flakes.
2. `npm run lint:all:error` (the typecheck, `src` and `electron`),
   `npm run lint:es` and `npm run lint:pre` (both check-only) — duration and
   count. The whole `npm run lint` is safe to time with an app up since `EN-16`.
   A gate that behaves differently by OS is the class `EN-13` was: npm runs
   scripts through `cmd.exe` on Windows and `/bin/sh` elsewhere, so reproduce
   the other shell before trusting a count.
3. **Traps a note records and a script could remove.** Memory
   `build-kills-running-dev-app`, `npm-12-install-gotchas`,
   `mcp-tool-edit-two-processes`, `dev-hmr-stale-state-qa`,
   `vite-caches-failed-import-resolution`, `vitest-env-leak-flakes`,
   `dont-taskkill-all-electron`, `bash-heredoc-halves-backslashes`. A trap that
   has bitten more than once and has a mechanical cure is a finding.
4. **Chores done by hand that rot in silence** — copying the `.github` mirror,
   rebuilding the knowledge, bumping the question corpus's `updated` date and
   the matrix version: could a test or a check catch the miss instead of a
   reviewer's memory?
5. **The dev start.** `npm run dev` runs `electron:build` (knowledge build
   included) and `vite --force`, which re-optimises every dependency on every
   start. Time a cold start only when no app is running.
6. **e2e.** `test:e2e` builds first, and so kills a running dev app: what does
   the suite prove today, and what would one more spec catch?

**Already known:** `EN-13` (quoted globs), `EN-14` (electron typecheck in the
gate), `EN-15` (`strictPort`), `EN-16` (check-only gate; closed `MC-29`) — done
2026-09-18, held by `src/test-setup/lintGateScripts.test.ts`; `EN-17` (no CI)
and `EN-18` (the gate's caches) open; the electron test files are still in no
typecheck (`EN-14`'s optional half).

**Proof on apply:** the same duration or count re-taken; a new check shown
failing on a planted miss and passing on the real tree.

---

## code-health

**Who it protects:** the next change — how safely and cheaply this codebase
keeps moving.

**Scope:** `src/`, `electron/` and `tools/`: import cycles (the *Cannot access X
before initialization* class, `debugging/Circular-Deps.md`), oversized modules,
logic defined twice, dead code, logic modules with no test, dependency
currency, and the conventions (`Comp` names, `useAppCurrentRef`).

**Leads:** modules over 1 000 lines; logic modules with no sibling test;
`TODO` / `FIXME` / `HACK` markers; where the last 30 days of commits landed
(`triage.mjs`).

**Research:**

1. **Cycles.** `npx depcruise src --include-only "^src" --output-type err` to
   the terminal, a few seconds — never `npm run dc:err`, which writes the
   tracked `dc-dependency-graph/errors.html`. The config's `no-circular` rule
   reports cycles as warnings, and there are hundreds, so rank a cycle by what
   it costs — a module-initialisation crash, a subsystem that cannot load
   alone — never by the count.
2. **The big modules.** Size alone is not a finding. Is it several
   responsibilities every change must wade through, and has that already cost
   something — a bug, a conflict, a revert (`git log` on the file)?
3. **Untested and moving.** A logic module with branches, no test and commits
   in the last 30 days is the risky kind; one untouched for a year is not.
4. **Logic defined twice** — the same table, constant or helper in two places.
   Across the `tools/` ESM ↔ `src/` TypeScript boundary it is sometimes forced;
   the answer then is a drift test (`MC-20`), not a merge.
5. **Dependencies.** `npm outdated` — runtime `dependencies` (they ship) before
   dev ones; a major version behind with a security or performance note in its
   changelog before one without.
6. **Dead mocks and stale test labels** — CLAUDE.md *Codebase patterns* names
   the files.

**Decisions, not findings:** the ~63 `useCallback` sites deliberately NOT
converted to `useAppCurrentRef` (CLAUDE.md); `useAppCurrentRef` as a
post-`await` staleness oracle (memory `useappcurrentref-race-guard`);
`appDocumentHelpers` must not import `LyricAppDocument` (memory
`app-document-helpers-lyric-cycle`); `tools/*.mjs` may not import `src/`.

**Proof on apply:** behaviour unchanged — `npm run test:all`, the typecheck,
and a live smoke of every flow the moved code serves. A refactor with no live
check is not done.

---

## docs

**Who it protects:** a volunteer reading the manual or asking the 🤖 — which
answers FROM these documents — and every agent session reading CLAUDE.md and the
memory notes.

**Scope:** `.claude/skills/owa-robot-test/references/user-workflows.md` (the
source) → `docs/manual-sources/` (generated, tracked);
`tools/owa-devtools-mcp/questions/`; `.claude/CLAUDE.md`, `.claude/memory/`,
`.claude/skills/`; the `.github/` mirror of all three; the knowledge bundle
(`electron-build/knowledge/`); `README.md`, `RELEASE.md`,
`PRIVACY_POLICY.md`.

**Leads:** mirror drift; repo paths named in CLAUDE.md, a memory note or a
skill that are gone; a knowledge index older than the notes it is built from
(`triage.mjs`).

**Research:**

1. **A recipe against the app.** For the windows that changed most in the last
   30 days, walk their recipes' steps read-only: `owa_find_ui` for each named
   control — is it there, with that label, in that window? A step naming a
   control that is not there sends volunteers, and the 🤖, to nothing.
2. **Stale notes.** A path that is gone (the lead list), a function renamed, a
   number the code contradicts. A stale note misleads every session that reads
   it; say which note, and what is true now.
3. **The corpus.** `npx vitest run tools/owa-devtools-mcp/questions.test.mjs`.
4. **CLAUDE.md, spot-checked** — three concrete claims (a name, a number, a
   path) against the code.
5. **Mirror drift** — which side is newer. `.claude/` is the source of truth, so
   a newer `.github/` file means an edit landed on the wrong side.

Never run `docs:gen` or `build-knowledge.mjs` while researching — both write.

**Proof on apply:** a manual step watched working live, and none published
otherwise; `npm run docs:gen`; `node extra-work/build-knowledge.mjs`; the
corpus test; the mirror copied, never reconciled by hand.
