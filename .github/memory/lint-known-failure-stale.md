---
name: lint-known-failure-stale
description: CLAUDE.md's "known pre-existing lint failure" (ElectronMainController icon.png) is fixed; the real breakage as of 2026-07-25 was electronMenu.test.ts
metadata:
  type: project
---

CLAUDE.md's "Known pre-existing lint failure" section is out of date. As of
2026-07-25 `electron/ElectronMainController.test.ts` passes — the `icon.png` vs
`icon-dev.png` assertion no longer fails, so `npm run lint` does NOT abort there.

The failure actually present in the working tree was
`electron/electronMenu.test.ts`, caused by the uncommitted rewrite of
`electron/electronMenu.ts` (custom tool items moved from an `initMenu(controller,
{menusData, clickMenu})` argument to a keyed registry: `setCustomMenusData(key,
{menusData, clickMenu})` then `initMenu(controller)`). Fixed by updating the test
to the new API.

**Why:** trusting the stale note wastes a debugging cycle — you skip `test:all`
expecting it to abort, or you blame your own change for a failure the note said
was pre-existing (or vice versa).

**How to apply:** run `npm run lint` normally; if it stops, read the actual
failing test rather than assuming it is the documented one. Re-verify (and
ideally correct) the CLAUDE.md section when touching electron menu code. Related:
[[eventhandler-sync-dispatch]].
