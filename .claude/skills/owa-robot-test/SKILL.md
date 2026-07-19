---
name: owa-robot-test
description: 'Autonomous QA / robot end-to-end UI/UX testing of the RUNNING Open Worship App (Electron + React + Vite) through chrome-devtools-mcp — and the SOURCE OF TRUTH for user-facing documentation. Use when asked to robot test, QA test, smoke test, e2e test, or FULL-COVERAGE test the real app UI; to hunt for UI/UX bugs, visual glitches, console errors, broken buttons/tabs, dead links, or accessibility problems on the live app; OR to generate a tutorial / help page / user guide for the app, or to verify a learning document / manual / tutorial against the real app behavior. The workflow starts "npm run dev", waits until the Electron remote-debugging (CDP) endpoint on port 9223 is attached, connects the Chrome DevTools MCP, walks the presenter / reader / slide-editor / settings / popup-window UI like a QA engineer, captures screenshots + console + network, and reports findings by severity. Screen controlling & presenting checks (present content, drive the screen.html output target, clear/restore) are MANDATORY in every run, whatever the focus area. Full-coverage runs are tracked row-by-row against references/coverage-matrix.md (~535 stable-ID rows incl. a full keyboard-shortcut matrix KB-01..60 and a context-menu-item matrix CM-01..92, resumable across sessions via a coverage-<runid>.json state file). Tutorial/doc work is grounded in references/user-workflows.md (stable W-xx task recipes with screenshot checkpoints, each traceable to matrix rows).'
argument-hint: '[focus area e.g. "presenter", "bible lookup" — or "full" for a tracked full-coverage run — or "tutorial [workflows]" to generate a help page — or "verify-doc <path|url>" to check a learning document against the live app]'
---

# OWA Robot Test — QA e2e via chrome-devtools-mcp

Drive the **live** Open Worship App like a human QA engineer and report real UI/UX
issues. This is black-box testing against the actually-running Electron window, not
unit or Playwright tests.

> **Read first:** [references/knowledge-base.md](./references/knowledge-base.md) — verified
> field notes on **what to observe**, expected-vs-noise (which console/network output to
> ignore), and the traps that ruin a run (dynamic Khmer/English locale, popup-only windows,
> the `setting.html` navigation trap, restoring live state). Skim it before you start.

## When to use

- "Robot test the app", "QA the UI", "smoke test the running app", "find UI issues".
- After a feature/refactor, to verify nothing is visually or interactively broken.
- To collect console errors, failed network requests, and accessibility gaps from the
  real renderer.
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
| Finder / Lyric Editor / Bible Note / Web Editor / About / Screen | popup windows — see [references/ui-map.md](./references/ui-map.md) |

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
each per step 5. **Whatever the focus, the screen-controlling block (§6a) always runs.**

If the user asked for **"full"**, **"everything"**, or a **coverage percentage/target**
(e.g. "99% coverage"), run in **full-coverage mode** — see "Coverage accounting" below —
where every row of [references/coverage-matrix.md](./references/coverage-matrix.md) must
end the run with a status. For every scenario:

1. `take_snapshot` to get fresh `uid`s.
2. Interact: `click` / `fill` / `hover` / `press_key` / `drag` using the labels &
   selectors in [references/ui-map.md](./references/ui-map.md).
3. `take_screenshot` after the interaction (before/after pairs are ideal).
4. Re-read console + network to catch new errors triggered by the action.
5. Record anything under **"What counts as an issue"** below.

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
test-plan.md §S7.

Minimum pass (≈5 minutes, self-restoring):

1. **Present something real** — single-click a slide thumbnail (present is a
   single-click TOGGLE — KB §5) or double-click a bible verse. Verify `.app-on-screen`
   appears and the mini-screen preview renders it (`PR-04`).
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
[references/coverage-matrix.md](./references/coverage-matrix.md) (~535 rows with stable
IDs like `PM-29`), including the exhaustive keyboard-shortcut matrix (`KB-01..60`) and
the context-menu-item matrix (`CM-01..92`). The contract: **every in-scope row ends the run PASS, FAIL, PARTIAL,
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
4. `ST` settings last-but-one — `LT` locale/theme spot-checks ride on `ST-04/05`, restore
   everything, and `ST-08 Apply Settings` goes **very last** because it reloads windows.

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

