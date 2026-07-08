---
name: owa-robot-test
description: 'Autonomous QA / robot end-to-end UI/UX testing of the RUNNING Open Worship App (Electron + React + Vite) through chrome-devtools-mcp. Use when asked to robot test, QA test, smoke test, or e2e test the real app UI; to hunt for UI/UX bugs, visual glitches, console errors, broken buttons/tabs, dead links, or accessibility problems on the live app. The workflow starts "npm run dev", waits until the Electron remote-debugging (CDP) endpoint on port 9223 is attached, connects the Chrome DevTools MCP, walks the presenter / reader / slide-editor / settings UI like a QA engineer, captures screenshots + console + network, and reports findings by severity.'
argument-hint: '[optional focus area, e.g. "presenter", "bible lookup", "settings", "background", "lyrics"]'
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
node .github/skills/owa-robot-test/scripts/wait-for-debugger.mjs --timeout=3000 --interval=500
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
node .github/skills/owa-robot-test/scripts/wait-for-debugger.mjs --match=presenter.html --timeout=180000
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
each per step 5. For every scenario:

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

### 7. Report

- Write the full report to `test-results/robot-test/report-<timestamp>.md` (this folder
  is git-ignored) and keep screenshots beside it.
- In chat, summarize the top issues with **severity** (Critical/High/Medium/Low/Info),
  each with: what was tested, expected vs actual, evidence (screenshot path / console
  line / failed request), and a suggested fix or file to look at.

### 8. Cleanup

- If YOU started `npm run dev` in step 2, **kill that terminal** to stop Vite + Electron
  (`concurrently -k` tears down both children).
- If the app was already running (step 1), leave it alone.
- Do not delete `test-results/robot-test/` — those are the deliverables.

## What counts as a UI/UX issue

- **Console**: uncaught errors, React warnings/keys, unhandled promise rejections,
  failed dynamic imports.
- **Network**: `4xx`/`5xx`, blocked/CORS, broken images/media, missing assets.
- **Interaction**: a tab/button that doesn't respond or doesn't toggle its state
  (`.active` on nav tabs, `.app-on-screen` when content is sent to the screen); modal
  that won't open/close (`Ctrl+B` opens Bible lookup, `Ctrl+Q` closes modal).
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
  `screen.html` target appears only when presenting to a screen; ignore it unless you are
  testing the presentation output.
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
- [references/test-plan.md](./references/test-plan.md) — scenario checklist, severity
  scale, and the report template.
