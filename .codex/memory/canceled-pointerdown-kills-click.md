---
name: canceled-pointerdown-kills-click
description: A drag surface that preventDefaults pointerdown gets NO mousedown/click/dblclick from Chromium, so onClick/onDoubleClick there is dead code
metadata:
  type: project
---

Any element whose `pointerdown` is canceled receives **no** `mousedown`, `mouseup`,
`click` or `dblclick` afterwards in Chromium — an `onClick`/`onDoubleClick` on it is dead
code that fails silently. Measured live on 2026-08-09 against the running app: a real CDP
double-click on a floating widget header produced `pointerdown ×2` and zero of the other
four.

**Why:** the widget's drag path (`startInteraction` in
`src/app-modal/FloatingWidgetComp.tsx`) calls `event.preventDefault()` on `pointerdown` to
kill text selection and native drag, which also suppresses the whole compatibility mouse
sequence. The Pointer Events spec's "click/auxclick/contextmenu are still fired" note does
NOT extend to what Chromium does here.

**How to apply:** on a drag surface, detect the gesture from the pointer events
themselves rather than reaching for a mouse event — the header's maximize toggle times two
`pointerdown`s (400ms / 6px, `DOUBLE_PRESS_MILLISECOND`) and `stopPropagation()`s the
second so it starts no move. Same trap awaits any future click handler on a resize handle
or on the body of a widget with `isBodyDraggable`. See [[drag-kind-mime-and-dim-target]]
for the other drag-surface gotcha.
