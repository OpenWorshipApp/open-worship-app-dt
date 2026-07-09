# OWA Robot Test — Scenario checklist & report format

Work through the scenarios relevant to the requested focus area (or all of them). For
each: take a snapshot, interact, screenshot, then re-check console + network. Record
anything abnormal using the severity scale and report template below.

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

### S7 — Mini screen / presentation `[PR-04..07, SC-01..03]`
- Confirm the mini screen (`.card.app-zero-border-radius`) reflects the active content.
- Zoom slider changes preview scale.
- Clear buttons / `F6`–`F10` each clear their layer.
- Toggle widget-fullscreen (`bi bi-arrows-fullscreen`) — `.app-full-view` on/off. Do
  **not** take over the physical display (EX-02); check for a `screen.html` target via
  `list_pages` only if content is being presented, and remember the physical screen
  window is **not on CDP** (its logs forward via `all:app:log`).

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
  saves; `Ctrl+Enter` focuses the canvas; quick-edit popup closes on `Escape`.
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

### S14 — Keyboard matrix `[KB-01..12]`
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

## Coverage (full-coverage runs — from coverage-<runid>.json)

- Matrix version: <date> · rows total: 135
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
