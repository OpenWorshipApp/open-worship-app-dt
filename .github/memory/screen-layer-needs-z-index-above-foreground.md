---
name: screen-layer-needs-z-index-above-foreground
description: "A new screen layer must be pinned above the foreground items' own \"Always on Top\" z-index, or a full-screen overlay silently paints over it"
metadata:
  node_type: memory
  type: project
  originSessionId: f4291fec-64cc-4c54-9d03-7f7fbeb846cb
  modified: 2026-09-25T13:33:38.331Z
---

A new screen layer added after `#foreground` in `ScreenAppComp` / `MiniScreenAppComp`
is NOT automatically on top. Every foreground overlay carries its own **Always on
Top** number — `zIndex` in the item's `extraStyle`, 7 by default — and `#foreground`
deliberately makes no stacking context, so that number competes directly with the
new layer in the ROOT stacking context. A layer with `z-index: auto` loses to it.

Measured 2026-09-25 while adding the Mask layer: the blanking bars were rendering
correctly, persisted correctly and synced correctly, and were invisible on the real
output the whole time because a full-screen **Video Show** at `z-index: 7` was
painted over them. It looked exactly like a layer that was not rendering at all —
three reloads and a settings hunt went past it. `ScreenMaskManager.render()` now
pins `zIndex: '2147483000'`.

**Why: this does not contradict the foreground blend-mode rule** ([[foreground-blend-mode-stacking]]).
That rule forbids a `z-index` on `#foreground` ITSELF, because one there would cut
its children off from the background they blend with. A SIBLING layer's z-index
changes only what paints over it.

**How to apply:** when adding a screen layer, decide explicitly whether it sits
above or below foreground overlays and set `zIndex` to say so — do not rely on DOM
order. And when a new layer "does not render", check the stack before the data path:
verify on the real output window, not only the mini preview ([[dev-hmr-stale-state-qa]]).
