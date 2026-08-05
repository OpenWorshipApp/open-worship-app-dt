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
  separate store.
- ⚠️ **Nor `document.documentElement.lang`** — verified 2026-07-26: it read `"en"` while the
  entire presenter rendered Khmer (the attribute is never updated on locale change; filed as
  a Low a11y finding). **The only reliable read is Settings → Language: whichever of
  `Khmer`/`English` is the solid (non-`outline`) button is active.**
- **Consequence:** the same button reads `ស្វែងរកព្រះគម្ពីរ` or `Bible Lookup` depending on
  locale. Snapshot `uid`s and text both shift.
- **Do:** click by `button.nav-link` + CSS state (`.active`, `.app-on-screen`), by icon class
  (`bi-*`), by `role`/accessible name, or by position. Read state with `evaluate_script` on
  classes. **Don't:** match literal Khmer/English strings unless you first read the current
  locale.
- If the locale changes during your run and you didn't change it, **assume the user did** and
  confirm before reporting.

### 1.1 A missing Khmer key THROWS in dev — so every run must switch locale

`tran()` (`src/lang/langHelpers.ts`) returns the input string immediately when the locale
is `en-US` (`DEFAULT_LOCALE`) — **it never looks anything up**. In `km-KH` the same call
`throw`s `Translation for text "…" not found in locale km-KH` when the key is missing,
and because nothing wraps these components in an error boundary, **the whole subtree
renders blank**.

Consequences for a run:

- An **English-only pass cannot detect a missing translation at all** — this is why the
  locale switch (`LT-01..02`, SKILL.md §6d / test-plan §S15) is part of the mandatory
  core, not an optional spot-check.
- `npm run lint` (tests + typecheck + prettier + eslint + build) stays **fully green**
  while a screen is broken in Khmer. Only running the app in Khmer finds it.
- **Verified 2026-07-26:** `PositionSizeFieldComp` (`BoxPositionSizeComp.tsx`) called
  `tran(name)` with `name="X:"`; selecting a canvas item blanked the entire slide-editor
  tools panel. Fixed by not translating axis abbreviations.
- Symptom to recognize: a panel that is **blank** in one locale and populated in the
  other → open the console, find the `Translation for text` error, and read the component
  name from the React warning logged right after it. File as **Critical**.
- **Verified 2026-08-03:** `LyricHandlerComp` called `tran('Loading...')` — the **ellipsis
  inside the key**. Every other site in the repo writes `{tran('Loading')}...`, and the km
  dictionary defines `Loading` only. Because that branch renders on every cold load of the
  Lyrics tab, the **entire Presenter came up blank** (`#root` 0 children, body 80 chars).
  Fixed by moving the ellipsis outside `tran()`.
- Distinguish from **hardcoded** English (a string that never calls `tran()` at all — e.g.
  `title="Drag to resize"`, `SlideEditorToolTitleComp title="…"`). Those merely stay
  English in Khmer mode: **Low/Info**, not Critical, and not a throw.

In production the same missing key silently falls back to English, so this is a
dev-visible-only failure — which is exactly why the robot run has to catch it.

#### Keys are sanitized — `trim().toLowerCase()` — before lookup ⚠️

`sanitizeTranKey` (`src/lang/data/km/index.ts`) is `key.trim().toLowerCase()`, and the
dictionary is re-keyed through it at module load (which also **throws on duplicates after
sanitization** — that guard is how a bad "fix" gets caught).

So `tran('Remove from screen ')`, `tran('Add items')` and `tran('auto')` all resolve fine
against `'Remove from screen'`, `'Add Items'` and `'Auto'`. **Do not report padded or
differently-cased keys as missing** — a naive grep of `tran('…')` against the dictionary
produces a pile of false positives (11 of them on 2026-08-03, all bogus). Only a
difference that survives trim+lowercase is real, e.g. `'loading...'` vs `'loading'`.

To audit properly, sanitize both sides:

```js
const sanitize = (k) => k.trim().toLowerCase();
// collect every literal tran('…') key, sanitize, compare against the
// sanitized dictionary keys taken from BEFORE `function sanitizeTranKey`
```

This only covers **literal** keys; dynamic `tran(someVariable)` sites (e.g.
`SettingCardHeaderComp` doing `tran(title)`) stay invisible to any static sweep and remain
the residual risk.

