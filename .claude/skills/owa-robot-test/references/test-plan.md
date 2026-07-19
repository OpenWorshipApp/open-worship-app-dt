# OWA Robot Test — Scenario checklist & report format

Work through the scenarios relevant to the requested focus area (or all of them). For
each: take a snapshot, interact, screenshot, then re-check console + network. Record
anything abnormal using the severity scale and report template below.

> **Two scenarios run in EVERY run, regardless of focus: S0 (baseline) and S7 (screen
> controlling & presenting).** A run that never presented content and never drove the
> `screen.html` output target is incomplete — the report must say so.

> **Full-coverage runs:** scenarios are the *narrative* grouping; the *accounting* unit
> is the row IDs in [coverage-matrix.md](./coverage-matrix.md) (each scenario lists the
> matrix rows it covers). A scenario is only complete when all its rows have a status in
> the run's `coverage-<runid>.json` (see SKILL.md §6b).

## Severity scale

| Severity | Meaning |
|---|---|
| Critical | App crash, blank window, unusable core flow, uncaught error breaking a feature |
| High | Core feature broken or unresponsive; data not shown; modal won't open/close |
| Medium | Feature works but with visible glitch, wrong state, or noisy console errors |
| Low | Minor visual/polish issue, cosmetic misalignment |
| Info | Accessibility gap, non-blocking warning, suggestion |

## Scenarios

> Each page is reached by navigating the main window to its dev URL (see SKILL step 5,
> "Change to the page / route under test"). After every navigation, re-run the readiness
> check and reset the console/network baseline before running that page's scenarios.

### S0 — Load & baseline (always run) `[GL-01..05]`
- App reaches ready state (page-agnostic ready check passes; on `presenter.html`,
  `#app-header` present); `.loading` image gone.
- No uncaught console errors/warnings at load.
- No failed network requests (`4xx`/`5xx`) at load.
- Baseline screenshot captured.

### S1 — Top navigation & routing `[NAV-01..11]`
- Click each header tab: `Presenter`, `Bible Reader`, `Slide Editor` (if enabled) and
  verify the window URL changes to the matching `.html` (navigation uses `location.href`).
- `Slide Editor` with no document selected: expect the "No slide selected" alert, not a
  crash and not a navigation.
- Direct route load: `navigate_page` to `reader.html` and `appDocumentEditor.html` (both are
  **main-window** pages); confirm each reaches readiness with no console errors. Do **not**
  `navigate_page` to `setting.html` — it is a popup (see S8 and
  [knowledge-base.md](./knowledge-base.md) §2).
- Navigate back to `presenter.html` and confirm the UI restores.

### S2 — Documents / slides (left + middle "Documents" tab) `[PL-01..06, PM-05..10]`
- Select the `Documents` presenter tab → thumbnails/preview render.
- Select a document in the left list → item gets `.active`, slides load, footer path
  updates.
- Drag the thumbnail size range slider → thumbnails rescale.
- Arrow-key navigation of thumbnails (focus the container first).
- Double-click a thumbnail → slide goes live; clear with `F8`.
- Right-click a document / a thumbnail → context menu renders (full coverage: create a
  scratch document, rename it, delete it — self-cleaning).
- Slide auto-play widget (stopwatch icon in the Documents footer): expand, set seconds,
  play → slides auto-advance, close.

### S3 — Lyrics `[PL-07..09, PM-11]`
- Select the `Lyrics` presenter tab; select a lyric in the left list.
- Confirm the lyric renders; sending it "to screen" toggles `.app-on-screen` (restore
  after).
- Right-click a lyric → `edit` opens the **Lyric Editor popup** (S12 covers the editor
  itself).

### S4 — Bible lookup & Bibles tab `[NAV-06..08, PM-12..14, PR-01..03]`
- Open lookup via `Bible Lookup` button and via **Ctrl+B**; `#modal-container` appears.
- Type a reference (e.g. `John 3:16`), submit, verify results render.
- Close via the modal close button and via **Ctrl+Q**.
- Presenter `Bibles` tab shows selected verse; `Bibles`/`Notes` right-column sub-tabs
  switch correctly.
- The Bibles-tab split also hosts **bible appearance settings** (`Appearance` +
  `Text Shadow` cards): adjust one control each, confirm the preview restyles, restore.

### S5 — Foreground `[PM-15..25]`
- Presenter `Foreground` tab: exercise **all nine** widgets — marquee top, marquee bottom, quick text,
  countdown (both datetime and duration modes), stopwatch, clock, images slideshow,
  camera (skip → BLOCKED if no device), web overlay — confirm each shows on the mini
  screen preview without console errors, then hide it.
