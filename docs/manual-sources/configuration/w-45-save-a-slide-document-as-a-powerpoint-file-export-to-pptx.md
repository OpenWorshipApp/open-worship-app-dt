---
id: W-45
title: "Save a slide document as a PowerPoint file (Export to PPTX)"
section: "Configuration"
verify: [PL-106]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-23"
---
# W-45 — Save a slide document as a PowerPoint file (Export to PPTX)

For when a slide document has to be shown or edited where this app is not — a guest
speaker's laptop, a church that uses PowerPoint, Google Slides or Keynote. Unlike
**Export** (W-23), which carries the document to another Open Worship app, this makes a
PowerPoint file anyone can open.

1. In the **Documents** list, right-click an Open Worship slide document (or press the
   **⋮** at the end of its row) and choose **[en:tran:Export to PPTX]**. It sits just
   under **[en:tran:Export]**. 📸
2. For a lyric, select its row so the **[en:tran:Stage Previewer]** opens. Add or remove
   stages until the layouts you want are visible, then press the **⋮** in the Stage
   Previewer header and choose **[en:tran:Export to PPTX]**. The app writes one deck per
   visible stage: `<song> - Stage 0.pptx`, `<song> - Stage 1.pptx`, and so on. Each deck
   uses that stage's own lyric layout and style. 📸
3. A message **[en:tran:Export to PPTX]** appears saying **[en:tran:Exported to]** and
   where: a `<name>.pptx` in your **Downloads** folder, which opens with the file in it.
   A lyric batch opens the Downloads folder once; exporting again adds numbered copies
   beside the earlier decks. 📸
4. Open it in PowerPoint. Each slide looks the way the screen shows it:
   - the words stay words you can change, broken into lines exactly where the app breaks
     them, in the same font — and where that font has no letter for part of the text (the
     English inside a Khmer title), in the font the app used for it instead;
   - text boxes keep their colour, see-through fill and rounded corners, and a box that
     blurs what is behind it carries that blur as a picture underneath it;
   - pictures keep their place and size; a video becomes its first frame and a website
     box its picture of the page;
   - behind each slide is the background the screen would be showing: the slide's own,
     else the document's, else the one the slide before it left up — so the slides that
     follow a video background keep it, as they do when you present them in order. 📸
5. Anything you wrote in a slide's **Slide Note** is in that slide's **Notes** in
   PowerPoint, and a slide you disabled comes out as a **hidden** slide, skipped when the
   show runs.

> Notes: a slide document exports from its row menu; a lyric exports from the Stage
> Previewer header because each visible stage is a separate rendered layout. A PDF,
> PowerPoint or Word file in the list already is its own file. The
> file is a copy: changing it changes nothing in the app. A YouTube box becomes the
> video's picture when the computer is online; a camera box, a camera background and a
> live web page as a background cannot be exported, the same as printing leaves them out.
> PowerPoint on another computer uses the fonts THAT computer has, so for the same look
> there install the same fonts (the lines break in the same places either way).

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-106`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-23).
:::
