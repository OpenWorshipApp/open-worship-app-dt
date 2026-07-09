# OWA Robot Test — Observation Knowledge Base

Field notes for agents/skills doing black-box QA of the **running** Open Worship App.
Everything here was **verified against the live app**, not inferred. Read this before a run
so you (a) know what a real bug looks like vs. expected noise, and (b) avoid the traps that
waste a run or disrupt the user's window.

Companion docs: [ui-map.md](./ui-map.md) (regions/selectors), [test-plan.md](./test-plan.md)
(scenarios/severity/report), [SKILL.md](../SKILL.md) (procedure).

---

## 0. TL;DR — the five things that bite you

1. **Locale is dynamic.** The UI may be **Khmer** or **English** (user setting). Never target
   by hard-coded visible text — target by role/structure/CSS class, or map labels (§1).
2. **Settings/About/editors are POPUP windows, not main-window routes.** Do **NOT**
   `navigate_page` the main window to `setting.html` — it traps the window (§2). Open them via
   their button and pick up the **new page target** with `list_pages`.
3. **A locale change or content change mid-run may be the USER**, who is often watching. Don't
   file it as a bug without confirming (this exact thing happened — the Khmer→English switch
   was the user).
4. **Most console output is expected dev noise** (Electron security warnings, React DevTools,
   `printHtmlText`, empty `[log]`). Don't report it (§5).
5. **Restore what you change** (live background, selected doc) and **don't take over the live
   window** (fullscreen / present-to-display) — the user may be using it (§8).

---

## 1. Localization is dynamic — target by structure, not text

- The app renders in **Khmer (`km-KH`)** or **English (`en`)**, switchable in
  Settings → Language (`Khmer` / `English` buttons).
- ⚠️ **Do NOT trust `window.localStorage['language-locale']`** — it is a stale leftover key
  (verified 2026-07-08: it read `"km-KH"` while the UI rendered English). Settings now go
  through `appLocalStorage` (`src/helper/settingHelpers.ts` → `getSetting`), which is a
  separate store. To read the real locale: open Settings → Language and see which button is
  highlighted, or check `document.documentElement.lang` (follows the active render).
- **Consequence:** the same button reads `ស្វែងរកព្រះគម្ពីរ` or `Bible Lookup` depending on
  locale. Snapshot `uid`s and text both shift.
- **Do:** click by `button.nav-link` + CSS state (`.active`, `.app-on-screen`), by icon class
  (`bi-*`), by `role`/accessible name, or by position. Read state with `evaluate_script` on
  classes. **Don't:** match literal Khmer/English strings unless you first read the current
  locale.
- If the locale changes during your run and you didn't change it, **assume the user did** and
  confirm before reporting.

### Khmer ↔ English label map (verified)
| English | Khmer | Where |
|---|---|---|
| Slide Editor | កែសម្រួលស្លាយ | header tab |
| Bible Reader | អានព្រះគម្ពីរ | header tab |
| (dev)Experiment | (dev)ការសាកល្បង | header tab (dev) |
| Bible Lookup | ស្វែងរកព្រះគម្ពីរ | header button (Ctrl+B) |
| Setting | ការកំណត់ | header gear |
| Documents | ឯកសារ | list + presenter tab |
| Lyrics | អក្សរភ្លេង | list + presenter tab |
| Bibles | ព្រះគម្ពីរ | presenter/right tab |
| Foreground | ផ្ទៃខាងមុខ | presenter tab |
| Playlists | តារាងកម្មវិធី | left list (dev) |
| Bible Notes | កំណត់ត្រាព្រះគម្ពីរ | right tab |
| Colors / Images / Videos / Cameras / Web(s) / Audios | ពណ៌ / រូបភាព / វីដេអូ / កាមេរ៉ា / វេបសាយ / សំលេង | background tabs |
| Clear all/bg/slide/bible/fg (F6–F10) | លុបទាំងអស់ / លុបផ្ទៃខាងក្រោយ / លុបស្លាយ / លុបព្រះគម្ពីរ / លុបផ្ទៃខាងមុខ | mini-screen footer |
| Close (Ctrl+Q) | បិទ | modal close |
| Save (Ctrl+S) | រក្សាទុក | editors |

---

## 2. Window model — main-window routes vs. popup windows ⚠️ (biggest trap)

**Main-window pages** (switched in-place via `goToPath()` → `location.href`, per
`src/router/routeHelpers.tsx`):
- `presenter.html` (default) · `reader.html` · `appDocumentEditor.html`
- Verified: clicking the `Bible Reader` header tab navigates the **same** window to
  `reader.html`. `navigate_page` between these is fine.

