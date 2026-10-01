---
name: bootstrap-btn-vars-are-dead
description: "Bootstrap's --bs-btn-padding-* variables do nothing in this app; .app .btn hardcodes padding, so button padding must be declared"
metadata:
  node_type: memory
  type: project
  originSessionId: 7c6db5e1-fd99-4517-af29-53f9e0e6aa75
  modified: 2026-09-29T01:19:19.425Z
---

`src/others/bootstrap-override.scss` writes `.app .btn { padding: 0.25rem }`
outright. Bootstrap 5.3 buttons are otherwise variable-driven
(`padding: var(--bs-btn-padding-y) var(--bs-btn-padding-x)`), so that one
declaration **kills `--bs-btn-padding-y` / `--bs-btn-padding-x` app-wide** —
setting them looks right, changes nothing, and the button keeps its uniform 4px.

The other button variables still work, because nothing overrides the
declarations that read them: `--bs-btn-font-size`, `--bs-btn-line-height`,
`--bs-btn-border-radius`, `--bs-btn-color` and the hover pair.

**Why:** this cost a measure-and-retry lap on the Tip of the Day card — the
padding was "reduced" twice with no pixel moving, and only a computed-style read
off the live app (`getComputedStyle(btn).padding` still `4px`) showed why.

**How to apply:** to make a button tighter or looser, declare `padding:`
yourself at a selector that beats `.app .btn` (0,2,0) — a component scope such
as `.app-toast-stack > .app-daily-tip .btn` does it without `!important`. Keep
size and rhythm on the variables. The same trap is worth checking for any other
`.app <element>` hardcode before reaching for a `--bs-*` knob; related
[[console-design-system-tokens]].
