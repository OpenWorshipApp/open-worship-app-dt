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
5. **Restore what you change** (live background, selected doc, shown screens). Screen
   controlling & presenting is **mandatory in every run** (SKILL §6a): show the screen
   briefly, drive its `screen.html` CDP target, then **hide it again** — only leaving it
   taken over (or touching a display the user says is in live use) is off-limits (§10).

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
- **In-app modal popups (Alert / Confirm / Input) are single-slot and chained.**
  `HandleAlertComp` holds one `popupWidgetManager` slot per type and shows them
  one-at-a-time; a popup's close runs `openX(null)` **asynchronously**. If a popup's
  close is ordered *after* the callback that opens the **next** popup, the async close
  lands last and silently tears the next popup down — worst with two of the **same type**
  back-to-back (`Alert`→`Alert`). The components deliberately close-**then**-run-callback
  to make the new popup win the slot ([src/popup-widget/AlertPopupComp.tsx](../../../../src/popup-widget/AlertPopupComp.tsx)
  and its Confirm/Input siblings). **Regression check** (run whenever the focus touches
  popups/dialogs/settings): the dev build exposes `window.tryPopup()` (guarded by
  `appProvider.systemUtils.isDev`) which opens a fixed 1→2→3→4→5 chain
  (Confirm/Alert/Alert/Confirm/Alert). In the running app, `evaluate_script`
  `() => typeof window.tryPopup` → `"function"`, then call `window.tryPopup()` and step
  each popup by clicking its **Yes/Ok** primary button (`.app-popup-widget button.btn-info`),
  reading the header (`.app-popup-widget .app-popup-header-title`) between clicks. All five
  titles must appear **in order** and the stack must be empty after the 5th — a popup that
  never appears (torn down by the previous popup's async close, especially `Alert`→`Alert`)
  is a **High** finding. Jsdom coverage of the same invariant:
  [src/popup-widget/HandleAlertComp.test.tsx](../../../../src/popup-widget/HandleAlertComp.test.tsx).

---

## 6. `.app-on-screen` / live-output semantics — and driving the screen window
- Any element currently shown on the presentation output carries **`.app-on-screen`**.
- The active background tab gets a **`*` prefix** (e.g. `*Videos`, `*Colors`).
- Use both to verify "send to screen" toggles:
  `[...document.querySelectorAll('.app-on-screen')].map(e=>e.textContent.trim())`.

### Screen window CDP visibility (verified, corrected 2026-07-08)
- While a screen is **SHOWING** (toggle `ShowHideScreen` / `F5`), it **is** a normal CDP
  target: `https://localhost:3000/screen.html?screenId=N` in `list_pages` — fully
  drivable (`take_snapshot` / `click` / `take_screenshot`; the ❌ `#close` button has
  been clicked via MCP and it hid the screen).
- The target **vanishes the moment the screen hides** — an earlier session concluded it
  was "never on CDP"; that was wrong, it's just absent while hidden.
- A **hidden** screen's console forwards via `all:app:log` → electron main stdout (the
  `npm run dev` terminal). Read that channel for screen-only bugs while hidden.
- The mini preview reuses the same screen React components but **without
  `isPageScreen`/StrictMode** — screen-window-only bugs (e.g. full-width PDF, mount
  loops) do NOT reproduce there. **That is why driving the real target once per run is
  mandatory** (SKILL §6a): screenshot the screen target itself and compare with the
  mini preview.
- Presenting is a **single-click toggle** (§5) — present, verify, then clear with
  `F6`–`F10`; end with the screen hidden unless it started showing.

---

## 7. Known-benign console — DO NOT report these
| Message | Why it's fine |
|---|---|
| `[warn] Electron Security Warning (Disabled webSecurity)` | **dev only** — "will not show up once packaged" |
| `[warn] Electron Security Warning (allowRunningInsecureContent)` | **dev only** |
| `[info] Download the React DevTools…` | dev only |
| `[debug] [vite] connecting… / connected` | dev HMR |
| `[log] printHtmlText` and an empty `[log]` | benign; the empty log repeats on interaction (cleanup candidate, not a bug) |
| `TypeError: Cannot get bible list` at `getOnlineBibleInfoList` (Settings → Bible tab) | **intended** — the online bible `info.json` fetch failed or is unavailable (e.g. offline/dev); the error is caught and logged by `handleError`, the function returns `null`, and the UI simply shows no online bible list |

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
- **Showing the physical screen is part of the mandatory screen block** (SKILL §6a):
  toggle it ON briefly, drive the `screen.html` target, then **hide it and restore
  every control you touched** (lock, transitions, stage number, display, color note).
  What stays forbidden: **leaving** a display taken over, OS-fullscreen games on a
  window in use, or showing any screen at all when the user says a **live service** is
  running — in that case assert via mini-screen and mark the SC rows BLOCKED→EX-02.
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

