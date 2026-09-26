---
name: panel-name-in-dom
description: 'An OPEN resize-actor panel — and, since 2026-09-24, a FLOATING one — drew its name nowhere; `data-widget-name` (English key) is now the only thing that names it, and component names are dev-only so they were never an option'
metadata:
  node_type: memory
  type: project
  originSessionId: f0c839b3-09f4-42a0-995b-a8446960b389
  modified: 2026-09-24T21:43:55.264Z
---

A resizable pane only ever displayed its name while **collapsed**
(`RenderHiddenWidgetTitleComp`). Open, it was anonymous — so "the Background
panel" matched nothing on screen and the help chatbot's ring landed on the
`Background:` transition button in the screen preview footer instead.

Since 2026-08-31 both states carry `data-widget-name` (`RenderResizeActorItemComp`
for the open pane, the hidden-title component for the collapsed bar). It is the
**English key** from `toWidgetLabel(labelKey)` — not the translated `widgetName`
— so a panel is still findable once the app is in Khmer. Panes named after a file
or a slide pass no `widgetKey` and fall back to what they display.

**A FLOATING panel needs it just as much** (2026-09-24). `FloatingWidgetComp`
takes a `widgetName` and stamps the same attribute; every foreground component
passes its English `labelKey`. Without it the panel was a nameless box and
everything inside it reported the pane BEHIND it — so the file grid each
foreground component reuses from the Background tabs was indistinguishable from
the Background tab's own copy, and `owa_find_ui "clock"` rang both. `inPanel`
now reads `Web Show` against `Background`, and `Web Show > clock` scopes to one.

**The cost of naming it:** a named element is a CONTROL to the matcher
(`labelPartsOf` reads `data-widget-name` as the label, and `[data-widget-name]`
is in `collect`'s selector). The foreground launcher's menu rows carry exactly
the panel names, so the row that OPENS a panel tied with the panel it opened —
`checkIsControl` counts `role="menuitem"` now so the row wins. Name a new
floating panel and check the same thing: does anything else on screen already
answer to that word?

**Why not `data-react-comp-name`:** those attributes are stamped by
`vite-plugin-comp-name.ts` with `apply: 'serve'`. They exist in dev only.
Anything matching on them works on your machine and silently fails for every
real user. Same trap for CSS class names, which are not stable and not names.

**Why:** it is the anchor the shared DOM matcher's parent-path support hangs on
([[dom-match-memoised-in-page]]) — `containerPathOf`, the `Background > Videos`
scope syntax, and the `inPanel` a match reports all read this attribute and
nothing else.

**How to apply:** a new panel added to a `dataInput` list gets its name for free
through `toWidgetLabel`. One that sets `widgetName` by hand should set
`widgetKey` too whenever an English name exists. Before "fixing" a matcher that
cannot find a panel, check the panel is _named_ first — and verify in BOTH the
open and the collapsed state: a fix proven in one of them is not a fix, which is
exactly how this bug came back after being closed once.
