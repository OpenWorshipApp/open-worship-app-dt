---
name: tran-missing-key-throws-in-dev
description: A missing km translation key THROWS in dev (blanks the page); dynamic tran(prop) sites are invisible to literal grepping
metadata: 
  node_type: memory
  type: project
  originSessionId: 65d709fb-f37b-4655-a432-072843474442
  modified: 2026-08-03T16:43:42.430Z
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

**`tran()` at MODULE SCOPE throws even when the key exists.** It is synchronous
and reads an already-populated `langCache`; module evaluation happens long before
`getLangDataAsync` fills it, so the call throws
`Language data for locale km-KH not found when translating text` and blanks the
page. Note the different wording — *"Language data … not found"* means "called too
early", *"Translation for text … not found"* means "key missing"; they need
different fixes. Hit 2026-08-03 by adding `tran()` to a module-scope
`const dataInput = [...]` in `BibleReaderComp.tsx`; fixed by building it per
render (`genDataInput()` + `useMemo`). So only call `tran()` inside a component
body / event handler / render function — never in a module-level const.
(2026-08-03: every static `widgetName:` is now `tran()`'d — the two module-scope
arrays, `BibleReaderComp` and `BibleReadingLeftComp`, were converted to
per-render `genDataInput()`. Only the dynamic ones — file/slide names in
`PresenterNoteContainerHandlerComp` / `CanvasNoteContainerHandlerComp` — stay
raw, which is what `RenderHiddenWidgetTitleComp`'s comment refers to.)

Verify by switching Settings → Language → Khmer → Apply (reloads all windows)
and walking the changed screens — **an added `tran()` is not verified until the
page has been seen rendering in Khmer**; typecheck, eslint and the vitest suite
all stay green through both failure modes above. Unsaved editor state survives the
reload — it lives in `<file>.histories/<n>-head` on disk (`EditingHistoryManager`).

Keys are matched after `trim().toLowerCase()` (`sanitizeTranKey`), and the km
module **throws at load on duplicates after sanitization** — so check for a
case/whitespace variant before adding a key.

Separately: ~66 user-facing strings never reach `tran()` at all (hardcoded
`title=`/`aria-label=`/`placeholder=` JSX literals, plus wrappers like
`SlideEditorToolTitleComp` and `RenderCardComp` that render `title` raw). Those
stay English in Khmer mode and are a pre-existing gap, not a dictionary problem.