---

## 12. Cross-window (multi-renderer) propagation — the regression class a CDP-only run misses ⚠️

**The trap that let an edit→present regression ship:** OWA is **multi-window**, and each
window is a **separate Electron renderer** — its own JS heap, its own in-renderer event
bus, and its own **per-renderer data cache**. Windows do **not** share memory; they sync
only through **files on disk + a file watcher**. So "edit in one window shows up in
another" is an *emergent, cross-process* behavior — exactly the kind a run that drives one
window at a time never checks. (This is how the case where **resizing a box in the
`Document Editor` window did not update the `Presenter`'s slide preview** went unspotted.)

### 12.1 The window/renderer model
- **Presenter** (`presenter.html`), **Reader** (`reader.html`), **Doc Editor**
  (`appDocumentEditor.html`), **Screen** (`screen.html?screenId=N`), and the popup
  **Lyric / Bible-note / Web** editors are each a distinct renderer.
- The Doc Editor can be open **two different ways**, and only one creates the two-window
  config where this bug lives:
  - **Header `Slide Editor` tab** → `goToPath()` → navigates the *same* (main) window
    in-place (NAV-01-style). No second window → **this bug can't appear** (there's one
    renderer). *This is the trap: earlier runs opened the editor this way and saw nothing.*
  - **`Slide Editor` tab's `bi-box-arrow-up-right` external icon (NAV-21)** — or a doc's
    row/quick-edit **Edit ↗** — → `openAppDocumentEditorExternal` → `openPopupWindow`
    (uuid `app_document_editor`) → a **separate** `Document Editor - <name>` window
    (`src/app-document-list/AppDocument.ts:529`). **This** is the config to test.

### 12.2 The propagation chain (know each hop so you know where it can break)
Editor saves a doc → the change must cross to the Presenter/Screen:
1. Editor renderer `FileSource.writeFileData()` — deletes **only the editor's** cache and
   fires `fireUpdateEvent()` in **only the editor's** renderer; writes the file
   (`src/helper/FileSource.ts:171`). *(This is why the editor itself updates but nothing
   else automatically does.)*
2. The file on disk changes → **each other renderer's** per-directory `fs.watch`
   (`watchDir`→`handleFileEvent`, `src/helper/dirSourceHelpers.ts:184,209`) fires.
3. `handleFileEvent` → `alertFileChanging()` → DirSource **`file-update`** event
   (`src/helper/DirSource.ts:225`). ⚠️ note it also only fires a `refresh` when the file
   **list** changes (add/remove) — a pure **content** edit rides `file-update` alone.
4. A file-list hook **bridges** DirSource `file-update` → `FileSource.fireUpdateEvent()`
   in *that* renderer (`src/helper/dirSourceHelpers.ts:79-97`).
5. `useFileSourceEvents(['update'], …)` consumers reload: Presenter **center preview**
   `VarySlidesComp` (`src/app-document-presenter/items/VarySlidesComp.tsx:84`) and the
   **list-row** thumbnails (`VaryAppDocumentFileComp`) — each re-reads `getSlides()`
   (debounced **500 ms**) **through a 2-second `fileDataCacheManager` cache**
   (`src/helper/FileSource.ts:42,137`).
   - ⚠️ **The live screen / presented slide does NOT auto-reload — this is intentional
     (verified 2026-07-19).** Presenting takes a `cloneJson` **snapshot** into
     `ScreenVaryAppDocumentManager._varySlideData`
     (`src/_screen/managers/ScreenVaryAppDocumentManager.ts`, captured at present-time), and
     **nothing in `src/_screen/` subscribes to `useFileSourceEvents`** (`ScreenVaryAppDocumentComp`
     listens only to screen `['refresh']`). So a **saved** edit to a currently-presented
     slide updates the Presenter's center preview, but the **live projector output stays
     frozen on purpose** — the operator decides when to push the change by **re-presenting**
     the slide (clear + present again, or click it). This keeps the congregation's screen
     stable during mid-service edits. A stale live screen after a saved edit is therefore
     **expected, not a bug** (see §12.4 / XW-03).

