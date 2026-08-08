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

**Why:** `checkIsAppDocumentSelected` (`src/app-document-list/AppDocument.ts:527`) already
pairs the two and carries a comment saying so, but `AppDocumentEditorComp.tsx:29` checks
only the type — so loading `appDocumentEditor.html` **directly** with a lyric selected skips
the "The selected document is not an Open Worship slide. Return to Presenter?" confirm and
leaves a dead editor reading `No slide selected`. Found live 2026-08-07 (robot run
20260807-0741); the header `Slide Editor` tab is guarded correctly, so the reachable path is
direct navigation — which includes **app restart**, since `mainHtmlPath` persists the editor
page.

**How to apply:**

- Any new gate of the form `AppDocument.checkIsThisType(doc)` must be
  `AppDocument.checkIsThisType(doc) && doc.isEditable` unless lyrics are genuinely welcome.
- The same trap is why `src/slide-editor/SlideEditorGroundComp.tsx` renders a bare
  `No slide selected` — a hardcoded English string, so the dead state is untranslated too.
- Grep for `checkIsThisType` before adding a subclass of an `AppDocument` variant.

Related: [[lyric-in-documents-list]], [[app-document-helpers-lyric-cycle]],
[[lyric-subsystem-architecture]].
