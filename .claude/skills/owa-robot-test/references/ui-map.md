# OWA UI Map (for robot testing)

The app uses **Bootstrap semantic classes + accessibility roles + button text**, with
very few `data-testid`s in production code. So target elements by **visible text /
role / icon** in the `take_snapshot` output. Use CSS classes only with
`evaluate_script` for state checks.

## Windows & dev URLs

Main window in dev loads `presenter.html`. Other windows open on demand.

| Window | Dev URL | Notes |
|---|---|---|
| Presenter (main) | `https://localhost:3000/presenter.html` | Default main window |
| Bible Reader | `https://localhost:3000/reader.html` | |
| Slide/Doc Editor | `https://localhost:3000/appDocumentEditor.html` | Opens when editing a doc |
| Settings | `https://localhost:3000/setting.html` | Gear button |
| Presentation output | `https://localhost:3000/screen.html?screenId=N` | **CDP target while showing** (toggle via `ShowHideScreen`/`F5`); target vanishes when hidden — hidden logs forward via `all:app:log` to the dev terminal |
| Finder | `https://localhost:3000/finder.html` | |
| Lyric Editor | `https://localhost:3000/lyricEditor.html` | |
| Bible Note | `https://localhost:3000/bibleNote.html` | |
| Web Editor | `https://localhost:3000/webEditor.html` | |
| About | `https://localhost:3000/about.html` | |

## Changing pages (routing)

The app is multi-page (one HTML file per page), not a client-side SPA router. It changes
pages by setting `location.href` to a different `.html` (see `goToPath()` in
`src/router/routeHelpers.tsx`). For robot testing, drive this directly:

- **Navigate the main window** to another **main-window** page (`presenter.html`,
  `reader.html`, `appDocumentEditor.html`) with `mcp_chrome_devtoo_navigate_page` using the
  dev URL above (e.g. `https://localhost:3000/reader.html`). Reuse the same window; the
  Electron preload stays attached, so `window.electron` keeps working.
- ⚠️ **Do NOT navigate the main window to a popup-only page** (`setting.html`, `about.html`,
  finder, lyric/bible/web editors) — it traps the window (`ERR_ABORTED`, persisted
  `mainHtmlPath`). Open those via their button and pick up the new target with `list_pages`.
  See [knowledge-base.md](./knowledge-base.md) §2–§3.
- **Or click the header tabs** `Presenter` / `Bible Reader` / `Slide Editor` (they call
  `goToPath`) and assert the URL changed — this also tests the navigation UX.
- `Slide Editor` needs a selected Open Worship document; without one it shows the alert
  "No slide selected" instead of navigating.
- After navigating, re-run the readiness check below — it is a full document reload.
- `screen.html?screenId=N` (presentation output) is its own CDP target **while the
  screen is showing** — reach it via `ShowHideScreen`/`F5` then `list_pages` →
  `select_page`. Driving it once per run is **mandatory** (SKILL §6a). Never
  `navigate_page` the main window to it.

## Readiness signals

- `#root` initially contains `<img class="loading" src="/loading.gif">`. When React
  mounts, that image is removed. A persistent `.loading` image = bug.
- **Page-agnostic ready check** (works on every page) via `evaluate_script`:
  `() => { const r = document.getElementById('root'); return !!r && r.children.length > 0 && !r.querySelector('img.loading'); }`
- Per-page hints (after the generic check passes):
  - `presenter.html` / `appDocumentEditor.html`: `#app-header` + `#app-body` exist; main
    tabs and the `Bible Lookup` button are visible.
  - `reader.html`: renders `BibleReaderComp` directly — NO `#app-header`; wait for the
    bible reader content, not the header.
  - `setting.html`: title matches `/Settings/`; `General` + `Apply Settings` buttons.
  - popups (`lyricEditor` / `bibleNote` / `webEditor`): generic check only.

## Top app header (`#app-header`)

- **Main navigation tabs** (`.nav.nav-tabs` of `button.nav-link`): `Presenter`,
  `Bible Reader`, `Slide Editor` (conditional — needs a selected document),
  `(dev)Experiment` (dev only). Selected tab has `.active`.
- **Bible Lookup** button (center): text `Bible Lookup`, icon `bi bi-book`. Shortcut
  **Ctrl+B** (Cmd+B on mac). Opens the lookup modal.
- **Settings** button (top-right): icon `bi bi-gear-wide-connected`, title `Setting`.
  Opens `setting.html`.
- **Help** button (top-right): icon `bi bi-question-circle` (opens external help).

## Presenter window layout (3 resizable columns)

### Left column — lists
Two widgets only, top to bottom: **Documents**, then **Presenting Flows**. The separate
**Lyrics** list is gone — `.owl` lyrics live in the Documents list (icon
`bi bi-music-note`) — and the Presenting Flows panel took its slot (`203d35cc`, 2026-08-04).

