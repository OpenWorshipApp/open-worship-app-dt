---
name: cdp-dynamic-import-hijack
description: Never `import()` an app module inside chrome-devtools evaluate_script — it re-runs module side effects and hijacks the app's global handlers
metadata:
  type: feedback
---

Do NOT use `await import('/src/…')` inside `mcp__chrome-devtools__evaluate_script`
to inspect app module state (layer stacks, managers, singletons). The devtools
evaluation world has its own module map, so the file is **re-executed** as a
second instance: its module-level side effects run again and clobber the app's.

Concretely, `src/event/KeyboardEventListener.ts` ends with
`document.onkeydown = …` (a property assignment, not `addEventListener`). A probe
import silently repointed that handler at a fresh instance with no registered
listeners and an empty `_layers`, so **every keyboard shortcut in the running app
died** — and it looked exactly like the bug under investigation. Only a full page
reload recovers.

**Why:** the reading is fabricated (fresh instance state, always defaults) and the
damage is invisible until keys stop working, so it wastes a long debugging loop
chasing a regression that never existed.

**How to apply:** probe app state through the DOM (`data-react-comp-name`, class
names, `aria-pressed`, disabled buttons) or by walking React fibers off a DOM node
(`__reactFiber$…` → `memoizedProps`), never by importing modules. Verify keyboard
behavior by observable app effects instead — e.g. a key registered only on one
keyboard layer either acts or does not. Related: [[dev-hmr-stale-state-qa]].