- Common properties (font size / color / position) restyle the live foreground.
- One widget's Show button: right-click (force choose screen) and drag→drop onto the
  mini-screen.

### S6 — Background `[PM-26..35]`
- **Expand the collapsed Background panel first** (the tab bar isn't in the DOM until
  expanded — KB §5).
- Switch background tabs: `Colors`, `Images`, `Videos`, `Cameras`, `Web`, `Audios`.
- Selecting a color/image/video updates the mini screen preview (handle the contrast
  confirm; **restore the original background after**).
- `Audios` playback toggles `.app-on-screen`; toggling the split off while playing pops
  a toast.
- `Web` tab `+` opens the **Web Editor popup** (S12).
- Right-click background items → context menu.

### S7 — Screen controlling & presenting `[PR-04..07, SP-01..12, SC-01..05]` — **MANDATORY, every run**

This is the app's core flow and runs in **every** session, whatever the focus area
(SKILL.md §6a). Everything here is self-restoring — end with the screen hidden (unless
it started showing) and all changed state restored.

**Mandatory core (minimum for a focused run):**
- Present one real item (single-click a slide thumbnail — presenting is a single-click
  TOGGLE, KB §5 — or double-click a bible verse); confirm `.app-on-screen` + the mini
  screen mirrors it (PR-04).
- Clear-control states: the matching `BG`/`SL`/`BB`/`FG` button flips outline→solid
  while its layer is live; clicking (or `F6`–`F10`) clears it back (SP-02, KB-03..07).
- Show the screen via `ShowHideScreen` / `F5` (SP-01) → a `screen.html?screenId=N`
  target MUST appear in `list_pages` → `select_page` it → readiness check →
  **screenshot the screen target itself** (SC-01) and verify layer composition against
  the mini preview (SC-02). Screen-only bugs (full-width PDF etc.) never reproduce in
  the mini preview.
- Hide (toggle, `F5`, or the ❌ `#close` button on the output — SC-04): the target
  disappears; restore everything.

**Full-coverage additions (SP/SC deep rows):**
- Lock toggle: locked (red `bi-lock-fill`) refuses slide changes with a "Screen Manager
  is locked" toast; unlock restores (SP-03).
- Screen-id badge + color note round-trip (SP-04); display-choosing context menu lists
  every display, `*` on current — re-select current as a safe no-op (SP-05).
- Transitions `Tr: Slide:/Background:` — pick a different effect (none/fade/move/zoom),
  present, observe, restore (SP-06). Stage number `St:` menu round-trip (SP-07).
- With a video background live: `bi-soundwave` toggles the audio-handler rows; play/
  pause syncs the bg video; repeat toggle flips; off-while-playing pops a toast
  (SP-08..09).
- Previewer context menu (`Refresh Preview`, and with a bible live `Set/Unset Line
  Sync`) (SP-10); `Add New Screen` → solo/select → delete the added screen —
  self-cleaning (SP-11); drag a slide/foreground onto a specific previewer card
  (SP-12).
- `Ctrl/Alt+ArrowLeft/Right` on the screen target steps the live bible verse (SC-03).
- After hiding: screen console forwards via `all:app:log` to the `npm run dev`
  terminal — check it when hunting screen-only bugs (SC-05).
- Zoom slider rescales the preview (PR-05); widget-fullscreen `.app-full-view` on/off
  (PM-04).

**EX-02 (narrowed):** only *leaving* the display taken over — or the user explicitly
saying the display is in live use — is excluded. In that case skip the show step,
assert via mini-screen, and mark SC-01/02 `BLOCKED→EX-02` with the reason.

### S8 — Settings `[ST-01..10]`
- Open settings via the **gear button** (it opens a **popup window**); then `list_pages` →
  `select_page` the new `setting.html` target. Do **not** `navigate_page` the main window to
  `setting.html` (popup trap — see [knowledge-base.md](./knowledge-base.md) §2–§3).
  Title matches `/Settings/`.
- `General` + `Apply Settings` visible and clickable. (`Set Default Data` from older builds is
  gone — the current General tab has `Reset All Child Directories` / `Reset Widgets Size` /
  `Clear All Settings`; the `Khmer`/`English` language toggle lives here too.)
- Full coverage: theme + font pickers (restore after); destructive resets → confirm
  dialog → **Cancel** (EX-05); Bible tab search + enable/disable round-trip (EX-07 for
  downloads); `Apply Settings` **last** since it reloads windows.

