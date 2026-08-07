---
name: full-view-toggle-collapses-widget
description: Clicking "Full view" during QA collapses a presenter widget and PERSISTS it; several elements share that title
metadata:
  type: project
---

Toggling "Full view" in the presenter writes a collapsed flex size to
`widget-size-app-presenter-middle` in
`Desktop\open-worship-data-dev\local-storage` — e.g.
`{"v1":["1.64 1 0%"],"v2":["1.94 1 0%",["second",1.94]]}`, where the
`["second", N]` marker is the disabled/collapsed state. The Background panel
(Colors/Images/Videos/…) then renders at zero height and **a page reload does not
fix it**, because the size is persisted.

Worse, `document.querySelectorAll('[title="Full view"]')` matches several
elements — the presenter's own full-view button AND each screen previewer's —
so a `[title]`-based click during CDP driving hits the wrong one.

**Why:** an accidental full-view toggle looks like a layout bug caused by the
code under test, and survives reloads, so it can burn a lot of debugging time.

**How to apply:** don't click "Full view" during QA. If a middle-column panel
disappears, check that setting file before suspecting your change. Restore just
that one key to the layout default from `AppPresenterMiddleComp.tsx`
(`{"v1":["3"],"v2":["1"]}`) and reload — Settings → "Reset Widgets Size" works
too but wipes every widget size the user customized. Related:
[[dev-hmr-stale-state-qa]], [[cdp-dynamic-import-hijack]].
