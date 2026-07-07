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
| Presentation output | `https://localhost:3000/screen.html` | Appears when presenting to a screen |
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
- `screen.html` (presentation output) normally appears as its own target only while
  presenting; you can also open it directly for isolated testing.

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
- **Documents** list: header text `Documents`; items are `li.list-group-item`
  (selected item has `.active`); icons `bi bi-file-earmark-slides` / `-pdf` etc.
- **Lyrics** list: header text `Lyrics`; items `li.list-group-item`, icon
  `bi bi-music-note`.
- **Playlist** list: dev builds only.

### Middle column — presenter + background
- **Presenter tabs** (`.nav.nav-tabs`): `Documents`, `Lyrics`, `Bibles`, `Foreground`.
  Active tab has `.active`; a tab shows `.app-on-screen` when its content is live on the
  presentation screen.
  - Documents tab: slide thumbnails container; footer has a size range slider
    (`.app-range`) and the current document path.
  - Foreground tab: countdowns, marquees, clocks/timers, web overlays, cameras, image
    slideshows.
- **Fullscreen toggle** (presenter header, top-right): icon `bi bi-fullscreen` /
  `bi bi-fullscreen-exit`.
- **Background tabs** (`.nav.nav-tabs`): `Colors`, `Images`, `Videos`, `Cameras`,
  `Web`, `Audios`. The Audios tab shows `.app-on-screen` while audio plays.

### Right column — bible + mini screen
- **Bibles / Notes** sub-tabs: headers `Bibles` and `Notes`; lists are
  `li.list-group-item`.
- **Mini screen preview**: `div.card.app-zero-border-radius` — live preview of the
  presentation output; footer zoom range slider.

## Modals

- Container: `#modal-container`.
- Close: `button.btn-danger` with icon `bi bi-x-lg`; shortcut **Ctrl+Q**.
- Bible Lookup modal: opened by the `Bible Lookup` button or **Ctrl+B**; has a reference
  input, a history dropdown, and a results/verse panel.

## Settings window (`setting.html`)

Known visible buttons (from the existing e2e smoke test): `Apply Settings`, `General`,
`Set Default Data`. Title matches `/Settings/`.

## Keyboard shortcuts worth testing

| Shortcut | Action |
|---|---|
| Ctrl+B / Cmd+B | Open Bible Lookup |
| Ctrl+Q | Close current modal |
| Arrow keys / Enter | Navigate slide thumbnails (when the slide container is focused) |

## Stable ids present in production

`#root`, `#app-header`, `#app-body`, `#modal-container`, `#app-custom-style`.

## Targeting tips for chrome-devtools-mcp

- `take_snapshot` returns nodes with `uid`s + accessible names — click/fill by matching
  the visible label (e.g. `Documents`, `Bible Lookup`, `General`).
- For state assertions use `evaluate_script`, e.g. check the active presenter tab:
  `() => document.querySelector('.nav-tabs .nav-link.active')?.textContent?.trim()`
- To detect "on screen" content:
  `() => [...document.querySelectorAll('.app-on-screen')].map(el => el.textContent.trim())`
