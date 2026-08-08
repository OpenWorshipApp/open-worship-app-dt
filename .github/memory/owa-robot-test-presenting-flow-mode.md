---
name: owa-robot-test-presenting-flow-mode
description: `/owa-robot-test presentingFlow` is a tracked 11-phase MODE over 66 run-sheet rows, not a focus area that trims the run
metadata:
  type: project
---

Asking the skill for `presentingFlow` (or `run sheet` / `.owpf`) selects **presenting flow deep mode** —
SKILL.md §6f, recipe test-plan **§S20**, model knowledge-base **§14**, scope set stated in
`docs/test-paths/coverage-matrix.md`. Added 2026-08-06 because the run sheet grew four
subsystems in three days (actions, CC elements, the clocks, hotkeys, archives) and the old
§6f was a seven-bullet "deep pass" that named a row range which had since doubled.

**Why it is a MODE, not a focus:** a focus area normally trims a run. This one turns
coverage accounting ON (`"focus": "presentingFlow"` in `coverage-<runid>.json`, resumable) and
runs P0..P10 in order, so a presenting flow run is auditable the same way a full-coverage run is.

**How to apply:**

- **Scope = 69 rows: PL-10, PL-29, PL-32..PL-76, PL-81..PL-102.** The other PL rows are the
  Documents/Lyrics lists and generic file-list chrome — same prefix, different subsystem,
  out of scope except where the fixture uses them. Adjacent-when-touched: `PL-77..80` +
  `NAV-17/18` (the `.owadoc`/`.owadata` archives share the bundle's code — see
  [[document-archive-owadoc]], [[data-archive-owadata]]) and `XW-01..07`.
- **The mandatory core rides inside the mode** — §6a is discharged by presenting FROM the
  sheet and driving the real `screen.html` target, which costs nothing extra here.
- **Fixture discipline:** build `zz-robot-<runid>` and tear it down. The panel has no save
  button, so every gesture writes the user's real `.owpf` immediately.
- **The rows most easily faked get their own report lines**: all 13 screen actions fired
  against a SHOWING screen (PL-72/74), the folded-sheet walk (PL-99), and the perf
  measurements with numbers (PL-63/70).
- KB §14 was also corrected in the same pass: its run-player rules still said audio,
  damaged and FOLDED lines were stepped over — stale since 2026-08-06, when parked became
  the only reason ([[presenting-flow-preview-run-player]]). New §14.9..§14.15 cover the action
  families, CC elements, the clocks + GOTO, the hotkey, pinning/parking, the archive
  family, and the CDP traps ([[cdp-dynamic-import-hijack]], the polluted keyboard-layer
  stack that makes the preview keys look dead).