**Failure modes this hides (what a good XW test catches):** `fs.watch` not firing for
content-only edits / on some OSes (e.g. macOS needs a **recursive** watch to see
`<name>.histories/` sub-writes — `watchDir` sets `recursive: isMac`); the list-hook bridge
unmounted or a filePath mismatch; the **2 s per-renderer cache** serving stale bytes to the
reload; an **auto-reloading** consumer (center preview / list rows) that stopped subscribing;
a regression in the reload wiring (e.g. the `VaryAppDocumentFileComp` / `LyricFileComp` /
`PlaylistFileComp` `useFileSourceEvents` refactor). **Expected, NOT bugs:** (a) an **unsaved**
editor edit not showing in the Presenter — separate renderers sync via saved-on-disk state,
so the Presenter shows the last **saved** version (confirm the change was actually **saved**
before filing a FAIL); (b) a **saved** edit not auto-updating the **live screen** of a
**presented** slide — the presented copy is an intentional snapshot; the operator applies it
by **re-presenting** (§12.2 step 5). Only the center preview / list rows must auto-reload.

### 12.3 Why a CDP-only run can't see it — and how to test it anyway
Three reasons earlier runs missed it, each with the fix:
1. **CDP can't do the edit.** Canvas drag-resize and Monaco typing need genuine OS
   **foreground** focus (CLAUDE.md); synthetic events don't mutate the model. → Use a
   **CDP-drivable** content edit instead (12.4).
2. **The two-window config is never set up.** → Open the editor as a **separate window**
   (12.1) so both `appDocumentEditor.html` and `presenter.html`/`screen.html` targets exist.
3. **No scenario pairs "edit here" with "assert there."** → Run the XW rows / test-plan S18.

### 12.4 The recipe (self-restoring)
1. **Prefer a scratch doc.** Create a throwaway document (or use one you'll fully restore),
   select it in the Presenter so `VarySlidesComp` shows it; optionally **present** slide 1
   (this also covers the mandatory screen block — but note the live screen is a snapshot and
   is **not** expected to auto-update on save; see step 4 / XW-03).
2. Open that doc's **Doc Editor as a separate window** (NAV-21 external icon). `list_pages`
   → you now have both targets. *(Opening/closing a popup can trigger chrome-devtools-mcp
   "browser reconnected" — re-`list_pages` and re-`select_page` after each window
   open/close; read screen visibility from `.show-hide.showing`, not target enumeration.)*
3. **Make a CDP-drivable edit in the editor target** (no OS focus needed), pick one:
   - **Properties-panel numeric inputs** — select a canvas item, then `fill` the Box
     **Position/Size/Rotate** inputs (ED-19) or slide **Width/Height** (ED-17). These are
     real `<input>`s and are the closest analog to the user's drag-resize.
   - **Programmatic controller mutation** — walk React fibers to the live `CanvasController`
     (CLAUDE.md file-drop note) and call a mutate method.
   - **Direct `fileSource.writeFileData(json)`** — writes the doc to disk, exercising the
     whole watcher→bridge→cache chain end-to-end with no UI at all.
   Then **Save** (green save button / `Ctrl+S` — a button click works over CDP).
4. **Assert propagation in the OTHER target(s)** within ~3 s (500 ms debounce + 2 s cache +
   watch latency): Presenter `VarySlidesComp` box geometry/text changed (XW-01); list-row
   thumbnail changed (XW-02). If **either** stays stale after a **saved** edit →
   **regression → XW FAIL + Finding** (name the broken hop from 12.2).
   - **XW-03 (live `screen.html` output of a *presented* slide):** it is **expected to stay
     stale** after a saved edit — the presented slide is an intentional snapshot (§12.2
     step 5). Do **not** file that as a bug. Instead verify the **apply** path: **re-present**
     the slide (clear + present again, or click it) and confirm the `screen.html` output
     *then* reflects the edit. Only a broken apply — screen still stale **after re-present**,
     or the saved bytes wrong on disk — is a FAIL.
5. **Restore:** in the editor, **Undo** (`Ctrl+Z`, never *Discard*) + re-save, or write back
   the original bytes; delete the scratch doc. Restore any presented/shown state (KB §10).
