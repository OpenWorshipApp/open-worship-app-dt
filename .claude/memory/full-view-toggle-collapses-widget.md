---
name: full-view-toggle-collapses-widget
description: Clicking "Full view" during QA collapses a presenter widget and PERSISTS it; several elements share that title
metadata:
  type: project
---

Toggling "Full view" in the presenter writes a collapsed flex size to
`widget-size-app-presenter-middle` in `<appLocalStorage.defaultStorage>/local-storage`
(`src/setting/directory-setting/appLocalStorage.ts:45-59`) — e.g.
`{"v1":["1.64 1 0%"],"v2":["1.94 1 0%",["second",1.94]]}`, where the
`["second", N]` marker is the disabled/collapsed state. The Background panel
(Colors/Images/Videos/…) then renders at zero height and **a page reload does not
fix it**, because the size is persisted.

Worse, `document.querySelectorAll('[title="Full view"]')` matches several
elements — the presenter's own full-view button AND each screen previewer's —
so a `[title]`-based click during CDP driving hits the wrong one. And the title
is now translated (`title={fullViewLabel}` from `tran('Full view')` —
`src/_screen/preview/ScreenPreviewerHeaderComp.tsx:42-44,86`, also
`PresenterComp.tsx:60,73`), so in a Khmer run `[title="Full view"]` matches
NOTHING — target `[data-react-comp-name]` or the `bi-arrows-fullscreen` icon
class instead.

**Why:** an accidental full-view toggle looks like a layout bug caused by the
code under test, and survives reloads, so it can burn a lot of debugging time.

**How to apply:** don't click "Full view" during QA. If a middle-column panel
disappears, check that setting file before suspecting your change. Restore just
that one key to the layout default from `AppPresenterMiddleComp.tsx`
(`{"v1":["3"],"v2":["1"]}`) and reload. Two cheaper recoveries exist since
2026-08-09, both on the native **View** menu (NOT Settings any more): tick the
one pane back open under **View → Widgets**, or **View → Reset Widgets Size**,
which restores every pane live but wipes every size the user customized. The
native View menu is unreachable from CDP; `globalThis.tryResetWidgetsSize()`
(`src/resize-actor/widgetAppMenuHelpers.ts:123`) runs the same reset from
`evaluate_script`.
Related: [[view-menu-widget-toggles]], [[dev-hmr-stale-state-qa]],
[[cdp-dynamic-import-hijack]].
