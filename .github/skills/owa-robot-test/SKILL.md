---
name: owa-robot-test
description: 'Autonomous QA / robot end-to-end UI/UX testing of the RUNNING Open Worship App (Electron + React + Vite) through chrome-devtools-mcp — and the SOURCE OF TRUTH for user-facing documentation. Use when asked to robot test, QA test, smoke test, e2e test, or FULL-COVERAGE test the real app UI; to hunt for UI/UX bugs, visual glitches, console errors, broken buttons/tabs, dead links, or accessibility problems on the live app; OR to generate a tutorial / help page / user guide for the app, or to verify a learning document / manual / tutorial against the real app behavior. The workflow starts "npm run dev", waits until the Electron remote-debugging (CDP) endpoint on port 9223 is attached, connects the Chrome DevTools MCP, walks the presenter / reader / slide-editor / settings / popup-window UI like a QA engineer, captures screenshots + console + network, and reports findings by severity. Screen controlling & presenting checks (present content, drive the screen.html output target, clear/restore), a LOCALE SWITCH pass (run the touched screens in the other language — a missing Khmer key THROWS in dev and blanks the page, and an English-only run structurally cannot see it), and a MEDIA DOWNLOAD pass (download one video AND one audio from the canonical YouTube link — the only product flow that runs the on-demand extra-bin yt-dlp/ffmpeg/qjs binaries (the dev-only experiments page also can)) are MANDATORY in every run, whatever the focus area. Full-coverage runs are tracked row-by-row against docs/test-paths/coverage-matrix.md (~761 stable-ID rows incl. a full keyboard-shortcut matrix KB-01..60 and a context-menu-item matrix CM-01..99, resumable across sessions via a coverage-<runid>.json state file). Asked to IMPORT A BIBLE XML, add a bible translation from a link/URL, or fix one that reads in English, run §6g (ST-41..ST-50): the URL import, the "Key is missing" guessing-key dialog, and the Info editor''s Choose Locale → Edit Numbers Map → Edit Books Map actions that make a non-English translation read in its own script and numerals. The argument "presenting flow" (or "run sheet") selects PRESENTING_FLOW DEEP MODE (§6f): a tracked, coverage-accounted 11-phase pass over all 69 run-sheet rows (PL-10, PL-29, PL-32..76, PL-81..102) — storage kinds, the tree, both action families, CC elements, screen pinning, the floating preview as a player, failure surfaces, archives, performance guards — driven from a scratch presenting flow and torn down afterwards. Tutorial/doc work is grounded in references/user-workflows.md (stable W-xx task recipes with screenshot checkpoints, each traceable to matrix rows). Newer areas covered by the matrix and workflows: the Resources panel (RD-81..90, W-37), the Connection Graph (RD-92..106, W-38), SongSelect import (PL-103..104, W-35), Public Domain Songs import (PL-105, W-36), the app-wide ⋮ button (GL-24, W-01b), verse marks that highlight & comment bible text into Bible Notes (RD-108..112, W-40), and whole-Bible-Note-file sharing as .owanote.tar.gz (PR-30/31, CM-98/99, W-41).'
argument-hint: '[focus area e.g. "presenter", "bible lookup" — or "presenting flow" for the tracked deep run-sheet pass — or "full" for a tracked full-coverage run — or "tutorial [workflows]" to generate a help page — or "verify-doc <path|url>" to check a learning document against the live app]'
---

# OWA Robot Test — QA e2e via chrome-devtools-mcp

Drive the **live** Open Worship App like a human QA engineer and report real UI/UX
issues. This is black-box testing against the actually-running Electron window, not
unit or Playwright tests.

> **Read first:** [references/knowledge-base.md](./references/knowledge-base.md) — verified
> field notes on **what to observe**, expected-vs-noise (which console/network output to
> ignore), and the traps that ruin a run (dynamic Khmer/English locale **and the missing-key
> throw that only shows in Khmer — §1.1**, popup-only windows, the `setting.html` navigation
> trap, restoring live state). Skim it before you start.

## When to use

- "Robot test the app", "QA the UI", "smoke test the running app", "find UI issues".
- **"presenting flow" / "run sheet"** → **presenting flow deep mode** (§6f): the tracked, phase-by-phase
  pass over the whole run-sheet subsystem, with coverage accounting on.
- After a feature/refactor, to verify nothing is visually or interactively broken.
- To collect console errors, failed network requests, and accessibility gaps from the
  real renderer.
- **"import a bible XML" / "add a bible from a link"** → **§6g** (`ST-41..ST-50`, model in
  KB §15, tutorial voice in W-34): the URL import, the **Key is missing** guessing-key
  dialog, and the three Info-editor actions that make a non-English translation actually
  read in its own language.
- "Write a tutorial / help page / user guide for the app" → **tutorial mode** (§9).
- "Check this manual / tutorial / learning doc against the app" → **doc-verify mode**
  (§10). Both are grounded in
  [references/user-workflows.md](./references/user-workflows.md) — the user-facing
  task recipes that this skill keeps in sync with the live app.

## How it works (architecture)

- `npm run dev` runs two things via `concurrently`:
  - `vite:dev` → dev server at `https://localhost:3000` (self-signed cert).
  - `electron:build && electron` → launches Electron with
    `--remote-debugging-port=9223` and `NODE_ENV=development`.
- In dev, Electron's main window loads `https://localhost:3000/presenter.html`.
- [.mcp.json](../../../.mcp.json) starts `chrome-devtools-mcp` with
  `--browserUrl=http://127.0.0.1:9223`, so the MCP **attaches to the already-running
  Electron instance** (it does not launch its own Chrome). The app must be up first.

```
npm run dev ──► Vite (localhost:3000, https)
            └─► Electron (loads presenter.html)  ──CDP:9223──► chrome-devtools-mcp ──► this agent
```

## Prerequisites

- Node 22+, `npm install` already done.
- `chrome-devtools-mcp` present (it is in devDependencies) and configured in
  [.mcp.json](../../../.mcp.json) with `--browserUrl=http://127.0.0.1:9223`.
- Only ONE Open Worship App instance can run (single-instance lock). If one is already
  running with the debugger, reuse it instead of starting another.

## Procedure

### 0. Load the DevTools MCP tools (required)

The `mcp_chrome_devtoo_*` tools are deferred and MUST be loaded before use. Run
`tool_search` with a query like:

> chrome devtools mcp list pages take snapshot click fill console network screenshot wait_for

Confirm at least these are available: `mcp_chrome_devtoo_list_pages`,
`mcp_chrome_devtoo_select_page`, `mcp_chrome_devtoo_take_snapshot`,
`mcp_chrome_devtoo_take_screenshot`, `mcp_chrome_devtoo_click`,
`mcp_chrome_devtoo_fill`, `mcp_chrome_devtoo_hover`, `mcp_chrome_devtoo_press_key`,
`mcp_chrome_devtoo_wait_for`, `mcp_chrome_devtoo_evaluate_script`,
`mcp_chrome_devtoo_list_console_messages`, `mcp_chrome_devtoo_list_network_requests`.

### 1. Is the app already running?

Quick-probe the debugger (short timeout). Run from the workspace root:

```bash
node .claude/skills/owa-robot-test/scripts/wait-for-debugger.mjs --timeout=3000 --interval=500
```

