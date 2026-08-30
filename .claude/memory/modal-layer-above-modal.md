---
name: modal-layer-above-modal
description: "Floating widget above a modal: ModalLayerContext for widgets in the modal's React tree, explicit isAboveModal for window-level hosts opened from a modal — picking the wrong route is the bug"
metadata:
  node_type: memory
  type: project
  modified: 2026-08-30T00:00:00.000Z
---

From `3f7253ac` ("fixed in floating-widget and modal", 2026-08-16). A floating
widget is portaled to `document.body`, so a widget opened from INSIDE a modal
used to paint under it.

**Two escalation routes — choosing wrong is the bug:**

- **Context** for a widget whose toggle lives in the modal's own React tree:
  `src/app-modal/modalLayerContext.ts` (`ModalLayerContext` /
  `useIsInModalLayer`). The load-bearing insight (from its own comment): React
  context follows the **React tree, not the DOM**, which is exactly what a
  portaled widget needs — it is opened by, and belongs to, whatever modal
  hosts its toggle, even though its DOM node is on `document.body`.
- **Explicit `isAboveModal?: boolean`** (`floatingWidgetHelpers.ts`) for
  *window-level* hosts mounted OUTSIDE every modal but opened from inside one
  (e.g. the lookup record detail panels) — context cannot see those.

**Z-index bands** (`src/others/variables.scss`; ordering rationale lives only
in the SCSS comments): `$z-index-floating-widget-above-modal: base+46` and
`$z-index-blocking-modal: base+56`, plus `PrimitiveModalComp`'s
`.modal-container--blocking`. Alert/confirm must outrank an in-modal widget;
the above-modal band must clear the WHOLE modal stack (`app-popup-full`,
resize-actor, full-view).

Also notable: this commit added `src/app-modal/floatingWidgetModalLayer.test.tsx`,
but the `47053c9d` test prune (2026-08-24, a week later) deleted it again — the
modal-layer invariants are **unit-untested today**; verify layering live
([[appprovider-mock-node-env]]).
