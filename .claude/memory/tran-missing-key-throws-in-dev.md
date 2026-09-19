---
name: tran-missing-key-throws-in-dev
description: A missing km translation key THROWS in dev (blanks the page); `tranKeyCoverage.test.ts` catches static keys since 2026-09-18, dynamic tran(prop) sites still need a live Khmer pass
metadata: 
  node_type: memory
  type: project
  originSessionId: 65d709fb-f37b-4655-a432-072843474442
  modified: 2026-09-18T23:47:56.524Z
---

`tran()` in `src/lang/langHelpers.ts` throws `Translation for text "X" not
found in locale km-KH` when `appProvider.systemUtils.isDev` — it does NOT fall
back to English. A single missing key blanks whatever subtree renders it (React
error, no boundary). Production silently falls back to the English string.

**Why:** it makes missing-key bugs invisible in English (the default locale
returns early before any lookup) and fatal in Khmer. Until 2026-09-18 a
lint/typecheck/test pass proved nothing about translation coverage.

**Now the gate catches the STATIC half** (`EN-20`):
`src/lang/tranKeyCoverage.test.ts` (in `test:all`, so in `npm run lint`) fails
naming any key the `km` dictionary lacks — a literal, a `+` chain (read as ONE
key), or a string constant. It found 5 keys on failure paths that had no Khmer
at all. It reads the dictionary as SOURCE and evaluates the object literal, so
unquoted identifier keys count and it has none of the false positives below.
A new label in `src/` fails the gate until its Khmer string is added. Keep new
keys statically readable — a literal per branch (`genCollapseTitle` in
`FlexResizeActorComp.tsx`), not a key looked up from a table — or the test
cannot see them.

**How to apply:** the test cannot read what is built at runtime. Two classes
still need the live Khmer pass:

- **Concatenation with a variable** — `tran('a ' + b)`. (Pure literal chains
  `tran('a ' + 'b')` are ONE key at runtime; the test merges them, and an ad-hoc
  grep must too or it reports false misses.)
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

**The dictionary side has its own grep trap: keys that are valid JS identifiers
are written UNQUOTED** — `Stage: 'ស្ទែជ'`, `Seconds: 'វិនាទី'` — while only
multi-word keys carry quotes (`'Change Seconds':`). A sweep matching just
`/^\s*'([^']*)'\s*:/gm` sees none of the single-word keys and reports every one of
them as missing. Match both shapes:
`/^\s*(?:'([^']*)'|([A-Za-z_$][\w$]*))\s*:/gm`. (2026-08-07: this produced two
would-be **Critical** false positives — `tran('Stage')` and `tran('Seconds')` —
that the live app rendered perfectly.) **Never file a missing-key finding from a
static sweep alone; confirm the actual console throw with the app running in
Khmer.**

Separately: ~66 user-facing strings never reached `tran()` at all (hardcoded
`title=`/`aria-label=`/`placeholder=` JSX literals, plus wrappers like
`SlideEditorToolTitleComp` and `RenderCardComp` that render `title` raw). Those
stay English in Khmer mode and are a pre-existing gap, not a dictionary problem
— and the test above cannot see them, because they never call `tran()`.
2026-09-18 (`EN-21`) routed the 13 a volunteer meets most: the Reader's lookup
history chip, verse numbers, Tab hint, split button, the divider arrows (now
*Collapse … panel*), the Mini Screen card, the background icons and the Bible
Note footer. `triage.mjs --area=ui` lists the literal ones left. The four
English titles of the static `receiveSyncScreen` receivers are deliberate: they
also run in the screen window, where a `tran()` before its language data loads
throws in dev (same reason as `ScreenCloseButtonComp`).
