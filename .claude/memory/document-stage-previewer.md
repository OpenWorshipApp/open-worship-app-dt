---
name: document-stage-previewer
description: "Every non-song document has a Stage Previewer and honours a screen's St:, drawn at render time from the base slide (no per-stage slide data)"
metadata:
  node_type: memory
  type: project
  originSessionId: 90bec044-2730-4035-8c05-b8a837a6ecb3
  modified: 2026-10-09T03:04:16.979Z
---

Since 2026-10-06 a slide document, PDF, PowerPoint and Word file get the song's
Stage Previewer header (`DocumentStagePreviewerComp`, setting
`document-slides-previewer-stages`) and a screen's **St:** draws them at that
stage. Asked for by the user as a lead singer's stage monitor: _"stage 0 have to
be no change at all, stage 1 same stage 0 but has indexing"_. No gear, no style
panel, stages 0-5 only (6+ = stage 1), max six panes.

**Stage is a VIEW, unlike a song's.** A song's stage rewrites slide data
(`LyricAppDocumentStage0`…`Stage5`, [[lyric-subsystem-architecture]]); a document's slide
stays the base slide everywhere -- click, drag, highlight (`filePath` + `id`),
media, item transitions, on-screen map. The layout is composed when drawn:

- Table and pure math: `src/app-document-presenter/stage/documentStageHelpers.ts`
  (reuses the song geometry in the import-free `lyricLookAheadHelpers.ts`).
  `toStageDeck` walks slides as the arrow keys do (PPTX sub-slides inline,
  disabled skipped); the corner count skips the PDF/PPTX/DOCX blank slide 0.
- Previewer: `VarySlidesComp` builds the deck once into `SlideStageDeckContext`;
  `VarySlideRenderComp` reads it with `useSlideStageView` and passes it as PROPS
  to a lazy `StageLookAheadComp` -- the card body renders in a shadow root's own
  React root, which no context reaches.
- Projector: the PRESENTER works out `stageLookAhead` (count + slimmed side
  slides) in `applyVarySlideData` via `genStageLookAheadData`; the screen window
  keeps what the sync handed it, like `transitionEffect`. `render()` wraps the
  built content with `wrapWithStageLookAhead`. Stage 0 never opens the document.

Two layout rules asked for 2026-10-06, songs and documents alike: the coming
slides are NEVER dimmed (`genRowArrangement` sets `isDimmed: false`; only
`PREVIOUS_NEXT_ARRANGEMENT` never dimmed before), and the boxes sit flush in the
top left corner with no margin and NO gap between them (`GAP_RATIO = 0` in
`lyricLookAheadHelpers`, so a song's boxes touch too; the frames still mark
each box). On the projector a document's layout fills the
whole SCREEN (`genDocumentStageLayout` with the screen as the stage area;
`render()` then sizes the slide box to the screen at scale 1) -- arranging inside
the slide's own box fitted to a screen of another shape left bands above and
below. A song's slides are already the screen's size, so its look-ahead is laid
over the whole slide (`displayDim`) instead of inside `canvasItemBounds` -- the
Slide Padding stays inside each verse's own box.

Every slide on a counting stage carries its own count -- the coming ones too
(`StageLookAheadSideType.label`, worked out with the rest on the presenter;
data saved before it has none and still validates). The count is 8% of its own
box's height on a 50% dark pill, so a coming slide's is smaller in step.

**Why:** rewriting canvas slides per stage would break video wiring, item
transitions, camera and media control on stage screens, and a PDF/PPTX/DOCX
slide has no canvas to rewrite.

**Gotcha, fixed 2026-10-06:** `DocxSlide.tryValidate` ACCEPTS a PowerPoint
slide (the Word schema only requires `id`, `htmlFilePath`, `metadata`). A
"full-width page" check written as `PdfSlide || DocxSlide` made every PowerPoint
slide on a St: 2 screen draw plain while **Full Width** was on (user report, a
screenshot of the pane right and the screen wrong). Decide a slide's kind in
`render()`'s own Pdf -> Pptx -> Docx order, never by `DocxSlide.tryValidate`
alone. A stage screen now renders PDF/Word pages FITTED even under Full Width.

**How to apply:** a new stage layout goes in `DOCUMENT_STAGE_DEFINITIONS` and
works in both halves. Side boxes carry only text/html/image/bible
(`filterSideCanvasItems`); keep media out. The look-ahead is stale after an edit
until the next present or St: change, as a song's is. The header JSX is shared
with songs (`StagePreviewerHeaderComp`, `StagePreviewerComp.scss`).
A chip's × is **Hide Stage N**, never "Remove": it only takes the pane out of
the setting (Add Stage brings it back, a song's style kept per stage number),
and the agent firewall refuses any `remove` label, so the old wording let an
assistant add a pane it could not take away (2026-10-06; a test holds the label
against `DESTRUCTIVE_LABEL_PATTERNS`). In a narrow header the title gives way
first and Add Stage folds to its `+` (a container query), keeping every chip in
view; the chips' scrollbar stays hidden on purpose — shown, a sub-pixel overflow
drew both scrollbars on a row that fit.