- **Documents** list: header text `Documents`; items are `li.list-group-item`
  (selected item has `.active`); icons `bi bi-file-earmark-slides` / `-pdf` /
  `-music-note` (lyric) etc.
- **Presenting Flows** list: header text `PresentingFlows` (តារាងកម្មវិធី); present in **every**
  build — no longer dev-gated. Cards are `li.list-group-item`; inside an opened card the
  elements are `.app-presenting-flow-row` (`.app-presenting-flow-row-error` for a damaged entry,
  `.app-on-screen` on the label while live). Header icon `bi-window-stack` opens the
  floating preview (`.app-presenting-flow-preview`, portaled to `body`). See knowledge-base §14.

#### Presenting Flow deep-mode selectors (the assertions PL-32..PL-99 are read from)

Prefer these over text — the labels are translated, these are not. Component elements can
also be found by `[data-react-comp-name="PresentingFlowRowComp"]` etc.

| selector | means |
|---|---|
| `.app-presenting-flow-row` | one element row in the tree |
| `.app-presenting-flow-row-index` / `.app-presenting-flow-row-id` | its position number / its badge (`#3`, or an action's glyph — **tinted with the icon's colour for an action**) |
| `.app-presenting-flow-row-icon` | the kind icon; its inline `color` is the action's colour |
| `.app-presenting-flow-row-chevron` | the expand/collapse affordance (absent = nothing to expand) |
| `.app-presenting-flow-row-disabled` + `.app-presenting-flow-row-disabled-icon` | **parked**; `…-icon-presenting-flow` + `…-label-parked` + `bi-slash-circle` = parked by the RUN SHEET, plain `bi-eye-slash` = hidden by the document |
| `.app-presenting-flow-row-disabled-presenting-flow` | the whole presenting flow card is parked |
| `.app-presenting-flow-row-screen-pin` | a **Set Specific Screen** pin is on this row (PL-81..85) |
| `.app-presenting-flow-row-color-note` | the colour dot (PL-52) |
| `.app-presenting-flow-cc-row` | a **CC element** row (PL-89..93) |
| `.app-presenting-flow-row-dragging-over` / `…-over-cc` | the drop target is a REORDER / an ATTACH-AS-CC — the two drops differ only by this class |
| `.app-presenting-flow-row-error` | a damaged entry (PL-51) |
| `.app-presenting-flow-preview` | the floating widget, portaled to `body` |
| `.bi-window-stack.app-presenting-flow-preview-showing` | on a presenting flow card's header icon: **this** is the presenting flow the one widget is showing (only ever one) |
| `.app-presenting-flow-preview-item` (`…-body`, `…-chevron`, `…-label`) | one element inside the widget; **the chevron's state is the fold memory** (PL-58) |
| `.app-presenting-flow-preview-item-selected` | **the run's cursor** — cyan `--bs-info` outline, on the label AND the slide card. Distinct from the magenta blinking `.app-highlight-selected`, which means "live on a screen" and can be on several cards at once |
| `.app-presenting-flow-preview-item-disabled` / `.app-presenting-flow-preview-slide-disabled` (+ `…-icon`) | parked element / parked slide inside the widget |
| `.app-presenting-flow-preview-auto-next` (`…-interval`, `…-paused`, `…-button`) | the clock pill at the widget's top-right (PL-95) |
| `.app-presenting-flow-preview-cc-rows` | the CC rows under a slide card |
| `.app-presenting-flow-preview-collapsing-buttons` | **Collapse All** / **Expand All** (PL-47) |

### Middle column — presenter + background
- **Presenter tabs** (`.nav.nav-tabs`): `Documents`, `Lyrics`, `Bibles`, `Foreground`.
  Active tab has `.active`; a tab shows `.app-on-screen` when its content is live on the
  presentation screen.
  - ⚠️ **This group is multi-select** — several tabs can be `.active` simultaneously and they
    split the middle column (verified 2026-07-26). A per-group
    `querySelector('.nav-link.active')` returns only the **first** active tab, so it will
    report "restored" while an extra panel is still open. Read `.active` off **every**
    `.nav-link`, and diff the baseline screenshot when restoring state.
  - Documents tab: slide thumbnails container; footer has a size range slider
    (`.app-range`) and the current document path.
  - Foreground tab: countdowns, marquee top/bottom, clocks/timers, web overlays, cameras, image
    slideshows.
- **Fullscreen toggle** (presenter header, top-right): icon `bi bi-fullscreen` /
  `bi bi-fullscreen-exit`.
- **Background tabs** (`.nav.nav-tabs`): `Colors`, `Images`, `Videos`, `Cameras`,
  `Web`, `Audios`. The Audios tab shows `.app-on-screen` while audio plays.

### Right column — bible + mini screen
- **Bibles / Notes** sub-tabs: headers `Bibles` and `Notes`; lists are
  `li.list-group-item`.
