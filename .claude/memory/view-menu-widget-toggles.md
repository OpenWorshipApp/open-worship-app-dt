---
name: view-menu-widget-toggles
description: View → Widgets toggles each resizable pane and Reset Widgets Size applies live; the `view` menu bucket, the registry, and why the DOM styles must be blanked
metadata:
  type: project
---

Added 2026-08-09. The native **View** menu grew a renderer-contributed tail:
a **Widgets** submenu with a checkbox per collapsible pane, and
**Reset Widgets Size**, which left Settings → General for good.

- **The `view` bucket is new.** `CustomMenusDataType` in BOTH
  `electron/electronHelpers.ts` and `src/lang/langHelpers.ts` now has `view?`,
  and `initMenu` splices `getCustomMenuItems('view')` into the View submenu after
  a separator. `formatMenuItems` spreads the item, so `type: 'checkbox'` +
  `checked` pass straight through; it still drops label-less items, so a renderer
  cannot contribute a separator.
- **`src/resize-actor/widgetRegistry.ts`** is the single source. Entries are keyed
  `` `${flexSizeName}::${key}` `` and returned **sorted by id** — toggling
  re-registers an entry, which in a Map moves it to the end, so an
  insertion-ordered menu reshuffled itself every time the user picked something.
  One module-level `genTimeoutAttempt(500)` debounces the rebuild (module level is
  right: the ONE menu builder is the only subscriber), because each rebuild is an
  IPC round trip plus a full `initMenu()` + `Menu.setApplicationMenu`.
- **Registered from `run()` (`src/others/main.tsx`) for the main window only**, via
  the new `checkIsPopupWindow()` in `domHelpers`. Popups hide their menu bar, and
  a single registrant is what keeps the main process routing the click back to the
  window whose widgets the items describe.
- **`isDisableQuickResize` actors are excluded** — they cannot collapse at all, so
  the background media/audio split, the presenter control-center, the bible
  previewer, the lyric stage previewer and the bible-lookup body never appear.
- **The reset MUST blank `style.flexGrow` before re-rendering.** A drag writes
  `flexGrow` straight onto the pane without telling React
  (`FlexResizeActorComp.onMouseMove`), so re-rendering the same `flex` string
  React last rendered is a no-op and the dragged width survives. `ResizeActorComp`
  clears `:scope > [data-fs]` off its OWN container ref — **not** a document-wide
  `[data-fs^=name]` query, because two actors legitimately share one
  `flexSizeName` (`flex-size-background` nests one inside the other).
- **`clearWidgetSizeSetting()` is async and sweeps by prefix now**
  (`removeSettingsByPrefix('widget-size')`). The old name-list missed the
  `-dyn-h`/`-dyn-v` keys, every ad-hoc literal and every per-document key.
- **Dev-only CDP escape hatches** (the OS menu is invisible to CDP):
  `globalThis.getViewWidgetMenuItems()`, `tryToggleWidget(id)`,
  `tryResetWidgetsSize()`.

**Why:** the feature is spread over the electron menu, a renderer registry and
`ResizeActorComp`, and two of those pieces (the flexGrow blanking, the
container-scoped query) look like redundant defensiveness until they are removed.

**How to apply:** to add a View entry, extend the `view` bucket, never hard-code
it in `electronMenu.ts` — main has no `tran`, so a hard-coded label is English
forever. Widget names are the menu's labels and must be unique per page;
`checkAreNamesUnique` console-errors the offenders in dev. Related:
[[full-view-toggle-collapses-widget]], [[injected-app-document-file-param]],
[[tran-missing-key-throws-in-dev]].
