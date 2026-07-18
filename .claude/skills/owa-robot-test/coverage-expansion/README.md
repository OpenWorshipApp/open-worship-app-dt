# coverage-expansion — provenance for the 2026-07-18 matrix expansion

These are **research artifacts**, not runtime skill references. They record how
[`../references/coverage-matrix.md`](../references/coverage-matrix.md) grew from ~150 to
**535** stable-ID test rows (every interactive path + every keyboard shortcut + every
context-menu item enumerated as a deterministic, source-cited unit test).

## What's here

- **`discover-*.md`** — 11 per-subsystem exhaustive source sweeps of `src/`. Each row is a
  candidate test path in `| ID | Target | Interaction | Keys | Given | When | Then | Source (file:line) | Status |`
  form, where `Status ∈ {COVERED, REFINE, GAP}`:
  - `shortcuts` — every keyboard path (`useKeyboardRegistering` call sites, raw handlers,
    electron-menu accelerators, the key-event **layer** system).
  - `context-menus` — every right-click menu and each of its items.
  - `presenter-lists`, `presenter-middle`, `foreground`, `background`, `screen-preview`,
    `bible`, `editor`, `settings-popups`, `cross-cutting` — the rest of the UI surface.
- **`final/*.md`** — the deduped, ID-assigned fragments (matrix 4-column format) that were
  spliced into the coverage matrix, one per section owner, plus a `### REFINE` list per
  fragment. Disjoint ID ranges were assigned per fragment so nothing collided; shortcuts
  are owned by the `KB` pass and context-menu items by the new `CM` section.

## How the matrix was built from these

1. Fan-out source sweep → `discover-*.md` (exhaustive, cite every `src` line).
2. Per-section finalizers → `final/*.md` (drop COVERED, keep GAP, consolidate sibling
   families, defer shortcuts→KB and menu-items→CM, list REFINEs).
3. Mechanical splice into `coverage-matrix.md`: append per-section rows, renumber `PR`/`NAV`
   contiguously, rebuild `KB-01..60`, insert `CM-01..92`, apply all REFINEs, recount the
   footer, bump `matrixVersion`.

## Regenerating / extending

When `src/` changes materially, re-sweep the affected subsystem (new `*Comp.tsx` folders =
new rows), refresh that `discover-*.md` + `final/*.md`, and re-splice. Keep each new row's
`(src: file:line)` cite so the matrix stays verifiable.

## Drift the sweep surfaced (source-verified, pending live confirmation)

Foreground and Bible-styling panels are now **floating widgets** (not split-tabs);
presenting a slide is a **single-click toggle**; Background **Web `+`** opens a menu;
Theme offers **System/Light/Dark**. Encoded as coverage-matrix REFINEs (`PM-01`, `PM-06`,
`PM-13/14`, `PM-33`, `PM-57`, `ST` theme rows) and flagged in `components-path.md` /
`user-workflows.md` for the next live run to confirm.