### S9 — Cross-cutting checks (do throughout) `[GL-02..05, GL-11]`
- Console stays clean after each interaction (diff against baseline).
- No new failed network requests.
- Icon-only buttons have accessible names in the snapshot (flag unnamed ones).
- No clipped/overflowing text, overlapping controls, or broken images in screenshots.
- Optional: performance trace around a heavy action (document load) — flag long tasks.

### S10 — Slide / Doc Editor deep-dive `[ED-01..12]`
- Select an Open-Worship document, enter the editor (header tab or double-click).
- Slide list: select / duplicate via context menu / delete the duplicate / drag-reorder.
- Canvas: select a box, drag-move, resize by handle, `Shift`/`Ctrl` multi-select.
- Double-click a text box → edit mode → type → click away → text persists; `Ctrl+S`
  saves; `Ctrl+Enter` focuses the canvas.
- From the **presenter** slide list, right-click → **Edit ↗** opens the app document
  editor in its own window, focused on that slide `[ED-10]`.
- Tools: add a new box / drag a tool onto the canvas — then delete the added item.
- Bottom Background panel behaves as in S6.

### S11 — Bible Reader deep-dive `[RD-01..12]`
- Incremental picker: char-by-char book → chapter → verse; `Tab` completes, `Escape`
  clears, `Ctrl+Escape` clears a chunk; extra buttons mirror the keys.
- Full ref `John 3:16` resolves to the exact verse (reader page only — the modal picker
  book-filters, a known Low).
- History entry re-runs a lookup; bible-version switch re-renders the verse.
- **Advance lookup toggle** opens the **Bible Find** split: type a find query, results
  paginate via the page-number buttons.
- Cross-references view renders for a verse (AI providers BLOCKED without API keys).

### S12 — Popup windows `[PU-01..06]`
- Each popup: open via its in-app trigger, `list_pages` → `select_page` the new target,
  generic readiness check, exercise, close the popup page.
- **Finder**: query, prev/next, case-sensitive checkbox, `Enter`.
- **Lyric Editor** (from S3): edit → `Ctrl+S` → **restore the original text**.
- **Bible Note** (from S4 Notes): type in `#bible-note-root`, save, restore.
- **Web Editor** (from S6 `+`): URL + title → save → item appears → delete it (cleanup).
- **About**: version renders; don't follow external links (EX-04).

### S13 — Drag/drop, resizers & responsive `[GL-12..13, PM-25, ED-04/09]`
- Drag at least one `ResizeActorComp` splitter per page; layout holds and persists.
- Foreground drag→drop onto mini-screen; slide-list and document-list reorders.
- `resize_page` to a small (~1024×700) and large size: right column flips layout,
  nothing overlaps.

### S14 — Keyboard matrix `[KB-01..60]`
- Run every row of the KB table in the matrix explicitly (many will already be PASS from
  earlier scenarios — just fill in the gaps).

### S15 — Locale & theme passes `[LT-01..04]`
- After everything else: switch locale (Settings → Language), spot-check presenter /
  reader / settings screenshots — labels translate per the KB §1 map, no raw i18n keys,
  no clipped Khmer text — then **restore**. Same for dark/light theme.
- Remember: a locale change you didn't make may be the **user** (KB §1).

### S16 — Edge & empty states (opportunistic)
- `Slide Editor` with no document → alert, no navigation (NAV-03).
- Editor with a non-OWA document → "Return to Presenter" popup (ED-01).
- Bible key not downloaded → `BibleNotAvailableComp` renders instead of a crash.
- Empty find query / no find results → sane empty state, no console errors.

### S17 — Context-menu items `[CM-01..92]`
- For each host that opens a right-click menu (document / lyric / bible / background / note
  items, slide thumbnails, editor slide list, mini-screen previewer card, display / stage /
  transition controls, generic file lists), 🖱️R to open it and assert the item set via
  `[...document.querySelectorAll('#app-context-menu-container .app-context-menu-item')].map(e=>e.textContent)`.
- Exercise each non-destructive item and assert its observable effect (popup opens, a new
  CDP target, `.active` / `.app-on-screen` toggle, item-count delta, toast).
- Destructive items (`Delete` / `Move to Trash` / `Empty` / reset): click → confirm dialog →
  **Cancel** (EX-05), or create a scratch item and delete THAT.

### S18 — Cross-window edit→present propagation `[XW-01..07]` — the regression class one-window runs miss

Separate OWA windows are separate renderers that sync only via disk + `fs.watch`, so an
edit in one window reaching another is emergent cross-process behavior a single-window pass
never checks (this is how a "resize a box in the editor → Presenter preview didn't update"
regression shipped). **Read KB §12 first.** Run this whenever the focus touches the editor,
document/lyric lists, or the file-reload/`useFileSourceEvents` wiring.