- Exit code `0` → the app + debugger are already up. **Skip step 2.**
- Non-zero → start the app in step 2.

### 2. Start the app and wait for the debugger to attach

Start the dev stack in an **async / background** terminal (it is long-running) and keep
the terminal id for cleanup:

```bash
npm run dev
```

Then block until the Electron CDP endpoint exposes the presenter page. The first run
also compiles `electron-build`, so allow a generous timeout:

```bash
node .claude/skills/owa-robot-test/scripts/wait-for-debugger.mjs --match=presenter.html --timeout=180000
```

When it prints `{ "ready": true, ... }` the debugger is attached and the window has
navigated. Do NOT poll manually with `sleep`; run this script instead — it exits as
soon as the page target appears.

### 3. Connect and confirm the DOM is ready

1. `mcp_chrome_devtoo_list_pages` → locate the page whose URL ends in `presenter.html`
   (other targets like `screen.html` may appear when presenting; ignore them for now).
2. `mcp_chrome_devtoo_select_page` on that page.
3. Confirm React finished mounting (not just DOM-loaded). Use a **page-agnostic**
   readiness check (works on every page) via `mcp_chrome_devtoo_evaluate_script`:
   `() => { const r = document.getElementById('root'); return !!r && r.children.length > 0 && !r.querySelector('img.loading'); }`
   and expect `true`. On `presenter.html` / `appDocumentEditor.html` you can also
   `mcp_chrome_devtoo_wait_for` the text `Bible Lookup` (those pages have `#app-header`;
   `reader.html` and popups do not). A `.loading` image that never disappears is itself a
   bug — record it.

### 4. Baseline capture

- `mcp_chrome_devtoo_take_snapshot` — gives interactable elements with `uid`s (this is
  how you target clicks/fills; there is no Playwright locator here).
- `mcp_chrome_devtoo_take_screenshot` — save under `test-results/robot-test/`.
- `mcp_chrome_devtoo_list_console_messages` — record load-time errors/warnings.
- `mcp_chrome_devtoo_list_network_requests` — record any `4xx`/`5xx`/failed requests.

### 5. Change to the page / route under test

The window opens on `presenter.html`. To test another page, **navigate the currently
selected page directly to its dev URL** with `mcp_chrome_devtoo_navigate_page` (reuse the
same window — do NOT open a brand-new tab):

| Page | Navigate to |
|------|-------------|
| Presenter | `https://localhost:3000/presenter.html` |
| Bible Reader | `https://localhost:3000/reader.html` |
| Slide / Doc Editor | `https://localhost:3000/appDocumentEditor.html` |
| Settings | ⚠️ **popup window — do NOT `navigate_page` the main window here** (see warning) |
| Lyric Editor / Bible Note / Web Editor / About / Screen | popup windows — see [references/ui-map.md](./references/ui-map.md) |
| Find bar | `finder.html`, pinned INSIDE the searched window as a `WebContentsView` — see [references/ui-map.md](./references/ui-map.md) |

> ⚠️ **Popup-only pages (`setting.html`, `about.html`, finder, lyric/bible/web editors) must
> NOT be loaded in the main window.** They open via `window.open` as separate windows. If you
> `navigate_page` the main window to one, it **loads but then can't navigate back**
> (`net::ERR_ABORTED` on every destination, even `about:blank`) and it **persists**
> `mainHtmlPath` so the app reopens that page on the next restart. Instead: click the page's
> button (e.g. the gear for Settings), then `list_pages` → `select_page` the **new popup
> target**. Full trap details + recovery: [knowledge-base.md](./references/knowledge-base.md)
> §2–§3.

For the **main-window** pages (Presenter / Bible Reader / Slide-Doc Editor), this mirrors how
the app navigates itself — `goToPath()` just sets `location.href` (see
[src/router/routeHelpers.tsx](../../../src/router/routeHelpers.tsx)) — so it stays in the
same Electron window and `window.electron` / app APIs remain attached. After **each**
navigation:

1. Re-run the **readiness check** from step 3 (React re-mounts on the new document).
2. Reset the **baseline** from step 4 (console + network are per-page).

You can also test the in-app navigation UX itself: click the header tabs `Presenter` /
`Bible Reader` / `Slide Editor` and assert the URL changed (scenario S1). Choosing
`Slide Editor` with no document selected should raise an alert, not navigate.

### 6. Systematic UI walkthrough

Follow [references/test-plan.md](./references/test-plan.md). If the user named a focus
area (argument-hint), navigate to that page (step 5) and start there; otherwise iterate
over the pages — `presenter` → `reader` → `appDocumentEditor` → `setting` — navigating to
each per step 5. **Whatever the focus, two blocks always run: the screen-controlling
block (§6a) and the locale-switch block (§6d).**

If the user named **"presenting flow"** / **"run sheet"**, run **presenting flow deep mode (§6f)** — a
tracked mode, not a trimmed focus: coverage accounting is on, the phases run in order, and
the mandatory blocks ride inside them.

If the user asked for **"full"**, **"everything"**, or a **coverage percentage/target**
(e.g. "99% coverage"), run in **full-coverage mode** — see "Coverage accounting" below —
where every row of [docs/test-paths/coverage-matrix.md](../../../docs/test-paths/coverage-matrix.md)
must end the run with a status. For every scenario:

1. `take_snapshot` to get fresh `uid`s.
2. Interact: `click` / `fill` / `hover` / `press_key` / `drag` using the labels &
   selectors in [references/ui-map.md](./references/ui-map.md).
3. `take_screenshot` after the interaction (before/after pairs are ideal).
4. Re-read console + network to catch new errors triggered by the action.
5. Record anything under **"What counts as an issue"** below.

**Always run the toast check once per session** (`[GL-10, GL-15, GL-23]`, test-plan §S9)
— it costs one `evaluate_script`: `window.testSimpleToasts()` (dev-only helper in
`src/toast/toastHelpers.ts`) fires 3 toasts, which must **stack** in `.app-toast-stack`
rather than replace each other. Toasts are how the app reports refusals everywhere
(locked screen, audio-off-while-playing, drop-with-no-folder), so a broken toast stack
silently swallows those messages. Selectors + assertions: ui-map §Toasts.

Interact by **visible text / role / icon**, since the app has few `data-testid`s.
Example: to open the Bible lookup, find the snapshot node labelled `Bible Lookup` (or
press `Control+b`), then click its `uid`.

For a page-by-page **component tree with the exact interactions each component supports**
(click / double-click / right-click / drag-drop / keyboard-shortcut / slider / input),
use [references/components-path.md](./references/components-path.md) as the targeting index.

### 6a. MANDATORY: screen controlling & presenting (every run, every focus)

Presenting content to a screen is the app's core purpose, so this block is **not
optional and not skippable by focus area**: a run that only tested "bible lookup" must
still run it. A report without evidence for this block is **incomplete** — say so
rather than shipping it. Full row definitions: coverage-matrix.md §SP + §SC; recipe:
test-plan.md §S7. (The other always-on block is the locale switch — §6d.)

Minimum pass (≈5 minutes, self-restoring):

1. **Present something real** — single-click a slide thumbnail (one click presents; a
   second click on the same card only **re-applies** it, it does NOT clear — KB §5) or
   double-click a bible verse. Verify `.app-on-screen` appears and the mini-screen
   preview renders it (`PR-04`). Un-present with `F8`, never with a second click.
