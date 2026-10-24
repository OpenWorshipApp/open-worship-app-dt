---
name: keyboard-shortcuts-panel
description: "Help → Keyboard Shortcuts lists each page's keys from a written catalog that imports the bound key objects; a new shortcut needs a catalog row plus km/fr keys"
metadata:
  node_type: memory
  type: project
  originSessionId: a5cd4564-cacb-43b9-bee6-a98f5642a8e9
  modified: 2026-10-05T13:13:40.079Z
---

**Help → Keyboard Shortcuts** (2026-10-05, W-49, KB-61..KB-64) opens a
draggable `FloatingWidgetComp` panel listing the keys of the page in front, with
a search box and a matched/total counter. Asked for by the user as "like tips
but for keyboard shortcuts … a floating panel … in `Help` menubar"; they chose
the floating panel over the tips card and the menu ONLY (no opening key).

- `KeyboardShortcutsComp` is mounted by `AppWindowToolsComp` in every window,
  registers the Help item from the main window only (`isRoutedToFocusedWindow`,
  like the tips), and lazy-loads `KeyboardShortcutsPanelComp` on the first
  open. The panel claims NO keyboard layer, so a listed key can be tried while
  it is open; Escape in its box empties it, then closes.
- There is no runtime registry of shortcuts, so the list is written per page in
  `src/keyboard-shortcut/keyboardShortcutCatalog.ts`. Where a key has one
  declaration the catalog IMPORTS it: `appShortcutMappers.ts` (type-only
  imports, so it costs startup nothing) now holds Ctrl+B, F4–F10, the slide
  arrows, Ctrl+Shift+P/A, Ctrl+Q, the lookup keys, splits, Ctrl+W and Ctrl+S,
  and the components plus `LookupBibleItemController` / `bibleActionHelpers` /
  `editingHelpers` read or re-export them from there; the draw and
  presenting-control maps are imported from their own leaf modules.
- **While the Bible Lookup popup is open** (the user's follow-up the same
  day) the panel stacks over it (`isAboveModal: true` — a window-level host
  outside every modal) and lists `getBibleLookupShortcutGroups` under the
  title `Keyboard Shortcuts · Bible Lookup`: the popup holds the
  `bible-lookup` keyboard layer, so the page's own keys are silent. It reads
  `checkIsKeyboardLayerClaimed` on mount and follows the layer's
  `useWindowEvent` open/close after. Plain keys typed in its search box are
  stopped there (the lookup binds Enter, Tab and the arrows on `document`);
  F-keys and Ctrl/Alt/⌘ chords still reach the app.
- **A new or changed shortcut needs a catalog row** (and its km + fr `tran`
  keys, or dev throws) — inline `checkIsKeyboardEventMatch` handlers (slide
  list, canvas, context menu) are written out in the catalog by hand and are
  the part that can still drift.
- Key names (Space, ←, Esc, Page Down) come from `KEY_LABEL_MAP` in
  `src/event/keyboardKeyLabelHelpers.ts`, shared with the keyboard screencast.

Related: [[tran-missing-key-throws-in-dev]], [[keyboard-layer-stack-leak]],
[[view-menu-widget-toggles]].
