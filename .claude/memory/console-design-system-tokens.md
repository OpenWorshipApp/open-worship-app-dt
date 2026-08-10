---
name: console-design-system-tokens
description: The console has a real design system (--app-accent / --app-on-air / --app-text-* / .app-data); reach for it instead of --bs-* or magic px
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c7dbfa0-0489-4c4c-899b-1ef4e06fc0df
  modified: 2026-08-08T19:31:23.765Z
---

`theme-override-{dark,light}.scss` + `interaction.scss` publish a small, deliberate
system, and it is under-adopted rather than absent — reach for it in any new or
reworked UI:

- `--app-accent` / `--app-accent-halo` — **selection / where something is**.
- `--app-on-air` / `--app-on-air-halo` — **the one reserved hue**: content live on
  a congregation screen, nothing else. `variables.scss` records that a single
  magenta once did four jobs and was retired precisely so rank could exist.
- `--app-ink` / `--app-muted` / `--app-line` / `--app-surface` — the grey ramp.
- `--app-yellow-green` — drop affordances (`.receiving-data-drop-*`).
- `--app-text-xs|sm|md|base|lg|xl` — the absolute type scale (keep `em` where type
  must track a resizable container).
- `.app-data` — tabular figures for any number that ticks or columns.
- `:focus-visible` already ships a 2px accent ring; a control only needs
  `role="button"` + `tabIndex` to get it.

As of 2026-08-08 `src/presenting-flow/` was reworked onto all of this (it had used
zero `--app-*` tokens, a 10/11/12/13px ladder, and `--bs-info` cyan as a third
shouting hue). Other subsystems have **not** been swept.

**Why:** `--bs-*` and raw px look harmless but quietly add a hue with no rank, or
a ragged number column, in an app read at a glance in a dark booth.

**How to apply:** before adding a colour, ask which of the above it already is;
only `--app-on-air` may be warm-bright. Contrast-check any `opacity` dim against
the shell rather than judging by eye — 0.5 on `--app-muted` falls under 3:1.
Related: [[presenting-flow-cue-gutter]].
