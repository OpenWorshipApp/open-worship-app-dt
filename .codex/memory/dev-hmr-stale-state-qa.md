---
name: dev-hmr-stale-state-qa
description: A dev-server HMR reload silently kills keyboard layers and unmounts open overlays, can blank the page on an import cycle, and Vite can serve the save before the last one — re-verify after a full reload (and curl the served module) before calling it a regression
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78a2ea9b-7bf1-4112-a236-0d3119ccf1c3
  modified: 2026-10-12T01:26:30.549Z
---

When verifying a change against the running dev app via the `owa-devtools` MCP,
a Vite HMR full reload (triggered by the file edits under review) leaves the
page in a state where **keyboard shortcuts stop firing entirely and any open
overlay has silently unmounted** — `#presenting-control` disappears, and every
`KeyboardEventListener` layer binding goes dead even though `document.onkeydown`
is still installed and still runs. It looks exactly like the change under review
broke the keyboard.

**Why:** the reload resets React state (so `isControlling` is false again) and
the app lands in the degraded HMR state CLAUDE.md documents for shadow-root
previews (console shows `useScreenManager must be used within a ... Provider`
and `No VaryAppDocumentContext found`). Introspecting the module via
`import('/src/event/KeyboardEventListener.ts')` from the page does NOT help —
Vite hands back a *different* module instance with an empty listener map and
`_layers: ['root']`, which reads as false evidence that the layer was never
claimed.

**Any write counts, not only the edit under review** (2026-10-01): a
`prettier --write` over five files the Reader imports raised, in the same
second, `useBibleItemViewControllerUpdateEvent must be used within a
BibleItemViewControllerContext` from `<BibleItemRenderComp>`, the _Reload is
needed_ path and a page reload — a context module replaced mid-render. Before
filing a "must be used within" error, compare its time with `date -r` on the
files written around it (the app's `error-datetime-setting` holds the epoch).

**Two more shapes of the same thing** (2026-10-11, adding a Bible Properties
font row):

- **A blank presenter with nothing in the console.** Edits to modules under
  `src/_screen/` left the page black; `owa_app_state` answered _Cannot access
  'SCREEN_BIBLE_SETTING_PREFIX' before initialization_ and `owa_list_ui` zero
  controls. `ScreenBibleManager` and `screenBibleHelpers` import each other, and
  a hot re-evaluation enters that cycle from the other side. A `navigate_page`
  reload loaded clean — it was never the edit.
- **Vite serving the save BEFORE the last one.** Two edits to one file a few
  milliseconds apart (two `Edit` calls in one batch): the dev server kept the
  transform of the first, so half of a change was live and half was not (a
  verse took the new inline style, its heading the old one), through a page
  reload. Compare what is served with what is on disk —
  `curl -sk https://localhost:3000/src/<path> | grep <new name>` — and `touch`
  the file when they differ. Do this before reasoning about why half a change
  "does not work".

**How to apply:** before diagnosing a "shortcut is dead" symptom, check
`performance.getEntriesByType('navigation')` / `performance.now()` for a recent
reload. If one happened, `navigate_page` reload and re-run the whole
open-then-drive sequence in ONE `evaluate_script` call (that tool is refused
unless the MCP server was started with `OWA_MCP_FIREWALL=off`). Related:
[[screen-draw-feature]].