**Run scenario [test-plan.md §S18], rows `XW-01..07`, whenever the run touches the editor,
the document/lyric/playlist lists, or the `useFileSourceEvents`/file-reload wiring** (a
focused "test the editor" run included). In short (full recipe + why-CDP-can't-edit +
CDP-drivable-edit techniques are in **KB §12** — read it first):

1. Use a **scratch doc** shown in the Presenter (present slide 1 to also cover the screen).
2. Open its editor as a **separate window** (NAV-21 `bi-box-arrow-up-right` external icon /
   a doc's **Edit ↗** → `openPopupWindow`), **not** the in-place `Slide Editor` tab — so both
   `appDocumentEditor.html` and `presenter.html`/`screen.html` targets exist.
3. Make a **CDP-drivable** edit in the editor target (CDP can't drag/Monaco-type — OS focus):
   `fill` the Box **Position/Size/Rotate** (ED-19) or slide **W/H** (ED-17) numeric inputs, a
   programmatic `CanvasController` mutation, or direct `fileSource.writeFileData(json)`; then
   **Save**.
4. **Assert propagation** within ~3 s in the auto-reload targets: Presenter `VarySlidesComp`
   (XW-01), list-row thumbnail (XW-02). A stale target after a **saved** edit = **regression
   → FAIL + Finding** naming the broken hop. An **unsaved** edit not showing is **correct**
   (XW-04). For the live `screen.html` of a **presented** slide (XW-03): staying stale after
   a saved edit is **expected** (intentional snapshot) — verify by **re-presenting** and
   confirming the screen *then* updates; only a broken re-present is a FAIL.
5. **Restore** with editor **Undo** (never *Discard*) + re-save; delete the scratch doc.

Caveat: opening/closing the separate editor window can trigger a chrome-devtools-mcp "browser
reconnected" — re-`list_pages`/`select_page` after each, and read screen visibility from
`.show-hide.showing`, not target enumeration.

### 7. Report

- Write the full report to `test-results/robot-test/report-<timestamp>.md` (this folder
  is git-ignored) and keep screenshots beside it.
- **Every report** (focused or full) MUST contain the **mandatory screen block** (§6a)
  results: the SP-01/SP-02/SC-01/SC-02 statuses and the screenshot taken from the
  `screen.html` target. If the block was skipped (EX-02 live-use exception), the report
  must state that and why.
- In full-coverage mode the report MUST include the **coverage summary** (template in
  [references/test-plan.md](./references/test-plan.md)): the formula result
  (`exercised / (total − EXCLUDED)`), plus every BLOCKED / PARTIAL / EXCLUDED row with
  its reason. The coverage claim must be reproducible from the `coverage-<runid>.json`.
- In chat, summarize the top issues with **severity** (Critical/High/Medium/Low/Info),
  each with: what was tested, expected vs actual, evidence (screenshot path / console
  line / failed request), and a suggested fix or file to look at — plus the coverage %
  when in full-coverage mode.

### 8. Cleanup

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
- **Cross-window propagation** (§6c / XW): a **saved** edit in one window that never
  reaches another window (editor→Presenter preview / list-row / live `screen.html`) — the
  regression class a one-window run structurally can't see. Confirm the edit was *saved*
  (unsaved-not-showing is correct), then name the broken hop (KB §12.2).
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
- [references/coverage-matrix.md](./references/coverage-matrix.md) — the **coverage
  contract**: ~535 stable-ID rows over the whole UI surface — every interactive path
  enumerated as a unit test with an observable pass condition and a `(src: file:line)`
  citation, including a complete keyboard-shortcut matrix (`KB-01..60`, every registered
  shortcut incl. bible-editing, canvas/slide, finder, and electron-menu accelerators) and
  a context-menu-item matrix (`CM-01..92`). Screen controlling & presenting rows
  (`SP`/`SC`) are mandatory in every run; the file also carries the policy-exclusion
  table, statuses, evidence rule, and the coverage formula for full-coverage runs.
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
  scale, and the report template.