2. **Check the clear-control states** — the matching `BG`/`SL`/`BB`/`FG` button in the
   previewer header flips from outline (disabled-look) to solid (`SP-02`).
3. **Show the screen** — click `ShowHideScreen` (or ⌨️ `F5`). A
   `screen.html?screenId=N` target MUST appear in `list_pages`; `select_page` it,
   run the readiness check, and `take_screenshot` **of the screen target itself**
   (`SP-01`, `SC-01`). The mini preview is NOT sufficient — screen-only bugs (e.g.
   full-width PDF) never reproduce there.
4. **Verify layer composition on the real output** and compare against the
   mini-screen (`SC-02`).
5. **Clear + hide + restore** — clear the layer with its key (`F8` slide / `F9`
   bible) or button, hide the screen (toggle / ❌ close button on the output), confirm
   the CDP target disappears, and restore anything you changed (background, selected
   doc, lock, transitions).

Exception: only if the user explicitly says the display is in **live use** (e.g. an
actual service is running), skip steps 3–4, assert via the mini-screen, and mark
`SC-01/02 BLOCKED→EX-02` with that reason.

While the screen is hidden its window has **no CDP target**; its console forwards via
`all:app:log` to the `npm run dev` terminal (electron main stdout) — read that channel
when hunting screen-only bugs while hidden (`SC-05`).

### 6b. Coverage accounting (full-coverage mode)

The definition of "coverage" is the row inventory in
[docs/test-paths/coverage-matrix.md](../../../docs/test-paths/coverage-matrix.md) (~761 rows with stable
IDs like `PM-29`), including the exhaustive keyboard-shortcut matrix (`KB-01..60`) and
the context-menu-item matrix (`CM-01..99`). The contract: **every in-scope row ends the run PASS, FAIL, PARTIAL,
or BLOCKED-with-reason; policy exclusions (EX-01…EX-07) are counted separately.** A row
counts as exercised only with evidence (screenshot, asserted `evaluate_script` result, or
console/network diff) — see the matrix's "Evidence rule".

**Run state file** — create `test-results/robot-test/coverage-<runid>.json` at start
(`<runid>` = `yyyyMMdd-HHmm`), and update it after **every 5–10 rows** (not only at the
end), so an interrupted or context-compacted session loses nothing:

```json
{
    "matrixVersion": "2026-07-08",
    "runId": "20260708-1430",
    "startedAt": "2026-07-08T14:30:00+07:00",
    "focus": "full",
    "rows": {
        "PM-29": { "status": "PASS", "evidence": "shot-014-bg-color.png" },
        "PM-32": { "status": "BLOCKED", "note": "EX-03: no camera device" }
    }
}
```

**Resume:** before starting, look for the newest `coverage-*.json` less than a day old
with unfinished rows — if found, continue that run (same file, same runid) instead of
restarting from zero. This is how a full-coverage pass can span several sessions.

**Recommended order** (dependencies first, disruption last):

1. `GL` baseline on presenter → `NAV` → `PL` → `PM` (backgrounds/foregrounds restore as
   you go) → `PR` → **`SP` + `SC` (the mandatory screen block §6a — run it while
   content from `PM` is still live)** → `KB` (F6–F10 double as cleanup).
2. `RD` (reader) → `ED` (editor — needs a selected doc from `PL`) → **`XW` (cross-window
   edit→present propagation, §6c — open the editor as a *separate* window and confirm a
   saved edit reaches the Presenter/screen; run it whenever editing/lists were touched)**.
3. Popups `PU` (each opened from its trigger row).
4. **Mandatory media block §6e (`MD-01..02` + its teardown `MD-04`)** — sweep the two
   dirs, then kick the video download off while `PM` is fresh (the Background panel is
   already open) and do the audio one right after; both take minutes of wall-clock, so
   start them before the settings churn rather than after. **Trash both files as soon as
   their evidence is captured** — while the Background panel is still the open one — so
   the run cannot end with ~100 MB of debris in the user's data dir.
5. `ST` settings last-but-one, then the **mandatory locale block §6d (`LT-01..02`)** plus
   the `LT-03..05` theme spot-checks, which ride on `ST-04/05`. Restore everything. Each
   `Apply Settings` (`ST-08`) reloads every window, so these go **very last** — and the
   locale block needs two of them (switch, then switch back).

**Honesty rules:** never mark a row PASS without its pass condition observed; never drop
a row silently — if you ran out of budget, mark the remainder `BLOCKED: "not reached,
resume next run"` and say so in the report. An honest 97% with reasons beats a fake 100%.

### 6c. Cross-window edit→present propagation (run when the focus touches editing / lists / file-reload)

OWA windows are **separate renderers** that sync only via disk + `fs.watch`, so "edit in the
`Document Editor` window → the `Presenter` **preview / list** updates" is emergent
cross-process behavior a **one-window** pass never checks — and is exactly how a
"resize-a-box-in-the-editor didn't update the Presenter" regression can ship unspotted. A
single-window walkthrough that opens the editor **in-place** (the `Slide Editor` tab's
`goToPath`) has only one renderer and **structurally cannot see this class of bug**.

> ⚠️ **The live screen is deliberately excluded from auto-refresh.** The **presented** slide
> is an intentional snapshot — a **saved** edit does **not** auto-update the live `screen.html`
> output (the operator applies it by **re-presenting**). So the auto-reload targets are the
> Presenter **center preview** and **list rows** only; the live screen is verified via the
> *re-present* apply-path, not by expecting it to change on save. See KB §12.2 / §12.4.

**Run scenario [test-plan.md §S18], rows `XW-01..10`, whenever the run touches the editor,
the document/lyric/presenting-flow lists, or the `useFileSourceEvents`/file-reload wiring** (a
focused "test the editor" run included). In short (full recipe + why-CDP-can't-edit +
CDP-drivable-edit techniques are in **KB §12** — read it first):

> ⚠️ **"The content changed on disk — did the SLIDES change?" is its own assertion.** Every
> consumer that caches derived slides has to be checked in its own right, because the file
> event reaching the component is not the same thing as the component re-deriving. The lyric
> **Stage Previewer** is the standing example (`XW-08`): its panes re-rendered on every edit
> while a 3-minute `CacheManager` handed them the pre-edit slides, so the rendered song above
> them refreshed and the slides under it did not. Assert **each pane**, with **two stages
> shown** — a per-file cache that only one consumer clears leaves the others stale, which is
> exactly what a single-pane check cannot see. A disk write drives all of this without OS
> focus (KB §12.4), so there is no excuse to skip it.

