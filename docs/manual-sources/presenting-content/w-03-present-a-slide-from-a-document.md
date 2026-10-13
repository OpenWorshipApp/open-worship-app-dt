---
id: W-03
title: "Present a slide from a document"
section: "Presenting content"
verify: [PL-01, PM-05, PM-06, PM-07, PM-08, PM-09, PM-54, PM-149, PM-157, ED-17, ED-39, KB-05, KB-08]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-13"
---
# W-03 — Present a slide from a document

**Goal:** put a slide on the screen.
**Preconditions:** at least one document in the **[en:tran:Documents]** list.

1. In the left column, click a document in the **[en:tran:Documents]** list. It
   highlights, and its slides appear as thumbnails in the middle **[en:tran:Documents]** tab. 📸
2. **Click** a slide thumbnail. The slide goes live: it appears on the mini
   screen, and the live item is marked highlighted (on-screen indicator). 📸
3. To step through slides with the keyboard, click once in the thumbnail area, then use
   **Arrow keys / PageUp / PageDown**; **Space** advances and **Shift+Space** goes back.
   The preview scrolls smoothly to the selected slide, including after several quick
   Next presses or wrapping from the last slide to the first.
4. To remove the slide from the screen, press **F8** ([en:tran:Clear Slide]) or click
   the matching clear button (`SL`) in the mini screen's header.
   **The first card of a PowerPoint, PDF or Word document is blank, on purpose.** It is
   not a page of your document and takes no number: your own page 1 is the card after it,
   so a five-slide PowerPoint shows six cards. Presenting the blank card puts a blank
   slide on the screen.
   **What the projector shows is what the editor holds, saved or not.** A document you
   have changed and not saved carries a red `*` after its name, and the Presenter and the
   screen show it WITH those changes — the editor keeps your unsaved work on disk. To go
   back to the saved version press **[en:tran:Discard changed]** in the editor's row of
   buttons (it asks first, and it empties Undo as well), then present the slide again.
5. **Show the person on the stage what comes next.** A screen's **St:** number (the badge at
   the right of its mini screen's footer) decides how a slide is drawn on it, for every kind
   of document — a slide document, a PDF, a PowerPoint or a Word file — just as it does for a
   song (W-05):
   - **[en:tran:Stage] 0** — the slide exactly as it is.
   - **[en:tran:Stage] 1** — the slide, with its place in the document in the bottom-right corner
     (`3/12`, or `Welcome · 3/12` when the slide has a name).
   - **[en:tran:Stage] 2** — the slide at the top, the **next** slide smaller under it — at full
     brightness, not faded — and the count. The pair grows to fill the screen's height
     whatever shape the slides are, flush with its top left corner, no margin, and the
     slides touch — no gap between them, only each one's frame.
   - **[en:tran:Stage] 3** — the same with the next **two** slides.
   - **[en:tran:Stage] 4** — the next slide under it, without the count.
   - **[en:tran:Stage] 5** — the **previous** slide top left, the slide, and the **next** slide bottom
     right.

   As on a song's stages (W-05), the slides around the current one are never faded.
   On every stage that shows a count, **each** slide on the screen carries its own — the
   coming ones too (`2/7`, `3/7`) — in a large figure on a half-transparent dark pill.

   Set a stage monitor's **St:** to **2** and the singer always sees what is coming.
   Moving a screen to any stage above 0 also sets its **[en:tran:Slide]:** transition to **none**
   (W-10). To see
   it here first, click **[en:tran:Add Stage]** in the **[en:tran:Stage Previewer]** header
   above the slides and pick a stage: it arrives as its own chip and its own pane, side by
   side with **[en:tran:Stage] 0**, which always stays. The **×** on a chip
   (**[en:tran:Hide Stage] 2**) takes that pane away again, and **[en:tran:Add Stage]**
   brings it straight back. In a narrow pane — beside the Bibles tab, say — the header's
   title gives way first and **[en:tran:Add Stage]** folds to its **+**, so every chip stays
   in view. There is nothing to set on a document's stage — unlike a song's, its chips have no
   ⚙. Clicking a slide in any pane presents the same slide; each screen draws it at its own
   **St:**. 📸

Tips:

- The slider in the Documents-tab footer resizes the thumbnails.
- The stopwatch icon at the bottom left of the slide list — there once a slide is live —
  opens **auto-play**: set seconds, press play, and slides advance automatically; the
  red ✕ closes it (W-04).
- **Pin the document so you cannot lose it by a stray click** — see W-27.
- **Notes for yourself:** under the slide previews there is a thin green **[en:tran:Note]**
  strip. Click it and a **[en:tran:Document Note]** box (one for the whole document) and a
  **[en:tran:Slide Note]** box (one per slide) open below the slides. They are saved for you as
  you type and are **never sent to an audience screen**. The panel starts closed, so
  it costs nothing until you want it; to put it away again drag the divider above it
  down to the bottom edge, or untick **View → Widgets → Note** (W-31).
- **A slide that is the wrong shape for the screen.** A slide document keeps its own
  width and height, and one made for another display does not match yours. While a slide
  and the display differ, an amber button with a hammer — **[en:tran:Fix slide dimension]**,
  the sizes in its tooltip — shows in the row of buttons at the top of the slides, here
  and in the Slide Editor: press it and the slides that differ take the display's size,
  and the button goes away. One slide at a time is the Slide Editor's **Width** and
  **Height** boxes, with **[en:tran:Apply All Slides]** for the whole document.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-01` · `PM-05` · `PM-06` · `PM-07` · `PM-08` · `PM-09` · `PM-54` · `PM-149` · `PM-157` · `ED-17` · `ED-39` · `KB-05` · `KB-08`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-13).
:::
