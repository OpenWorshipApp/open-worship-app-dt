---
name: tran-missing-key-throws-in-dev
description: A missing km translation key THROWS in dev (blanks the page); dynamic tran(prop) sites are invisible to literal grepping
metadata:
  type: project
---

`tran()` in `src/lang/langHelpers.ts` throws `Translation for text "X" not
found in locale km-KH` when `appProvider.systemUtils.isDev` — it does NOT fall
back to English. A single missing key blanks whatever subtree renders it (React
error, no boundary). Production silently falls back to the English string.

**Why:** it makes missing-key bugs invisible in English (the default locale
returns early before any lookup) and fatal in Khmer — so a lint/typecheck/test
pass proves nothing about translation coverage.

**How to apply:** when auditing coverage, grepping `tran('literal')` is not
enough. Two classes are invisible to it:

- **Concatenation** — `tran('a ' + 'b')` is ONE key at runtime. Merge adjacent
  literals joined by `+` or you get false misses.
- **Dynamic** `tran(prop)` — e.g. `PositionSizeFieldComp` (`BoxPositionSizeComp.tsx`)
  called `tran(name)` fed by `name="X:"`. Found only by running the app in
  Khmer. Sweep these by finding components that call `tran(<destructured prop>)`
  then collecting literals from `<Comp prop="…">` usages repo-wide.

Verify by switching Settings → Language → Khmer → Apply (reloads all windows)
and walking the changed screens. Unsaved editor state survives the reload —
it lives in `<file>.histories/<n>-head` on disk (`EditingHistoryManager`).

Separately: ~66 user-facing strings never reach `tran()` at all (hardcoded
`title=`/`aria-label=`/`placeholder=` JSX literals, plus wrappers like
`SlideEditorToolTitleComp` and `RenderCardComp` that render `title` raw). Those
stay English in Khmer mode and are a pre-existing gap, not a dictionary problem.
