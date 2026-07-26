---
name: dev-hmr-stale-state-qa
description: A dev-server HMR reload silently kills keyboard layers and unmounts open overlays — re-verify after a full reload before calling it a regression
metadata:
  type: feedback
---

When verifying a change against the running dev app via chrome-devtools, a Vite
HMR full reload (triggered by the file edits under review) leaves the page in a
state where **keyboard shortcuts stop firing entirely and any open overlay has
silently unmounted** — `#presenting-control` disappears, and every
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

**How to apply:** before diagnosing a "shortcut is dead" symptom, check
`performance.getEntriesByType('navigation')` / `performance.now()` for a recent
reload. If one happened, `navigate_page` reload and re-run the whole
open-then-drive sequence in ONE `evaluate_script` call. Related:
[[screen-draw-feature]], [[eventhandler-sync-dispatch]].