1. **Scratch doc, not the user's.** Create a throwaway document; select it in the Presenter
   so `VarySlidesComp` shows it; optionally **present** slide 1 (SP/SC). Note the live screen
   is an intentional snapshot and is **not** expected to auto-update on save (step 4 / XW-03).
2. **Two windows.** Open that doc's Doc Editor as a **separate window** — the `Slide Editor`
   tab's `bi-box-arrow-up-right` external icon (NAV-21) or a doc row's **Edit ↗**
   (`openPopupWindow`), **not** the in-place `Slide Editor` tab. `list_pages` should show
   both `appDocumentEditor.html` and `presenter.html`/`screen.html`. *(Opening/closing the
   popup may cause a chrome-devtools-mcp "browser reconnected" — re-`list_pages`/`select_page`
   after each; read screen visibility from `.show-hide.showing`, not target enumeration.)*
3. **CDP-drivable edit** in the editor target (CDP can't drag-resize / Monaco-type — needs OS
   focus): select a box → `fill` the **Position/Size/Rotate** numeric inputs (ED-19) or slide
   **W/H** (ED-17); or programmatic `CanvasController` mutation; or direct
   `fileSource.writeFileData(json)`. Then **Save** (green button / `Ctrl+S`).
4. **Assert propagation** within ~3 s: Presenter `VarySlidesComp` reflects it (XW-01),
   list-row thumbnail reflects it (XW-02). A stale **auto-reload** target after a **saved**
   edit = **regression → FAIL + Finding** (name the broken hop from KB §12.2; e.g. watcher
   never fired / bridge unmounted / stale 2 s cache / consumer not subscribed). An **unsaved**
   edit not showing is **correct** (XW-04), not a bug.
   - **XW-03 — live `screen.html` of a presented slide:** staying stale after a saved edit is
     **expected, not a bug** — the presented slide is an intentional snapshot; the operator
     **applies** the change by **re-presenting**. Verify the apply path: **re-present** (clear
     + present again, or click the slide) and confirm the `screen.html` output *then* reflects
     the edit. FAIL only if the screen stays stale **after re-present** (or the saved bytes on
     disk are wrong).
5. **Restore:** editor **Undo** (`Ctrl+Z`, never *Discard*) + re-save (or write back original);
   delete the scratch doc; restore any presented/shown state.

**Severity guidance:** a saved edit that never reaches the Presenter **center preview / list
rows** is **High** (the operator sees stale content). The live screen **not** auto-updating is
**expected** (snapshot) — score it a FAIL only when **re-presenting** fails to apply the edit.

## Report template

Write to `test-results/robot-test/report-<timestamp>.md`:

```markdown
# OWA Robot Test Report — <timestamp>

- App version: <package.json version>
- Focus area: <all | full | presenter | ...>
- Windows exercised: presenter.html, setting.html, ...
- Result: <N Critical, N High, N Medium, N Low, N Info>

## Summary
<one-paragraph verdict>

## Mandatory screen block (required in EVERY report)

- Presented: <what was presented, e.g. slide 2 of "test.owa">
- SP-01 <status> · SP-02 <status> · SC-01 <status> · SC-02 <status>
- Screen target screenshot: `<file>.png` (taken FROM screen.html, not the mini preview)
- Restored: <screen hidden, layers cleared, state restored — or what was left and why>
- (If skipped: `BLOCKED→EX-02` + the user's live-use reason — never skip silently)

## Coverage (full-coverage runs — from coverage-<runid>.json)

- Matrix version: <date> · rows total: 535
- PASS <n> · FAIL <n> · PARTIAL <n> · BLOCKED <n> · EXCLUDED <n>
- **Coverage: <exercised> / <in-scope> = <xx.x>%**  (exercised = PASS+FAIL;
  in-scope = total − EXCLUDED)

| Row | Status | Reason / note |
|---|---|---|
| PM-32 | BLOCKED | EX-03: no camera device |
| ... | ... | <every non-PASS row gets a line — no silent gaps> |

## Findings

### [SEVERITY] <short title>
- **Area / scenario:** S# — <name>
- **Steps:** <what was clicked/typed>
- **Expected:** <...>
- **Actual:** <...>
- **Evidence:** screenshot `test-results/robot-test/<file>.png`; console `<line>`;
  network `<method url status>`
- **Suspected source:** <file/component to inspect, if known>

## Console log summary
<grouped errors/warnings with counts>

## Network summary
<failed/slow requests>

## Screenshots
<list of captured screenshots with captions>
```

Then post a short chat summary: verdict + the top issues by severity with evidence
paths. Do not fabricate results — only report what the tools actually observed.