**Popup windows** (opened via `openSettingPage()`→`openPopupWindow()`→
`window.open(url?uuid=…)`, per `src/setting/settingHelpers.ts` + `src/helper/domHelpers.ts`):
- `setting.html` · `about.html` · `finder.html` · `lyricEditor.html` · `bibleNote.html` ·
  `webEditor.html`
- These are **separate windows**. The main window is **never** meant to host them.

### ❌ Do NOT navigate the main window to a popup-only page
Forcing the main window to `setting.html` (e.g. `navigate_page → setting.html`):
- It **loads**, but then you **cannot navigate away** — every destination
  (`presenter.html`, `reader.html`, even `about:blank`, via `navigate_page` /
  `location.href` / `location.replace` / `window.open(_self)`) returns
  **`net::ERR_ABORTED`**. (Server + Vite are healthy; `fetch('/presenter.html')` → 200. It is
  not a `beforeunload` and not a `will-navigate` block — `guardBrowsing` only sets a
  window-open handler.)
- It **persists** `mainHtmlPath:"setting.html"` into
  `%APPDATA%/open-worship-app/setting.json` (see §3), so the main window **reopens Settings on
  every restart** until you fix the file.

### ✅ Correct way to test Settings/About/etc.
1. Click the gear (Settings) / relevant button in the app — it opens a **new popup target**.
2. `mcp_chrome_devtoo_list_pages` → find the `setting.html` target → `select_page` it.
3. Test it, then `close_page` the popup (or leave it; it's a separate window).
Keep the main window on `presenter.html`.

---

## 3. Persisted window state & recovery

`electron/ElectronSettingManager.ts` saves the main window's page to **`mainHtmlPath`** in
`%APPDATA%/open-worship-app/setting.json` on every navigation. File shape:
```json
{"mainWinBounds":{...},"appScreenDisplayId":null,"mainHtmlPath":"presenter.html","themeSource":"system"}
```
- Default is `presenter.html`; the value survives full restarts.
- **Recovery if the main window is stuck on a popup page:** (1) stop the app, (2) set
  `mainHtmlPath` back to `"presenter.html"` in `setting.json` (keep the other keys), (3)
  relaunch. The window will open on the Presenter. Locale (`localStorage['language-locale']`)
  is stored separately and is preserved.
- **Optional app hardening to suggest:** validate `mainHtmlPath` on load — only accept
  main-window pages, else fall back to `htmlFiles.presenter`.

---

## 4. Readiness signals (per page)
- **Page-agnostic:** `#root` exists, has children, and no `img.loading` inside.
  A persistent `.loading` image = bug.
- `presenter.html` / `appDocumentEditor.html`: also have `#app-header` + `#app-body`.
- `reader.html`: **no `#app-header`** — wait for bible content instead.
- `setting.html`: `document.title` matches `/Settings/`; `General` + `Apply Settings` buttons.

---

## 5. Interaction gotchas (verified)

- **Click the button, not the wrapper.** Nav tabs / list rows expose the label as
  `StaticText`/`<li>`; a synthetic `.click()` on the `<li>` does **not** fire React's handler.
  Click the actual `button.nav-link` (or the item's `<button>`), or MCP-click the button's
  `uid`.
- **Background panel starts collapsed.** It's an `app-hidden-widget` (~6px, shows only a
  `Background` / `Note` label). Its tabs **do not exist in the DOM until expanded** — an early
  `.nav-tabs` scan finds only the header + presenter tab groups. **Click the `Background`
  label to expand**, then the tabs (`Colors…Audios`) render as real `button.nav-link`s.
- **Color swatches are `role=group`** elements with accessible color names
  (`fuchsia`,`blue`,`red`,…), **not `<button>`s** — target them via a `take_snapshot` `uid`.
- **Contrast-aware dialog.** Choosing a background color that may clash with text pops a
  confirm: *"…text color may not be visible… change text color as well?"* (`Cancel`/`Ok`).
  Handle it. (This is **good UX**, not a bug.)
- **Sliders.** Presenter has two `input[type=range]`: thumbnail-size (`max="200"`) and
  mini-screen zoom (`max="30"`). To drive one programmatically: native value setter +
  `dispatchEvent(new Event('input',{bubbles:true}))` (React listens on `input`).
- **Bible Lookup input is an incremental picker** (book → chapter → verse). Typing a full
  `John 3:16` only **book-filters** by the alpha prefix (`Joh`) and will **not** jump to the
  verse (it *does* add a `John 3:16` history entry — inconsistent, logged as a Low finding).
  Pick step-by-step, or use the **Bible Reader** page which resolves full refs correctly.
  Also: a single `fill()` = one change event (test artifact); use char-by-char `type_text` to
  mimic a real user.
- **Presenting is a SINGLE-CLICK TOGGLE, not double-click** (verified 2026-07-08 against
  `ScreenVaryAppDocumentManager.handleSlideSelecting`): one click on a slide thumbnail (or a
  background media item) presents it; clicking the **same** item again clears it. A
  **double-click therefore nets to nothing** — present + immediately un-present — and if
  another slide was live, the first click replaces it and the second click clears the layer
  (this exact accident cleared the live slide during a run). Use `click` (no `dblClick`),
  then verify via `.app-on-screen` before proceeding.
- **Slide/lyric previews live in `<iframe srcdoc>`** (lyric ones inside a
  `shadowing-parent-width-tag` shadow root, `sandbox="allow-scripts"` so their DOM is
  unreadable from the parent — inspect the `srcdoc` attribute string instead). A lyric's
  slide 1 is often just the `<h1>` title, which at ~0.2 preview scale looks like a blank
  dark card — not a rendering bug.

---

## 6. `.app-on-screen` / live-output semantics
- Any element currently shown on the presentation output carries **`.app-on-screen`**.
- The active background tab gets a **`*` prefix** (e.g. `*Videos`, `*Colors`).
- Use both to verify "send to screen" toggles:
  `[...document.querySelectorAll('.app-on-screen')].map(e=>e.textContent.trim())`.
- A separate `screen.html` **page target** appears only while presenting to a display.

---

## 7. Known-benign console — DO NOT report these
| Message | Why it's fine |
|---|---|
| `[warn] Electron Security Warning (Disabled webSecurity)` | **dev only** — "will not show up once packaged" |
| `[warn] Electron Security Warning (allowRunningInsecureContent)` | **dev only** |
| `[info] Download the React DevTools…` | dev only |
| `[debug] [vite] connecting… / connected` | dev HMR |
| `[log] printHtmlText` and an empty `[log]` | benign; the empty log repeats on interaction (cleanup candidate, not a bug) |

Real console issues to flag: uncaught errors, unhandled promise rejections, React
key/warning spam, failed dynamic imports.

## 8. Known-benign network — DO NOT report
- On presenter load the **same live background video is fetched repeatedly** (3× observed
  2026-07-06 with `award background(1).mp4`; **11×** observed 2026-07-08 with `6_cv.mp4`, all
  `200`) — redundant I/O, not an error, but worth tracking as it may be growing.
- `file://` media loads are normal.
Real network issues to flag: `4xx`/`5xx` on app assets, blocked/CORS, broken images/media.

---

## 9. Signal vs. noise — what actually counts as a bug
**Not bugs (expected):**
- Dev-only Electron/React warnings (§7); redundant media fetch (§8).
- A configured-but-missing font shown as **"Hanuman (Missing)"** — the label is *informative*;
  it's an environment note, not a code defect.
- Locale/content changes the **user** made (confirm first).
- Popup-page navigation trap **you** caused by forcing the main window there (§2).

**Real bugs to hunt:**
- Uncaught errors / failed requests to app assets; blank or never-clearing `.loading`.
- A tab/button that doesn't respond or doesn't toggle its state; a modal that won't open/close
  (`Ctrl+B` open, `Ctrl+Q` / red `btn-danger` close).
- Clipped/overflowing/overlapping/low-contrast text; broken/blank images; layout shift.
- **Accessibility:** icon-only buttons with no accessible name (observed: the **Help** button's
  name is a raw URL `https://…/help#presenter`; the **fullscreen** toggle has *no* name).
  Scan `take_snapshot` for unnamed interactive nodes.

---

## 10. Don't disrupt the live window (courtesy)
- If you change the live **background** (color/image/video) or the selected document, **restore
  it** afterward (double-click the original item; verified working).
- **Avoid** triggering presenter **fullscreen** or **present-to-display** on a window the user
  is actively using.
- **Never leave the main window on a popup-only page** (§2–§3).

---

## 11. Verified-good baseline (what "healthy" looked like on 2026-07-06, v2026.06.21)
Use as a diff target for regressions:
- All four pages (`presenter`/`reader`/`appDocumentEditor`/`setting`) mount ready with **no
  uncaught app errors** (only §7 dev noise).
- Bible Lookup: opens via `Ctrl+B` **and** the button; renders a chapter via the picker; closes
  via the red `btn-danger` **and** `Ctrl+Q`.
- Documents: selecting a doc loads slides + updates the footer path; thumbnail slider rescales.
- Lyrics: selected lyric renders (with chords) in `<iframe>` previews.
- Background: panel expands; all six tabs switch; a color selection updates the mini-screen.
- Mini-screen: reflects active content; zoom slider rescales the preview.
- Bible Reader: resolves a full reference (`John 3:16`) to the exact verse.
- Settings: title `Settings`; `General`/`Bible` tabs; `Apply Settings`; Path/Language/Theme/Font
  sections. (Note: the old `Set Default Data` button is gone — has
  `Reset All Child Directories` / `Reset Widgets Size` / `Clear All Settings` instead.)