Also beware: clicking the `Khmer`/`English` button re-renders **some** components
immediately, before `Apply Settings` reloads the windows. A screenshot taken in that gap
shows a believable mix of both languages — that is a **partial re-render, not an
untranslated-string bug**. Always judge translation coverage *after* `Apply Settings`.

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
- **Toasts: fire them yourself, and don't measure too early.** `window.testSimpleToasts()`
  (dev-only, `src/toast/toastHelpers.ts`) is the cheapest way to cover `[GL-10, GL-15,
  GL-23]` — no organic trigger needed. It deliberately spaces its 3 toasts **~500 ms
  apart**, so a probe run 200 ms after the call sees only toast `1` and looks exactly like
  "toasts replace each other". Wait ≥1.2 s before asserting the stack. Toasts live in
  `.app-toast-stack` (max 5, newest at the bottom, each with its own 4 s timer); hover via
  synthetic `mouseover`/`mouseout` (bubbling handlers, so this works) to pause/restart a
  single toast's timer.
- ⚠️ **Closing a context menu with a synthetic `document.body` click KILLS every keyboard
  shortcut** (verified 2026-07-26 — cost most of a run and looked exactly like an `F7`
  regression). The menu renders a **full-viewport overlay** that owns
  `onClick={handleClose}` (`AppContextMenuComp.tsx`); a click dispatched on `document.body`
  is *outside* that overlay (body is the root container's parent), so `onClose` never runs
  and the menu's keyboard **layer** is never popped. `KeyboardEventListener` then routes all
  keys to the dead menu layer and **every base-layer shortcut silently stops working**
  (`F5`–`F10`, `Ctrl+B`, …) while `document.onkeydown` still looks correctly installed and
  the keydown still reaches `document`. **Always dismiss via the overlay itself**
  (`document.querySelector('.app-context-menu').parentElement` → dispatch the click there)
  or `Escape`. Verified good: after a proper open/close cycle `Ctrl+B` and `F7` both work.
  If shortcuts have already gone dead, **reload the page** to reset the layer stack.
- **Presenting a background/slide with multiple screens and none `Select`ed does NOT apply
  immediately** — `ScreenEventHandler.chooseScreenIds` opens a **screen-chooser context
  menu** (`Screen id: 0/1/2`). A click that "does nothing" is usually this menu waiting.
  With one screen, or with screens explicitly selected, it applies directly.
- **Screens sharing a colour-note are a sync group.** Applying a background to one screen
  propagates to every screen with the same colour-note dot and leaves `No Color` screens
  alone (verified 2026-07-26: `lime` screens 0+1 moved together, screen 2 did not). Don't
  file that as "applied to the wrong screen".
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

---

## 13. Lyric slides — measure the SCREEN, not the previewer ⚠️

Lyric documents (`src/lyric-list/`) are not ordinary slides: each slide's body is one
`type: 'html'` canvas item whose markup is generated by the **`open-lyric`** dependency.
That makes them the easiest place in the app for the operator's preview and the projector
to disagree — which is precisely what the mandatory screen block (SKILL §6a) exists for.

**Verified 2026-08-03:** with a lyric presented, the Presenter's own previewer rendered the
chorus at `font-size: 61px` while **both** `screen.html` outputs rendered the identical
slide at `16px` in near-black — about 6% of a 1494×934 output. Root cause:
`LyricAppDocument.openLyric` is a public field assigned by exactly one React component
(`LyricSlidesPreviewerComp`), and `basicOpenLyricOptions` silently omitted `fontSize`
whenever it was null — which is always true in the screen renderer. Fixed by reading the
persisted setting instead.

How to check it in a run (cheap, one `evaluate_script` per side):

```js
// on the screen.html target
const s = document.getElementById('slide')
    .querySelector('.ol-preview-line, .ol-preview-lyric-segment__text');
({ fontSize: getComputedStyle(s).fontSize, color: getComputedStyle(s).color })
// on the presenter: same probe inside each ShadowingFillParentWidthComp shadowRoot
```

The two must agree. A previewer/screen mismatch is a **High** finding, and the
mini-screen preview does **not** reliably expose it.

Notes that save time on this subsystem:

- **A cold start is the interesting case.** The presented slide is restored from settings
  before the previewer component mounts, so init-order bugs show up on the first present
  after launch and then "heal" once you re-present. Do the screen measurement **before**
  reloading or re-presenting anything, or you will measure the healed state and miss it.
- **Stages are separate document instances** (`getLyricAppDocumentStageByStage`), each with
  its own cache. Screens on different stages (`St: 0` / `St: 1`) can legitimately render
  different layouts — stage 1 shows chord/section labels. That is not a bug.
- **Khmer glyph overhang at segment boundaries** (the tail of one segment drawing into the
  next) is font shaping in the open-lyric output, not a layout bug — check
  `getBoundingClientRect()` on adjacent `.ol-preview-lyric-segment__text` nodes; they are
  strictly adjacent, never overlapping.
- **Slide 1 of a lyric is the whole-song info card** and slide 3 is deliberately blank
  (`OPEN_LYRIC_NONE_KEY`). An empty-looking card there is intentional.
- Lyric slide markup carries a **full computed-style dump per node** (~464 KB for one
  chorus). It comes from `open-lyric`, not this repo — worth flagging as a performance
  Info finding, not fixable in `src/`.

---

## 14. Playlists — the model behind every PL row ⚠️

The Playlists panel (`src/playlist/`) is the app's **run sheet**: one file per service,
holding everything that service will present, in order. It is small in code and dense in
rules, and almost every one of those rules is a testable claim. Read this before driving
PL-10 / PL-29 / PL-32..PL-70 — it explains *why* each row's pass condition is what it is,
and which "odd" behaviours are deliberate.

### 14.1 It is NOT dev-only any more (corrected 2026-08-04)

Commit `203d35cc` removed the `isDev` gate in `AppPresenterLeftComp` and handed the panel
the slot the **Lyric List** used to occupy (lyrics moved into the Documents list). Older
notes — including earlier revisions of this file, `ui-map.md`, `components-path.md` and
the matrix itself — say "dev builds only". They are stale. **No PL row may be marked
BLOCKED with the reason "dev-only".** (PL-49.)

### 14.2 Two kinds of entry, and why they differ

| stored as | kinds | why |
| --- | --- | --- |
| **reference** (`filePath` + `id`, `stage` for lyrics) | slide, lyric slide, PDF/PPTX/DOCX slide, app document | a playlist is built days before the service; a song edited in between must project its NEW words. A snapshot would silently project stale text. |
| **preset** (drag payload stored verbatim in `data`) | background colour/image/video/camera/web, bible verse, foreground widget, audio | small, self-describing, and for a foreground the preset (the marquee text, the countdown duration, the styling) *is* the point. |

Consequences to test against, not to "fix":

- Editing a referenced document changes what the playlist projects. Editing the source of
  a preset does **not**.
- A countdown entry stores `durationSecond`, never a resolved date; quick text stores
  markdown, never rendered html. A stored preset replayed a week later must not show an
  expired countdown.
- `title` on an entry is a **label captured when it was added** — purely cosmetic.
  Renaming the underlying file does not change the row's text. That is deliberate:
  resolving real names would mean reading every referenced file just to draw the list.
- Audio is accepted but is deliberately **not** in `backgroundDragTypeList`: it plays
  locally and must never reach the screen pipeline.

### 14.3 Performance is the whole design — the things that must not regress

This panel is where a careless change becomes a visible stall on the target hardware:

- **Rows are text-only.** No thumbnail per row — that would decode every referenced
  image/video just to draw a list. Rich previews live in the floating widget, on demand.
- **Document slides load on expand and are released on collapse** (the component
  unmounts). A long playlist must never hold every document's slides at once.
- **On-screen marking uses ONE shared subscription** for the whole tree
  (`useIsOnScreenChecking` + `onScreenSubscribers`), not `useScreenUpdateEvents` per row —
  that hook fans out into seven subscriptions each with its own `useState`, so a document
  expanded to ~90 rows produced ~650 state updates per screen event and React answered
  with `Maximum update depth exceeded`. A single **shared** 500 ms debounce is correct
  here (contrast CLAUDE.md's per-instance rule) because one pass refreshes every
  subscriber. PL-70.
- **The row you just clicked bypasses the debounce** (`refreshOnScreenAfterPresenting` →
  `isImmediate`, yielded one macrotask so it lands after the present, and cancelling the
  pass the same event already scheduled). Half a second of "did that work?" reads as a
  slow app.
- **Idle costs four setting reads.** `checkIsAnythingOnScreen` short-circuits everything;
  with nothing presenting, listing playlists opens no playlist files at all. If you ever
  see the idle list reading `.owp` files, that gate is broken.
- **Icons come from the file extension**, never from instantiating the document
  (`toDocumentIcon`), and the on-screen check for a document matches on `filePath` only —
  never `getSlides()`.
- **Clicks stop propagating** so they never reach the enclosing `FileItemHandlerComp`
  `<li>`, whose click fires the one UNSCOPED FileSource `select` in the app and re-renders
  every file row in the window. PL-63.

### 14.4 Drag rules (the source of most "it did nothing" reports)

- A drag out of a playlist row sets `playlistDraggingStore`. While it is set, the playlist
  CARD's add handler bails — that is what makes a drop back into the same list a
  **reorder** rather than a duplicate add. The side effect: **dragging a row from playlist
  A onto playlist B adds nothing at all** (PL-55). Known limitation; do not re-file.
- Rows go to a screen through `dragStore.onDropped`, NOT the synchronous `dataTransfer`
  payload: a stored slide must be re-read from its document first and `dragstart` cannot
  await. A slide CHILD row (under an expanded document) is already resolved, so it rides
  the ordinary synchronous path.
- The accepted-type gate is `acceptedDragTypeList`; anything else toasts
  *"This item type cannot be added to a playlist"*.

### 14.5 Settings hygiene

Settings are files named after their key, so a raw file path in a setting name would
create directory separators and log an `ENOENT` on every read. Everything the playlist
persists goes through `toPlaylistSettingName` (`/ \ : * ? " < > |` and dots → `_`):
`playlist-opened-…`, `playlist-item-expanded-…`, `playlist-preview-collapsed-…`. The
preview's collapse setting stores **only the collapsed keys** and is **deleted** when
everything is expanded — one file per playlist, and the common case writes nothing.
PL-54 / PL-58.

### 14.6 The floating preview is a run-sheet player

- Exactly ONE widget at a time (a shared store, not per-row state); opening another
  playlist's preview replaces it and clears the remembered position.
- **Space / ↓ / → / PageDown** step the run FORWARD only — no wrap, because wrapping
  round to element 1 mid-service would put the wrong thing on a live screen. Audio and
  damaged entries are stepped OVER. The keys are gated on focus being inside the widget,
  since the presenter's slide list answers the very same keys.
- A **document** element is walked slide by slide (disabled slides skipped) and the run
  only leaves it once the slide on screen is its last. Crossing INTO one always starts at
  its FIRST slide. Where the walk is from is read off the SCREENS (one setting read per
  press), so clicking a slide directly re-points it. A folded-away document registers no
  stepping and is passed over. PL-46 / PL-48.
- Selection is remembered as **key + position**: the key survives a reorder, the position
  tells two identical entries apart.
- Slide cards inside the widget get a **restricted** right-click menu (Show on Screens
  only, caught on the way down) — the previewer's colour-note/background/edit family acts
  on the document, not the run sheet. PL-59.
- Bible entries render read-only: a verse in a run sheet is a stored preset, not a row of
  a bible file, so no retarget, no copy family, no colour note. PL-60.

### 14.7 Export / import (`.owapl.tar.gz`)

A tar.gz (`tarCreate`/`tarExtract`) — **not** a zip; the app has no zip dependency. Layout:
`manifest.json` + `playlist.json` + `files/`. The bundle carries the **whole document**
behind every slide reference (so the reference resolves after import), the media behind
every background, and each document's `.bg.json` attached-background sidecar with its
paths absolutised.

Import contract worth testing explicitly:

1. **Every destination folder is resolved up front** — a list whose folder has not been
   chosen yet fails the import BEFORE a single file is written (PL-66). Discovering it
   halfway would leave media imported and no playlist to show for it.
2. Archive paths are validated (`..` / backslash refused) — a traversal entry landing
   outside the extract dir is a security-relevant FAIL.
3. Same-named files in the destination folder are **reused, not duplicated**; an existing
   `.bg.json` is never clobbered; the playlist file itself is de-duplicated as
   `<name> (1).owp` (PL-67).
4. Bible entries are re-created in the **Default** bible list (identical verse reused) and
   the entry re-pointed at it, which is what makes Reveal Original work afterwards
   (PL-68).
5. A dropped `.owapl.tar.gz` is unpacked from **where it already sits** (`appFilePath`
   stamped by the electron preload), never copied into the app folders first — bundles are
   big. Only if a drop carries no path is it staged in temp (PL-45).

Driving a real drop through CDP works here: dispatch a plain bubbling `Event('drop')` with
a fabricated `dataTransfer` and stamp `appFilePath` on the `File` — see CLAUDE.md's
file-drop note. That exercises the whole import pipeline against a real file on disk.

### 14.8 Failure surfaces that are easy to miss

- A damaged entry becomes ONE error row (`Invalid item`) plus a toast — the rest of the
  playlist must still render, and the bad entry must survive a later write of the file
  (PL-51).
- `tran()` throws in dev on a missing Khmer key and blanks the page, so the locale pass
  (§6d / LT-01) MUST cover the playlist strings: `Drop items here`,
  `No items in this playlist`, `No slides`, `Not Supported Item Type`, `Preview Playlist`,
  `Open Preview`, `Remove from Playlist`, `Choose Color`, `Move up`, `Move down`,
  `Collapse All`, `Expand All`, `Slide Thumbnail Size Scale`, `Import`, `Export`,
  `Fail to read file data`. All were present in `src/lang/data/km/index.ts` on
  2026-08-04 — re-check after any new playlist string.
- There is **no save button** anywhere in this panel: every mutation writes the `.owp`
  through immediately. "Nothing happened" therefore means the write failed, not that a
  save is pending.
