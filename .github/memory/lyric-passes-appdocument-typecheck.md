---
name: lyric-passes-appdocument-typecheck
description: LyricAppDocument extends AppDocument, so checkIsThisType returns TRUE for a lyric — every "is this editable?" gate must also test isEditable
metadata:
  type: project
---

`AppDocument.checkIsThisType(x)` is `x instanceof this`
(`src/helper/AppEditableDocumentSourceAbs.ts:184`), and `LyricAppDocument extends
AppDocument` — so **a lyric passes the AppDocument type test**. The type test alone is
never enough to answer "may this be edited?"; `LyricAppDocument.isEditable = false` is the
real answer.

**Why:** `checkIsAppDocumentSelected` (`src/app-document-list/AppDocument.ts:528`) already
pairs the two and carries a comment saying so. `AppDocumentEditorComp.tsx` once checked
only the type — so loading `appDocumentEditor.html` **directly** with a lyric selected
skipped the "The selected document is not an Open Worship slide. Return to Presenter?"
confirm and left a dead editor reading `No slide selected`. Found live 2026-08-07 (robot
run 20260807-0741); FIXED: lines 33-35 now read
`AppDocument.checkIsThisType(selectedVaryAppDocument) && selectedVaryAppDocument.isEditable`,
with lines 26-31 a comment citing this exact trap. The reachable path was direct
navigation — including **app restart**, since `mainHtmlPath` persists the editor page.

**How to apply:**

- Any new gate of the form `AppDocument.checkIsThisType(doc)` must be
  `AppDocument.checkIsThisType(doc) && doc.isEditable` unless lyrics are genuinely welcome.
- The same trap once left `src/slide-editor/SlideEditorGroundComp.tsx` rendering a
  hardcoded English `No slide selected`; also fixed — line 12 is now
  `tran('No slide selected')` with the km key present.
- Grep for `checkIsThisType` before adding a subclass of an `AppDocument` variant.

Related: [[lyric-in-documents-list]], [[app-document-helpers-lyric-cycle]],
[[lyric-subsystem-architecture]].