- **Mini screen preview**: `div.card.app-zero-border-radius` — one previewer card
  **per screen** (`.mini-screen.card`, `data-screen-key`); footer zoom range slider.
  Each card is the **screen-controlling surface** (testing it is mandatory — SKILL §6a):
  - Header: show/hide screen toggle (`F5`, `.showing` when on) · clear buttons
    eraser/`BG`/`SL`/`BB`/`FG` (`F6`–`F10`; outline = layer empty, solid = live) ·
    screen-id badge (`data-screen-id`) · color-note dot · lock icon
    (`bi-unlock` green / `bi-lock-fill` red).
  - Footer: display button `label(screenId):displayId` (menu of OS displays) ·
    `Tr:` transition buttons `Slide:`/`Background:` (menu: none/fade/move/zoom) ·
    `bi-soundwave` audio-handlers toggle (only with a live video background; expands
    per-video `<audio controls>` players + repeat toggles) · stage `St: N` (menu 0–4).
  - Body: right-click a card → Solo/Select/Delete/Line-Sync/Refresh menu; right-click
    empty space → `Add New Screen`; cards accept drag-drop (slide/bg/foreground).

## Modals

- Container: `#modal-container`.
- Close: `button.btn-danger` with icon `bi bi-x-lg`; shortcut **Ctrl+Q**.
- Bible Lookup modal: opened by the `Bible Lookup` button or **Ctrl+B**; has a reference
  input, a history dropdown, and a results/verse panel.

## Toasts (`ToastComp`)

- Container: `.app-toast-stack` (fixed top-right, flex column). It only exists while at
  least one toast is alive — it unmounts when the last one goes.
- Each toast: `.toast.show.fade` (`role=alert`) with `.toast-header strong` (title),
  `.toast-body` (message), and `button.btn-close`.
- Toasts **stack** — newest is appended at the bottom, oldest is on top, capped at
  `MAX_STACKED_TOAST_COUNT` (5); past 5 the oldest are dropped.
- Every toast owns its own timer: default 4000 ms (`toast.timeout ?? 4e3`), hover
  (`mouseover`) clears only that toast's timer, `mouseout` restarts it at 2000 ms, and
  `.btn-close` removes only that one.
- **Dev-only trigger** (no UI action needed): `window.testSimpleToasts()` — defined in
  [toastHelpers.ts](../../../../src/toast/toastHelpers.ts) behind `appProvider.systemUtils.isDev`.
  It fires 3 toasts (`1:` / `2:` / `3:`) ~500 ms apart, which is exactly the
  stack-don't-replace case. Call it twice back-to-back (6 toasts) to exercise the 5-cap.
- Snapshot/`evaluate_script` probe:
  `() => [...document.querySelectorAll('.app-toast-stack .toast-header strong')].map(e => e.textContent)`
- Synthetic `mouseover`/`mouseout` (`bubbles: true`) drive hover-pause fine — these are
  bubbling handlers, not React enter/leave.

## Settings window (`setting.html`)

Title matches `/Settings/`. Tabs `General` / `Bible`, plus a fixed `Apply Settings`
button (top-right). The General tab holds: directory paths, `Khmer`/`English` language
toggle, theme, font family, and the destructive resets (`Reset All Child Directories` /
`Reset Widgets Size` / `Clear All Settings` — the old `Set Default Data` button is gone).

## Keyboard shortcuts worth testing

| Shortcut | Action |
|---|---|
| Ctrl+B / Cmd+B | Open Bible Lookup |
| Ctrl+Q | Close current modal |
| F5 | Toggle show/hide the presentation screen |
| F6 / F7 / F8 / F9 / F10 | Clear All / Background / Slide / Bible / Foreground |
| Arrow keys / Enter | Navigate slide thumbnails (when the slide container is focused) |
| Ctrl/Alt+ArrowLeft/Right | Prev/next bible verse (on the screen output window) |

> This is the short list. The **complete** shortcut set — every registered in-app shortcut
> plus electron application-menu accelerators — is enumerated as unit tests in
> [coverage-matrix.md](../../../../docs/test-paths/coverage-matrix.md) §KB (`KB-01..60`); right-click menu items are
> §CM (`CM-01..92`).

## Stable ids present in production

`#root`, `#app-header`, `#app-body`, `#modal-container`, `#app-custom-style`.

## Targeting tips for chrome-devtools-mcp

- `take_snapshot` returns nodes with `uid`s + accessible names — click/fill by matching
  the visible label (e.g. `Documents`, `Bible Lookup`, `General`).
- For state assertions use `evaluate_script`, e.g. check the active presenter tab:
  `() => document.querySelector('.nav-tabs .nav-link.active')?.textContent?.trim()`
- To detect "on screen" content:
  `() => [...document.querySelectorAll('.app-on-screen')].map(el => el.textContent.trim())`
