---
name: useappcurrentref-race-guard
description: "Second use of useAppCurrentRef: a post-await staleness oracle — compare the closed-over prop to ref.current and bail (or re-run) on mismatch; do NOT delete these refs as redundant"
metadata:
  node_type: memory
  type: project
  modified: 2026-08-30T00:00:00.000Z
---

CLAUDE.md documents `useAppCurrentRef` only as the callback-identity codemod.
Since `c68236c4` ("handle all racing value", 2026-08-15) it has a second,
semantically different job that looks identical in a diff: a **staleness
oracle** for state set after an `await`.

**The shape** (six sites in one sweep):

1. A handler closes over a prop (`note`, `noteItem`, `tab.key`,
   `{slide, width, height}`, `selectedVaryAppDocument`).
2. It `await`s something slow (`note.reload()`, `checkIsOnScreen()`,
   `checkIsDiffOtherSlides()`, `getSlides()`).
3. Before `setState`, it compares the **closed-over value** against a
   `useAppCurrentRef` of the **same value**. They differ only if the component
   was re-fed mid-await.
4. On mismatch it **returns without setting state** — the re-feed already
   re-ran the guarded read.

Exemplars: `src/bible-list/note/NoteEditorComp.tsx` (two copies; the failure
it prevents is data loss — the stale apply would land under the new item's
heading and the unmount `save()` would write it back there),
`src/others/TabRenderComp.tsx` (`tabKeyRef` — "the new tab's dot lights from
the old tab's answer"), `src/slide-editor/canvas/tools/SlidePropertyEditorComp.tsx`
(a composite subject `{slide, width, height}` in ONE ref, not three), plus
`src/_screen/screenHelpers.ts`, `src/bible-list/bibleHelpers.ts`,
`src/presenting-flow/PresentingFlowDocumentSlidesComp.tsx`,
`src/slide-editor/note/*`.

**The variant — re-run instead of drop:**
`src/app-document-presenter/items/VarySlidesComp.tsx` (`4ce1a7ad`) re-calls
`refresh()` on mismatch because there the NEWER document still needs slides.
Decision rule: drop when the re-feed itself re-runs the read; re-run when the
result is still owed to the new subject.

**Why this memory exists:** a reviewer applying only the CLAUDE.md framing
would read these refs as redundant ("the value is already in scope") and
delete them, reintroducing the race. **How to apply:** treat any
`useAppCurrentRef` whose `.current` is compared to a closed-over value after
an `await` as a race guard, not clutter. Trap: declare the ref ABOVE the
`useCallback` that reads it — `4ce1a7ad` had to move one (TDZ-style ordering
hazard). Related: [[foreground-sync-shared-refs]].
