---
name: full-view-toggle-collapses-widget
description: A presenter pane closed during QA stays closed across reloads (the size is saved) -- Full view is NOT what closes it; several elements share the "Full view" title
metadata:
  type: project
---

Pressing "Full view" in the presenter writes nothing: it flips a state and the
`app-full-view` class (`RenderToggleFullViewComp`), and Escape or **Exit full
view** takes it off. Checked on a scratch instance 2026-10-11 — on, then off,
and `widget-size-app-presenter-middle` kept both its content and its
modification time. This note used to blame that button. What DOES close a
middle-column pane is a divider's **Close First / Second Widget**, a divider
dragged shut, or a **View → Widgets** tick, and each writes a collapsed flex
size to `widget-size-app-presenter-middle` in
`<appLocalStorage.defaultStorageDirPath>/local-storage`
(`localStorageDir` in `src/setting/directory-setting/appLocalStorage.ts`) — e.g.
`{"v1":["1.64 1 0%"],"v2":["1.94 1 0%",["second",1.94]]}`, where the
`["second", N]` marker is the disabled/collapsed state. The Background panel
(Colors/Images/Videos/…) then renders at zero height and **a page reload does not
fix it**, because the size is persisted.

Worse, `document.querySelectorAll('[title="Full view"]')` matches several
elements — the presenter's own full-view button AND each screen previewer's —
so a `[title]`-based click during CDP driving hits the wrong one. And the title
is now translated (`title={fullViewLabel}` from `tran('Full view')` —
`src/_screen/preview/ScreenPreviewerHeaderComp.tsx`, also `RenderToggleFullViewComp` in
`PresenterComp.tsx`), so in a Khmer run `[title="Full view"]` matches
NOTHING — target `[data-react-comp-name]` or the `bi-arrows-fullscreen` icon
class instead.

**Why:** a pane closed by a stray press on a divider looks like a layout bug
caused by the code under test, and survives reloads, so it can burn a lot of
debugging time.

**How to apply:** aim "Full view" by its panel (`Presenter > Full view`), never
by the bare title. If a middle-column panel
disappears, check that setting file before suspecting your change. Restore just
that one key to the layout default from `AppPresenterMiddleComp.tsx`
(`{"v1":["3"],"v2":["1"]}`) and reload. Two cheaper recoveries exist since
2026-08-09, both on the native **View** menu (NOT Settings any more): tick the
one pane back open under **View → Widgets**, or **View → Reset Widgets Size**,
which restores every pane live but wipes every size the user customized. The
native View menu is unreachable from CDP; `owa_menu` presses its items by path
through the main process, and dev's `globalThis.tryResetWidgetsSize()`
(`src/resize-actor/widgetAppMenuHelpers.ts:123`) is the same reset for a console — the
firewall refuses `evaluate_script`.
Related: [[view-menu-widget-toggles]], [[dev-hmr-stale-state-qa]],
[[cdp-dynamic-import-hijack]].
