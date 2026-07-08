# OWA Robot Test — Scenario checklist & report format

Work through the scenarios relevant to the requested focus area (or all of them). For
each: take a snapshot, interact, screenshot, then re-check console + network. Record
anything abnormal using the severity scale and report template below.

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

### S0 — Load & baseline (always run)
- App reaches ready state (page-agnostic ready check passes; on `presenter.html`,
  `#app-header` present); `.loading` image gone.
- No uncaught console errors/warnings at load.
- No failed network requests (`4xx`/`5xx`) at load.
- Baseline screenshot captured.

### S1 — Top navigation & routing
- Click each header tab: `Presenter`, `Bible Reader`, `Slide Editor` (if enabled) and
  verify the window URL changes to the matching `.html` (navigation uses `location.href`).
- `Slide Editor` with no document selected: expect the "No slide selected" alert, not a
  crash and not a navigation.
- Direct route load: `navigate_page` to `reader.html` and `appDocumentEditor.html` (both are
  **main-window** pages); confirm each reaches readiness with no console errors. Do **not**
  `navigate_page` to `setting.html` — it is a popup (see S8 and
  [knowledge-base.md](./knowledge-base.md) §2).
- Navigate back to `presenter.html` and confirm the UI restores.

### S2 — Documents / slides (left + middle "Documents" tab)
- Select the `Documents` presenter tab → thumbnails/preview render.
- Select a document in the left list → item gets `.active`, slides load, footer path
  updates.
- Drag the thumbnail size range slider → thumbnails rescale.
- Arrow-key navigation of thumbnails (focus the container first).

### S3 — Lyrics
- Select the `Lyrics` presenter tab; select a lyric in the left list.
- Confirm the lyric renders; sending it "to screen" toggles `.app-on-screen`.

### S4 — Bible lookup & Bibles tab
- Open lookup via `Bible Lookup` button and via **Ctrl+B**; `#modal-container` appears.
- Type a reference (e.g. `John 3:16`), submit, verify results render.
- Close via the modal close button and via **Ctrl+Q**.
- Presenter `Bibles` tab shows selected verse; `Bibles`/`Notes` right-column sub-tabs
  switch correctly.

### S5 — Foreground
- Presenter `Foreground` tab: exercise countdown / marquee / clock controls; confirm
  each toggles on the mini screen preview without console errors.

### S6 — Background
- Switch background tabs: `Colors`, `Images`, `Videos`, `Cameras`, `Web`, `Audios`.
- Selecting a color/image updates the mini screen preview.
- `Audios` playback toggles `.app-on-screen`.

### S7 — Mini screen / presentation
- Confirm the mini screen (`.card.app-zero-border-radius`) reflects the active content.
- Zoom slider changes preview scale.
- Toggle fullscreen (`bi bi-fullscreen`) — check for a new `screen.html` target via
  `list_pages` and that it renders.

### S8 — Settings
- Open settings via the **gear button** (it opens a **popup window**); then `list_pages` →
  `select_page` the new `setting.html` target. Do **not** `navigate_page` the main window to
  `setting.html` (popup trap — see [knowledge-base.md](./knowledge-base.md) §2–§3).
  Title matches `/Settings/`.
- `General` + `Apply Settings` visible and clickable. (`Set Default Data` from older builds is
  gone — the current General tab has `Reset All Child Directories` / `Reset Widgets Size` /
  `Clear All Settings`; the `Khmer`/`English` language toggle lives here too.)

### S9 — Cross-cutting checks (do throughout)
- Console stays clean after each interaction (diff against baseline).
- No new failed network requests.
- Icon-only buttons have accessible names in the snapshot (flag unnamed ones).
- No clipped/overflowing text, overlapping controls, or broken images in screenshots.
- Optional: performance trace around a heavy action (document load) — flag long tasks.

## Report template

Write to `test-results/robot-test/report-<timestamp>.md`:

```markdown
# OWA Robot Test Report — <timestamp>

- App version: <package.json version>
- Focus area: <all | presenter | ...>
- Windows exercised: presenter.html, setting.html, ...
- Result: <N Critical, N High, N Medium, N Low, N Info>

## Summary
<one-paragraph verdict>

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