1. Use a **scratch doc** shown in the Presenter (present slide 1 to also cover the screen).
2. Open its editor as a **separate window** (NAV-21 `bi-box-arrow-up-right` external icon /
   a doc's **Edit ↗** → `openPopupWindow`), **not** the in-place `Slide Editor` tab — so both
   `appDocumentEditor.html` and `presenter.html`/`screen.html` targets exist.
3. Make a **CDP-drivable** edit in the editor target (CDP can't drag/Monaco-type — OS focus):
   `fill` the Box **Position/Size/Rotate** (ED-19) or slide **W/H** (ED-17) numeric inputs, a
   programmatic `CanvasController` mutation, or direct `fileSource.writeFileData(json)`; then
   **Save**.
4. **Assert propagation** within ~3 s in the auto-reload targets: Presenter `VarySlidesComp`
   (XW-01), list-row thumbnail (XW-02 — **note:** Documents rows are text+icon only in the
   current build, so there may be no thumbnail to go stale; record N/A rather than PASS).
   A stale target after a **saved** edit = **regression → FAIL + Finding** naming the broken
   hop. ⚠️ **An UNSAVED edit propagates too, and that is correct** — unsaved state is
   disk-backed in `<file>.histories/<n>-head` and the Presenter reads the HEAD, not the
   `.ows`, so XW-04's assertion is the reverse of what older revisions of this file said
   (verified 2026-08-10, KB §12.2b). For the live `screen.html` of a **presented** slide
   (XW-03): staying stale after an edit is **expected** (intentional snapshot) — verify by
   **re-presenting** and confirming the screen *then* updates; only a broken re-present is a
   FAIL. Re-presenting a dirty document projects its **unsaved** state.
5. **The lyric half (`XW-08`, `XW-09`, `XW-10`) — needs no editor window at all.** Copy a real
   `.owl` to a scratch name in the documents dir, select it, **Add Stage** so two panes show,
   and put a unique ASCII marker in the song. Then, from the shell:
   - rewrite the scratch `.owl` with the marker changed → **every** stage pane and the rendered
     song must show it within ~3 s, untouched (`XW-08`);
   - write `<scratch>.owl.histories/1-head` with a third marker → same assertion, because that
     is what the Lyric Editor writes before you ever press Save (`XW-09` sidecar mapping);
   - copy a second scratch file in, then delete both → the list must add and drop the rows on
     its own (`XW-10` — **known FAIL on refactor28**, see the matrix row before filing it new).

   Read the markers out of the panes' **shadow roots** (`el.shadowRoot.textContent`), not the
   light DOM. Then delete the scratch files and its `.histories` dir, and re-select whatever was
   selected before.
6. **Restore** with editor **Undo** (never *Discard*) + re-save; delete the scratch doc.

Caveat: opening/closing the separate editor window can trigger a chrome-devtools-mcp "browser
reconnected" — re-`list_pages`/`select_page` after each, and read screen visibility from
`.show-hide.showing`, not target enumeration.

### 6d. MANDATORY: locale switch pass (every run, every focus)

**An English-only run structurally cannot find a missing translation.** `tran()`
([src/lang/langHelpers.ts](../../../src/lang/langHelpers.ts)) returns early when the
locale is `en-US` (`DEFAULT_LOCALE`) — no dictionary lookup happens at all. Switch to
Khmer and the same call **throws** `Translation for text "…" not found in locale km-KH`
in dev, and since there is no error boundary the whole subtree renders **blank**. A real
example: `PositionSizeFieldComp` called `tran(name)` with `name="X:"`, which blanked the
entire slide-editor tools panel — invisible in English, fatal in Khmer.

So this block is **not optional and not skippable by focus area**, exactly like §6a. Rows
`LT-01..02`; recipe: test-plan.md §S15.

Minimum pass (≈3 minutes, self-restoring):

1. **Record the starting locale** — open Settings (gear → popup target) → Language and
   see which of `Khmer` / `English` is the active button. You MUST restore it at the end.
   Do **not** read `localStorage['language-locale']`; it is a stale key (KB §1).
2. **Switch to the other locale** and click `Apply Settings` — this calls
   `forceReloadAppWindows()`, so **every window reloads**: re-`list_pages`,
   `select_page`, and re-run the readiness check (step 3). All previous `uid`s are dead.
3. **Re-walk the screens your focus touched**, plus the presenter baseline. For each:
   `take_screenshot` and `list_console_messages`.
4. **Assert, per screen:**
   - No `Translation for text "…" not found in locale km-KH` in the console →
     any occurrence is a **Critical** finding: name the missing key AND the component
     that rendered it (the React warning right after it names the component).
   - No blank/empty panel where content rendered in the other locale (that is the
     visible symptom of the throw above).
   - Labels actually translate — no raw English left in a translated screen, no clipped
     or overflowing Khmer text (Khmer glyphs are taller; check buttons and table cells).
5. **Restore** — switch back to the locale from step 1 and `Apply Settings` again.

Notes:

- Unsaved editor state **survives** the reloads (it is disk-backed in
  `<file>.histories/<n>-head`, `EditingHistoryManager`), so a pending `*` on a document
  is not a reason to skip this block — but never use **Discard changed** to tidy up.
- If the locale changes and you did **not** change it, assume the **user** did (KB §1) —
  confirm before filing anything.
- Strings that are hardcoded rather than passed through `tran()` stay English in Khmer
  mode. That is a **Low/Info** finding (untranslated UI), not the Critical throw above —
  report them separately and name the file.

### 6e. MANDATORY: media download, video AND audio (every run, every focus)

**No other product flow runs the external binaries.** `downloadVideoOrAudio`
([src/server/appHelpers.ts](../../../src/server/appHelpers.ts)) is the only product
caller of `extra-bin/yt/yt-dlp` — `resolveMediaStreamUrl` in the same file
(appHelpers.ts:336) also runs it, but only from the dev-only experiments page
(`src/experiments/html-in-canvas/youtubeDemo.tsx`), and `checkIsExtraBinInstalled` only
checks file existence, never executes — and `downloadVideoOrAudio` is what points yt-dlp
at `extra-bin/ffmpeg/bin` and `extra-bin/qjs/qjs` — so a wrong/missing/stale binary
passes typecheck, tests, build and every other matrix row, and only shows up here. Rows `MD-01..06`; recipe:
test-plan.md §S19.

**The binaries are NOT in the app package.** They are installed on demand from
**Settings → Others → Extra Binaries** into `<data parent dir>/extra-bin/`
(dev: `Desktop\open-worship-data-dev\extra-bin`), which is why the block now starts at
`MD-05`:

- **`MD-05` runs first** whenever the panel says *Not installed* — press **Download and
  Install**, then **Re-extract** (it must work with no network, because the
  `bin-*.tar.gz` is kept on disk on purpose). If the panel offers **Update to `<ver>`**,
  take it: the superseded archive must disappear.
- **`MD-06`** proves the guard: with `extra-bin\yt` moved aside, a download raises a
  **Media Tools Required** confirm that jumps to the panel, spawns no yt-dlp, and does
  **not** stack a second "download failed" toast on a `No`. Restore the folder after.
- In **dev the install is mocked** — it copies
  `extra-work/experiment-building/release/bin-<ver>.tar.gz`, built by `npm i` (the
  `install` lifecycle → `extra-work/build.sh` → `build-extra-bin.mjs`). If that file is
  missing the panel says so and names the command; run it rather than filing a bug.
- **`extra-bin` is not teardown.** The MD-04 sweep covers the downloaded media only.

**The block owns its garbage (`MD-04`).** It is the only part of a run that writes ~100 MB
of video plus an mp3 into the user's data dir, and the app **de-duplicates by suffixing,
never overwriting** — so without a teardown every run adds another copy. By 2026-08-07 the
dev data dir held 17 leftover copies (≈635 MB — six `…YouTube (N).webm` and eleven
`…(N).mp3`) from earlier runs, which had to be swept by hand.
Sweep before, delete after — details below.

**Canonical test link** — always use this one so runs are comparable:

```
https://youtu.be/ZSsOrph7rJs?list=RDZSsOrph7rJs
```

Minimum pass (only step 4 is optional — 1 and 2 exercise different ffmpeg paths, and the
sweep/teardown pair 0 + 5 is what keeps the block idempotent):

0. **Sweep first (MD-04, part 1).** List the videos and audios dirs before downloading
   anything and delete leftovers from earlier runs — they carry the **canonical video's
   page title** (`[MV] គ្រប់ទាំងផ្កា Flowers by … - Official Music Video - YouTube`, ` (N)`
   from the second copy on) — plus any orphaned `temp-*.part`. Match that title, **not
   `*YouTube*`**: the user's own library holds real downloads whose names also end in
   `- YouTube` (`ស្រែកថ្វាយព្រះអង្គ Shout to the Lord - YouTube.MKV`, `4K Christian Church
   Worship … - YouTube.mp4`). Say in the report how many you found: leftovers mean the
   previous run skipped its teardown.
1. **Video (MD-01)** — Background → **Videos** tab → right-click the empty area of the
   list → **Download From URL** → put the link in → **Ok**. yt-dlp fetches separate video
   and audio streams and **merges them with ffmpeg**.
2. **Audio (MD-02)** — Background → **♫Audios♫** split → same menu (the popup label must
   read **Audio URL:**) → **Ok**. This one runs `-x --audio-format mp3`, i.e. an actual
   **libmp3lame encode** — a merge-only ffmpeg would pass MD-01 and fail here.
3. **Assert on disk, not on the toast**: a new file in the videos dir (merged container)
   and an **`.mp3`** in the audios dir, plus the new thumbnail/row in the panel.
4. Optional but cheap — prove the JS runtime is really QuickJS by reading the spawned
   command line (`Get-CimInstance Win32_Process -Filter "Name='yt-dlp.exe'"`): it must
   carry `--no-js-runtimes --js-runtimes quickjs:<…>\extra-bin\qjs\qjs.exe`.
5. **Delete both again (MD-04, part 2)** — once step 3's evidence (screenshot + on-disk
   listing) is captured. Prefer the app's own path: 🖱️R the new row → **Move to Trash** →
   **Yes**, for the video and then for the `.mp3`. That also covers `CM-06` on a background
   media row against a scratch file this run created, and it refreshes the list through the
   real `delete` event. Two gotchas:
   - **Move to Trash is hidden while the item is on a screen** (`isInScreen`,
     `BackgroundMediaItemComp`) — clear/hide the screen first; a missing entry there is not
     a bug.
   - **On-disk fallback** for anything that never reached the list (failed/partial
     download, app already closed). The names start with `[MV]`, and `[` is a
     character-class metacharacter for PowerShell's `-Path`, so filter objects and pipe
     them rather than globbing — and list the matches before deleting:

     ```powershell
     "$env:USERPROFILE\Desktop\open-worship-data-dev\videos",
     "$env:USERPROFILE\Desktop\open-worship-data-dev\audios" | ForEach-Object {
         Get-ChildItem -LiteralPath $_ |
             Where-Object { $_.Name -like '*Flowers by*Official Music Video - YouTube*' -or
                            $_.Name -like 'temp-*' } |
             Remove-Item   # binds PSPath → -LiteralPath; brackets stay literal
     }
     ```

     (Dev data lives in `…\Desktop\open-worship-data-dev`, not the non-`-dev` dir — KB §10.
     A file removed behind the app's back leaves a stale thumbnail until the tab reloads.
     Sweeping someone's data dir is safer via the Recycle Bin —
     `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')`.)

   The end state of every run: **no copy of the canonical title and no `temp-*.part` in
   either dir**.
   This step still runs when MD-01/MD-02 are BLOCKED or failed — a partial download leaves
   the biggest debris.

Triage before filing (a 403 is usually NOT an app bug), the known orphaned-`.part` bug,
and the `(1)` de-duplication suffix are all documented in the matrix §MD — read it before
reporting a download failure. A `(1)` on the run's *first* download means step 0 was
skipped, not that the app misbehaved.

### 6f. PRESENTING_FLOW DEEP MODE — the run sheet, exhaustively (argument `presentingFlow`)

The Presenting Flows panel is the app's **run sheet**: the one panel an operator looks at for the
whole service. It is also the subsystem that grew fastest (actions, CC elements, the two
clocks, pinning, hotkeys, archives — all since 2026-08-04), so it carries the most rules
per square centimetre in the app and the most ways to ship a silent regression.

**Trigger.** The argument names the run sheet — `presentingFlow`, `presentingFlows`, `run sheet`,
`.owpf`. That is **not a focus area that trims the run**; it selects a MODE:

- **Coverage accounting (§6b) is ON**, exactly as in full-coverage mode, with
  `"focus": "presentingFlow"` in `coverage-<runid>.json`. Every row in the scope set below ends
  the run with a status. Resume the newest matching state file rather than restarting.
- **The three mandatory blocks still run** (§6a screen, §6d locale, §6e media) — and §6a
  is ridden *from the presenting flow* (present a row, drive the `screen.html` target), so it
  costs almost nothing extra here.
- **The phases below are run in order**, each with its own evidence. A phase that is
  skipped is reported as skipped, with its rows BLOCKED and the reason.

Since `203d35cc` (2026-08-04) the panel is **no longer dev-only**; it took the old Lyric
List's slot and ships in packaged builds. **No PL row may be marked BLOCKED for being
dev-only** (PL-49) — any note that still says so is stale.

**Read before driving anything:** knowledge-base **§14** (all of it — it is the model
behind every PL row and says which "odd" behaviours are deliberate), the matrix's **§PL**
rows themselves (their `Expected` column is the assertion — do not re-invent it), and
test-plan **§S20** for the recipe order.

#### Scope set (69 presenting flow rows + adjacencies)

> **PL-10, PL-29, PL-32..PL-76, PL-81..PL-102** — the run sheet itself.
>
> **Adjacent, required when the run touches them:** `PL-77..PL-80` + `NAV-17/18` (the
> single-document `.owadoc` and whole-data `.owadata` archives — the same three-layer
> archive code the presenting flow bundle rides on), `XW-01..07` (§6c: a document edited in
> another window must reach the sheet's rows), `SP`/`SC`/`LT`/`MD` (mandatory core).
>
> `PL-01..PL-09`, `PL-11..PL-28`, `PL-30/31` are the **Documents/Lyrics lists and the
> generic file-list chrome** — out of scope in this mode except where the fixture uses
> them (creating the scratch presenting flow, dropping files in).

#### P0 — Fixture: build the sheet you are going to drive

**Never test in the user's own presenting flows.** Create `zz-robot-<runid>` (list ⋮ → new) and
build it up by drop until it holds, at minimum, one of each thing the rest of the mode
needs: a **document**, a **single slide** of a document, a **lyric slide** (proves the
`stage` is carried — PL-64), a **background** image or colour, a **bible verse**, a
**foreground** marquee or countdown, and an **audio** track. Rows on the way in: PL-10,
PL-29, PL-43, PL-44, PL-57 (drop onto a collapsed card auto-opens it), PL-25/26 if you
drop from the OS.

Everything below writes to that file the moment you touch it — **there is no save button
in this panel** (KB §14.8), so "nothing happened" means the write failed.

#### P1 — What a row actually holds (PL-29, PL-37, PL-44, PL-52, PL-64, PL-69)

The reference/preset split (§14.2) is the panel's central design decision, and each half
must be proved once per run, in the direction that can regress:

1. **Reference** — edit a referenced document (a word in slide 1) and confirm the sheet
   projects the **new** text. A snapshot here would silently project last week's words.
2. **Preset** — a countdown/marquee row must replay its **own stored preset** (duration,
   text, styling), never a resolved date, however long ago it was added (PL-69).
3. **The row's title is a label captured on add** — renaming the underlying file does not
   change it. That is deliberate (resolving names would mean reading every referenced
   file just to draw the list); do not file it.
4. **Reveal Original** (PL-37) and the colour note (PL-52) round out the row's identity.

#### P2 — The tree: order, per-row state, marking (PL-32..PL-36, PL-41, PL-53, PL-62, PL-86..PL-88)

Expansion, reorder, **Move up/down/to Top/to Bottom** with their edge gating, **Duplicate**
(a copy that re-keys its uuid and drops an armed shortcut — PL-97), **Disable** (parked)
including a parked document's slides, the on-screen indicator at **all three levels**
(presenting flow card → element → slide), and expansion memory that follows the DOCUMENT rather
than the position (PL-53).

#### P3 — Actions, both families (PL-71..PL-74, PL-95, PL-96, PL-97)

The **Add Action** menu is four levels now: every clear folds behind **Clear Screen**, and
the eight per-widget foreground clears behind **Other Clear FG Items** inside it (PL-71).
Two families, and the difference is the whole point:

- **Screen actions** (14) — `apply(screenManager, presentingFlowItem)`. **Fire every one of
  them at least once against a real, showing screen** (PL-72, PL-74). They are the only
  presenting flow rows that write to a screen while carrying no content; a mis-wired clear is
  invisible in the tree. The fourteenth, `Slide: Media Control` (PL-102), is the odd one:
  it is NOT in the `Add Action` menu at all — it is attached to a slide from that slide's
  own menu (**Add Media Control**), its settings live on the attachment, and its pin
  NARROWS the host's screens rather than replacing them.
- **Run actions** (5) — they drive the RUN, not a screen: `Next: Interval`,
  `Next: Timeout` (also armable with a **time of day**), `Next: Clear Interval` (the
  interval's off switch as a line — PL-101), `Jump to`, `Keyboard Event`.
  Each has a menu that must NOT offer the screen family. PL-95 and PL-96 are the two
  longest rows in the matrix — read them in full, they enumerate every toast by title.

#### P4 — CC elements (PL-89..PL-93)

Followers that ride a host's present: attach by **drop** and from the **menu**, verify
propagation onto the screens in ONE gesture with no second "which screen?" question,
clicking a CC row reveals its original, and the round trip survives export/import. The two
refusals must not be confused: a clock says **This element does not accept CC element**, a
second one on a `Jump to` says **This element takes only one CC element**.

#### P5 — How a row reaches a screen (PL-33, PL-35, PL-81..PL-85) — carries the mandatory §6a block

Click, drag onto a mini screen, and the **Set Specific Screen** pin: it persists, it beats
the selected screens, and it is deliberately outranked by a force-choose and by a drag
(PL-83). A pinned screen that no longer exists must degrade, not throw (PL-84). Documents
carry both an element pin and per-slide pins (PL-85). **Present from this panel and drive
the real `screen.html?screenId=N` target here** — that discharges §6a inside the mode.

#### P6 — The floating preview is a PLAYER (PL-38, PL-42, PL-46..PL-48, PL-58..PL-61, PL-94, PL-98, PL-99)

The densest phase, and the one a quick pass always under-tests. §14.6 lists the rules; the
ones that regressed most recently:

- **The widget takes the keyboard the moment it opens** — the first press must work with
  nothing clicked first (PL-98).
- **Parked is the ONLY reason a line is stepped over**, and the landing **unfolds** what it
  reaches, entering a document at its FIRST slide once its slides arrive (PL-99). Walk the
  whole sheet **folded down** — that is the shape an operator reads it in.
- Fold memory, the restricted slide-card menu, the widget frame, and **every right-click
  menu mirroring the tree's** (PL-94).
- The clocks' pill, and that **only the run MOVING** touches them (PL-95).

#### P7 — Failure surfaces (PL-50, PL-51, PL-55, PL-56)

Empty/unreadable placeholders; a hand-corrupted `.owpf` entry that must become ONE error
row without taking the list with it **and must survive the next write of the file**; the
deliberate no-ops (cross-presenting-flow drag adds nothing — PL-55) and the unsupported-payload
toast (PL-56).

#### P8 — Archives, on real files (PL-39, PL-40, PL-45, PL-65..PL-68, PL-76)

Export → import round trip. The import contract is **all-or-nothing**: with a required
folder unset it must fail **before writing anything** (PL-66). Re-importing the same
bundle reuses same-named files and de-duplicates the presenting flow as `<name> (1).owpf`
(PL-67); a bible entry is re-created in the **Default** list (PL-68). A CDP-driven drop of
a real `.owapf.tar.gz` exercises the whole pipeline — fabricate the `dataTransfer` and
stamp `appFilePath` (KB §14.7).

#### P9 — Performance guards (PL-63, PL-70) — the rows that only hurt on the target hardware

Measure, do not eyeball: no `Maximum update depth exceeded` with a ~90-slide document
expanded, the clicked row marks **immediately** (it bypasses the 500 ms debounce), an
**idle** list opens no `.owpf` files at all, a collapsed document's slides are **released**,
and clicking a presenting flow row does not repaint every file row in the window (PL-63).

#### P10 — Locale, then restore

Run §6d over **this panel and its widget** — the presenting flow strings are listed in KB §14.8
and a missing Khmer key **throws** and blanks the page. Then restore: delete the scratch
presenting flow, remove what the import created (imported media, documents, the Default-list
verses), unpark anything you parked, unpin anything you pinned, stop any interval you
armed, and hide the screen you showed. Anything you cannot remove goes in the report by
name.

#### Techniques this mode depends on

- **Read the `.owpf` on disk** to prove what was written (dev data lives in
  `Desktop\open-worship-data-dev`, **not** the packaged dir) — the tree can be a stale HMR
  render while the file is already correct.
- **Never `import()` an app module inside `evaluate_script`** — it re-runs
  `document.onkeydown = …` and kills every shortcut in the window for the rest of the
  session.
- **A "dead key" is usually your own driving.** Closing nested context menus
  programmatically can leave the `KeyboardEventListener` layer stack polluted, after which
  the preview's keys stop firing (the tell: `ArrowDown` reports `defaultPrevented: true`
  while the run does not move). **Reload the page and retry before filing it** (KB §14.9).
- Synthetic `press_key` DOES drive the run keys and the `Keyboard Event` hotkey (they are
  ordinary `keydown` listeners); only Monaco needs real OS focus.

### 6g. Bible XML import from a URL `[ST-41..ST-50]` — run it when the focus touches Settings / Bible, and in every full-coverage run

Adding a translation from a link is how a real congregation gets its own bible in, and it is
the **only** path that exercises `readFromUrl` → `guessingBibleKey` → the Info editor's three
Monaco actions. It needs network. Model + CDP traps:
[knowledge-base.md](./references/knowledge-base.md) §15. Tutorial voice: **W-34**.

**Use the canonical NON-ENGLISH link.** An English XML structurally cannot fail this block,
because everything an import falls back to is already English:

```
https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBFBSBible.xml
```

1. **Scratch key.** Settings (gear → popup, never `navigate_page`) → **Bible**. Never reuse an
   installed key — pick `ZZ<runid>`. Note the installed keys first: the **Guessing keys**
   buttons in step 3 hide any key you already have, so `ពគប` will NOT be offered on a machine
   that has it. That absence is correct, not a bug.
2. **`[ST-41]`** Paste the link into `input[name=url]` (native-setter + `input` event), check
   the file group dims and **Import** enables, submit. Watch `LoadingComp` walk
   `Downloading file… → Reading file… → Deleting file…`; ~14 MB, allow a minute.
3. **`[ST-42]`** The **Key is missing** popup: record the guessing-key buttons (they are every
   root attribute split on `[.,\s]` minus taken keys), type the scratch key, and check a taken
   key marks `is-invalid` / "Key is already taken".
4. **`[ST-43]`** **Ok** → **Confirm Key for Bible** → **Yes**. Confirm on disk — and resolve
   `bibles-data` first, it hangs off `appLocalStorage.defaultStorage` and is **not**
   necessarily the `-dev` dir (KB §15.2). `saveJsonDataToXMLfile` reports success without
   checking the write, so the toast is not evidence.
5. **`[ST-44]`** Read the new `<key>.xml` head: it must show `locale="en-US"`, ASCII
   `number-map` and English `book-map`. **This is the finding the block exists for** — if a
   future build guesses the locale, that is a behaviour change to write up, not a pass.
6. **`[ST-45..ST-48]`** Pencil → **Info** → fix it up **in this order**:
   **🌎 Choose Locale** (`km-KH`) → **#️⃣ Edit Numbers Map** (**Use ១ ២ ៣**) → **📚 Edit Books
   Map** (**📖 Guessing Names** → the set naming your locale's bibles). Steps 2 and 3 read the
   locale out of the **editor buffer**, so out of order they silently offer English.
   Drive them with `.native-edit-context` `.focus()` + `press_key F1` — a synthetic
   `contextmenu` does not open Monaco's menu — and **match the palette row by label**, because
   it re-sorts the last-used command to the top.
7. **`[ST-49]`** **Save** (windows reload — expected), then open the reader's bible-key
   selector: the bible must have moved out of the **English** group into its own locale
   heading and render `(<key>) កិច្ចការ ២៨:១៥`. Screenshot that; it is the block's evidence.
8. **`[ST-50]` Teardown, always.** 🗑 → **Yes** trashes `<key>.xml` but **leaves
   `<key>.xml.cache`** (13 MB) — delete that folder yourself. Then restore anything the run
   moved: the reader's bible key, and any lookup-history entry the key switch added
   (`RendHistoryItemComp` → its red ✕).

**Report line** (required whenever this block runs): the scratch key used, ST-41..ST-50
statuses, the ST-44 defaults observed, and confirmation that both `<key>.xml` and
`<key>.xml.cache` are gone.

### 7. Report

- Write the full report to `test-results/robot-test/report-<timestamp>.md` (this folder
  is git-ignored) and keep screenshots beside it.
- **Every report** (focused or full) MUST contain the **mandatory screen block** (§6a)
  results: the SP-01/SP-02/SC-01/SC-02 statuses and the screenshot taken from the
  `screen.html` target. If the block was skipped (EX-02 live-use exception), the report
  must state that and why.
- **Every report** MUST also contain the **mandatory locale block** (§6d): the
  `LT-01/LT-02` statuses, which locale was switched to, the screens re-walked in it, and
  an explicit statement that no `Translation for text "…" not found` error appeared (or
  the list of the ones that did, each a Critical finding). Confirm the starting locale
  was restored.
- **Every report** MUST also contain the **mandatory media block** (§6e): the
  `MD-01/MD-02` statuses with the on-disk evidence (the video file and the `.mp3`), since
  no other row touches the extra-bin yt-dlp/ffmpeg/qjs, **plus `MD-04`** — how many
  leftovers the pre-download sweep found and the post-run listing showing both dirs clean.
  BLOCKED is acceptable only with no network, and must say so; `MD-04` is never BLOCKED.
- In **presenting flow deep mode** (§6f) the report MUST additionally carry: the per-phase table
  (P0..P10 → status), the coverage summary over the 69-row scope set, the fixture's name
  and **what was torn down vs. left behind**, and — because they are the rows most easily
  faked — an explicit line each for the **13 screen actions fired against a showing
  screen** (PL-72/74), the **folded-sheet walk** (PL-99) and the **performance
  measurements** (PL-63/70) with their numbers.
- In full-coverage mode the report MUST include the **coverage summary** (template in
  [references/test-plan.md](./references/test-plan.md)): the formula result
  (`exercised / (total − EXCLUDED)`), plus every BLOCKED / PARTIAL / EXCLUDED row with
  its reason. The coverage claim must be reproducible from the `coverage-<runid>.json`.
- In chat, summarize the top issues with **severity** (Critical/High/Medium/Low/Info),
  each with: what was tested, expected vs actual, evidence (screenshot path / console
  line / failed request), and a suggested fix or file to look at — plus the coverage %
  when in full-coverage mode.

### 8. Cleanup

- **Files the run created must not outlive it.** Before killing anything, confirm the
  media block's teardown actually happened (`MD-04`, §6e step 5): the videos and audios
  dirs hold no copy of the canonical title and no `temp-*.part`. This is the one block that writes
  ~100 MB per run, and the app suffixes duplicates instead of overwriting, so a missed
  teardown compounds silently. The presenting flow fixture (`zz-robot-<runid>`, §6f) and any
  scratch document/web item go the same way.
- If YOU started `npm run dev` in step 2, **kill that terminal** to stop Vite + Electron
  (`concurrently -k` tears down both children).
- If the app was already running (step 1), leave it alone.
- Do not delete `test-results/robot-test/` — those are the deliverables.

### 9. Tutorial mode — generate a help page from the live app

When asked for a tutorial, help page, or user guide (argument `tutorial`, optionally
naming workflows/pages):

1. Connect to the live app (steps 0–3).
2. Walk the requested workflows from
   [references/user-workflows.md](./references/user-workflows.md) (all of them if
   unspecified) **performing every step for real**. At each `📸` checkpoint, put the
   app in exactly that state and `take_screenshot` into
   `test-results/robot-test/tutorial-<runid>/` with a name like `w03-2-slide-live.png`.
3. Write the tutorial using the workflow text as the base — same step order, same
   labels (use the labels of the **current locale**, and mention the other locale's
   label once, as the workflows do). Keep the `W-xx` IDs as anchors/headings so future
   verification can map back. Output: a markdown page next to the screenshots, or an
   HTML Artifact if the user wants a shareable page.
4. **Divergence rule:** if the live app does not match a workflow step, STOP treating
   the workflow as truth for that step: decide bug vs. drift (check `src/` and
   [references/knowledge-base.md](./references/knowledge-base.md)). App bug → file a
   Finding and write the tutorial to the *intended* behavior with a note. Doc drift →
   **fix `user-workflows.md` in the same run** (bump `workflowsVersion`) and generate
   from the corrected text. Never publish a tutorial step you did not see work.
5. Restore any state you changed (KB §10) and clean up per step 8.

### 10. Doc-verify mode — check a learning document against the app

When given a manual/tutorial/learning doc (argument `verify-doc <path-or-url>`):

1. Read the document and split it into **discrete, checkable claims** — each numbered
   step, named control, label, shortcut, or described outcome is a claim.
2. Map each claim to a `W-xx` workflow and/or coverage-matrix rows; claims with no
   mapping get an ad-hoc replay (and are candidates for a new workflow entry).
3. Connect to the live app (steps 0–3) and **replay every claim**, capturing evidence
   like a normal run. Statuses per claim:
   - **MATCH** — the app does what the doc says (evidence attached).
   - **DRIFT** — doc says X, app does Y: quote the doc line, state the observed
     behavior, attach a screenshot. Decide (via `src/` + git history) whether the doc
     is stale or the app regressed — say which.
   - **UNTESTABLE** — policy exclusion (EX-xx) or blocked; give the reason.
   - **NOT-IN-APP** — the doc describes a feature that does not exist.
4. Also report **gaps**: workflows in `user-workflows.md` that the document never
   covers (a completeness signal for the doc's author).
5. Write `test-results/robot-test/doc-verify-<runid>.md`: per-claim table
   (claim → status → evidence), the drift list with suggested doc wording, and a
   verdict. **Every claim gets a status — no silent skips**, same honesty rules as
   coverage accounting (§6b).
6. If the run reveals that `user-workflows.md` itself is wrong, fix it too — it is the
   source of truth and must never knowingly lag the app.

## What counts as a UI/UX issue

- **Console**: uncaught errors, React warnings/keys, unhandled promise rejections,
  failed dynamic imports.
- **Network**: `4xx`/`5xx`, blocked/CORS, broken images/media, missing assets.
- **Interaction**: a tab/button that doesn't respond or doesn't toggle its state
  (`.active` on nav tabs, `.app-on-screen` when content is sent to the screen); modal
  that won't open/close (`Ctrl+B` opens Bible lookup, `Ctrl+Q` closes modal).
- **Cross-window propagation** (§6c / XW): an edit in one window that never reaches another
  window (editor→Presenter preview / list-row) — the regression class a one-window run
  structurally can't see. Saved and **unsaved** edits both must propagate (unsaved state is
  disk-backed in `<file>.histories/<n>-head` — KB §12.2b); the live `screen.html` of an
  already-presented slide is the one deliberate exception. Name the broken hop (KB §12.2).
- **Visual**: clipped/overflowing text, overlapping elements, invisible or low-contrast
  text, broken/blank images, layout shift, a `loading.gif` that never disappears.
- **Accessibility**: icon-only buttons with no accessible name, controls missing roles
  or labels, focus traps. (`take_snapshot` exposes the a11y tree — flag unnamed nodes.)
- **Performance** (optional): use `mcp_chrome_devtoo_performance_start_trace` /
  `stop_trace` around a heavy action (e.g. loading a document) and flag long tasks.

## Troubleshooting

- **CDP never comes up**: check the `npm run dev` terminal output — Electron only starts
  after `electron:build` finishes (slow on first run). Confirm the `electron .` line ran.
- **MCP "connection refused"**: the MCP attaches to a running Electron; if it errors, the
  app isn't up yet — re-run the wait script (step 2) before retrying MCP tools. Verify
  `.mcp.json` uses `--browserUrl=http://127.0.0.1:9223`.
- **Wrong target selected**: there is normally ONE main window target — keep using it and
  switch pages with `navigate_page` (step 5), not by opening new tabs. A separate
  `screen.html?screenId=N` target exists **only while that screen is showing** — select
  it for the mandatory screen block (§6a), and select the presenter target back
  afterward. Never `navigate_page` the main window to `screen.html`.
- **Stuck on Settings / can't navigate away (`ERR_ABORTED`)**: you loaded a **popup-only**
  page (`setting.html`, `about.html`, …) in the main window (see step 5 warning). That state
  can't navigate out and persists `mainHtmlPath`. Recover: stop the app, set `mainHtmlPath`
  back to `"presenter.html"` in `%APPDATA%/open-worship-app/setting.json` (keep the other
  keys), relaunch. Details: [references/knowledge-base.md](./references/knowledge-base.md) §3.
- **Port 9223 busy / single-instance**: a stale OWA instance holds the port and lock —
  reuse it (step 1) or close it before starting a fresh run.
- **HTTPS cert warnings**: the Vite dev server uses a self-signed cert; Electron ignores
  cert errors in dev. This does not affect the MCP (it talks to Electron, not Vite).

## Resources

- [references/knowledge-base.md](./references/knowledge-base.md) — **read first**: verified
  observation notes — what to observe, expected-vs-noise, locale handling, the popup/settings
  trap + recovery, interaction gotchas, and a known-good baseline to diff against.
- [scripts/wait-for-debugger.mjs](./scripts/wait-for-debugger.mjs) — polls the CDP
  endpoint and exits when the target page is attached.
- [references/ui-map.md](./references/ui-map.md) — windows, regions, selectors, readiness
  signals, keyboard shortcuts.
- [references/components-path.md](./references/components-path.md) — every page → its
  component tree → the interactive tests each component supports (click/drag/drop/keyboard).
- [docs/test-paths/coverage-matrix.md](../../../docs/test-paths/coverage-matrix.md) — the
  **coverage contract**: ~761 stable-ID rows over the whole UI surface — every interactive
  path enumerated as a unit test with an observable pass condition and a `(src: file:line)`
  citation, including a complete keyboard-shortcut matrix (`KB-01..60`, every registered
  shortcut incl. bible-editing, canvas/slide, finder, and electron-menu accelerators) and
  a context-menu-item matrix (`CM-01..99`). Screen controlling & presenting rows
  (`SP`/`SC`) and the locale-switch rows (`LT-01..02`) are mandatory in every run; the
  file also carries the policy-exclusion table, statuses, evidence rule, and the coverage
  formula for full-coverage runs. **Note:** this file lives under `docs/test-paths/`, not
  in this skill's `references/`.
- [coverage-expansion/](./coverage-expansion/) — provenance for the 2026-07-18 matrix
  expansion: the per-subsystem source-sweep inventories (`discover-*.md`) and the
  finalized per-section row fragments (`final/*.md`) each row was derived from, with
  `src` line citations. Regenerate/extend these when re-sweeping `src/`; they are
  research artifacts, not runtime references.
- [references/user-workflows.md](./references/user-workflows.md) — the **tutorial source
  of truth**: user-facing `W-xx` task recipes in tutorial voice with `📸` screenshot
  checkpoints and EN/KM labels, each traceable to matrix rows; feeds tutorial mode (§9)
  and doc-verify mode (§10).
- [references/test-plan.md](./references/test-plan.md) — scenario checklist, severity
  scale, and the report template. **§S20** is the presenting flow deep mode's step-by-step
  recipe; **KB §14** is its model.
