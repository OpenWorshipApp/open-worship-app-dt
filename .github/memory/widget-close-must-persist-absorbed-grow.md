---
name: widget-close-must-persist-absorbed-grow
description: Closing a resizable widget must persist the grow its NEIGHBOUR absorbed, not only the disabled flag
metadata:
  type: project
---

`setDisablingSetting` (`src/resize-actor/flexSizeHelpers.ts`) reads the pane
sizes off the DOM (`genFlexSizeSetting`), not off the stored blob. Both closers
— `FlexResizeActorComp.close` (the divider's menu and its hover arrows) and
`RenderResizeActorItemComp.handleClosing` (the View menu) — hand the closing
pane's grow to a sibling by writing `style.flexGrow` and only then call it, so
reading the stored blob wrote the sibling back one grow BEHIND what the window
was showing.

**Why:** nothing showed while the app stayed open, because the DOM was right.
After a reload the sibling rendered at its stale grow and
`calcShowingHiddenWidget` subtracted the closed pane's space a SECOND time, so
every close / reload / reopen lap shrank the neighbour. Measured on the
previewer: 6 → 5 → 4 → 3. It only bit panes users collapsed by hand until the
Note pane started shipping closed ([[previewer-note-pane-ships-closed]]), which
made the reopen the common case.

**How to apply:** a new close path must mutate the DOM FIRST and then call
`setDisablingSetting`, never the other way round — and never persist a flag
without the sizes around it. Proven live 2026-09-28: close → reload → reopen
returns the same split it started from.
