---
id: W-22i
title: "Send a line to one particular screen, or park a line"
section: "Configuration"
verify: []
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-14"
---
# W-22i — Send a line to one particular screen, or park a line

**Goal:** a lyric that always goes to the stage screen without being dragged there, and a
line you cannot fire by accident.

1. **Send a line to one particular screen, every time.** If a lyric always belongs on the
   stage screen and the sermon slides on the main one, you do not have to drag them there
   over and over. Right-click the line → **[en:tran:Set Specific Screen]** and
   tick the screens it should go to — `Screen id: 0`, `Screen id: 1`, … The menu stays open
   so you can tick more than one, and the line then shows a small 📌 with those numbers —
   **each number in its own screen's colour**, the very colour that screen's mini-screen
   badge wears, so you can tell at a glance where a line goes without reading the digit.
   (The tick boxes in the menu are tinted the same way.) 📸
   From then on **clicking that line ignores which mini screens are selected**
   and goes straight to its own; so do the arrow/Space keys in the preview panel. Untick
   them, or choose **[en:tran:No Specific Screen]**, to hand it back to the
   normal behaviour.

   Two things deliberately still override a pin, so you are never stuck: **dragging** the
   line onto a mini screen puts it on _that_ screen just this once, and right-click →
   **[en:tran:Show on Screens]** still asks which screen you mean. If the pinned screen has been
   closed, nothing is projected anywhere and the app tells you so ("Please make sure the
   screen is open") rather than quietly using a different screen.
2. A **document** line can be pinned too — its slides then all follow it — and you can pin
   **one slide on its own**: open the document's arrow, right-click the slide and set its
   screen. That slide overrides the document; its neighbours keep following the document.
   A slide pinned in its own right shows the 📌 on its own line **and in the bottom-right
   corner of its thumbnail in the preview panel**, so a run sheet you are reading as
   pictures still tells you which slide breaks away from its document. Clearing it hands
   that slide back to the document rather than pinning it to nothing. The same right-click
   is on the slide thumbnails inside the preview panel.
3. **Park a line you do not want touched.** A line you might click by accident — an
   alternate verse, last week's notice, a song you may or may not reach — can be taken out
   of the running order without deleting it: right-click it → **[en:tran:Disable]**. The line dims, is written in italics, is **crossed out** and gains a small
   amber 🚫 at its right end, and from then on **clicking it does nothing at all** — nothing
   is projected, and a document line does not even open. Dragging it onto a mini screen puts nothing there,
   and the arrow/Space keys in the preview panel step straight past it. Right-click →
   **[en:tran:Enable]** puts it back. (While a line is parked its menu drops
   **[en:tran:Show on Screens]** — an entry that could no longer do anything — but everything else
   stays, so you can still recolour it, move it, or turn it back on.) 📸
   You can park **one slide of a document** the same way: open the document's arrow and
   right-click the slide. Park the **document itself** and every slide under it is parked
   with it. A parked line can still be dragged up and down to tidy your running order, and
   parking is remembered in that presenting flow only — the same song stays live in your other
   services.
4. **Two kinds of greyed-out line, and they now look different.** A line YOU parked here is
   crossed out and carries the amber 🚫 ("This item is disabled in this presenting flow"). A slide
   that is greyed out because the **document itself** hides it is _not_ crossed out and
   carries a plain grey 👁‍🗨 ("This item is disabled in its document") — right-clicking that
   one will not bring it back, because a running order cannot re-enable what the document
   turned off; open the document and enable the slide there. In the preview panel the same
   two marks sit in the **bottom-left corner** of each dimmed thumbnail. 📸
