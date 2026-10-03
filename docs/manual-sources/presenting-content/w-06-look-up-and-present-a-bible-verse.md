---
id: W-06
title: "Look up and present a Bible verse"
section: "Presenting content"
verify: [NAV-06, NAV-07, RD-02, PM-12, PR-02, KB-01, KB-02, KB-06, KB-09, CB-61, CM-101]
screenshots: 5
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-02"
---
# W-06 — Look up and present a Bible verse

**Goal:** find a verse fast and put it on screen.

1. Press **Ctrl+B** (or click **[en:tran:Bible Lookup]** in the header). The
   lookup opens as a popup dialog. 📸
2. The input is a **step-by-step picker**. Click the empty box to see the book grid,
   then click the book, the chapter and the verse. These buttons use the names and
   numbers of the Bible version you chose, so this is the preferred route for a
   non-English Bible.
   > Tip: typing the first letters or a full reference such as `John 3:16` is a shortcut
   > when that Bible recognizes what you type. **Tab** completes the current part;
   > **Escape** clears it. The **Bible Reader** page works the same way.
3. The verse renders in the preview panel. To present it, point at the passage's
   title (_John 3:16_) — its buttons appear over the end of the title — and click
   **[en:tran:Save bible item and show on screen]** (the cast icon), or just press
   **Ctrl+Shift+Enter**. The passage is saved to the **Bibles** list as it goes up.
   Double-clicking a verse only brings it into view; it does not present. 📸
4. Close the dialog with the red ✕ button or **Ctrl+Q**.
5. Press **F9** ([en:tran:Clear Bible]) to take the verse off screen.
6. The presented verse also appears in the **Bibles** tab (middle column) and the
   **Bibles** list (right column) for re-presenting later.
7. In a hurry, ask the app instead: open the assistant (**🤖**, W-42) and type
   _Put John 3:16 on the screen_ — or the command **/verse John 3:16**, which
   needs no assistant. The passage goes up in the version the lookup is on, and
   the answer says what is on the screen now; it is not saved to the **Bibles**
   list. 📸

8. To make an editable slide document from a saved passage, open that item's
   **⋮** menu in the Presenter's **Bibles** list and choose
   **[en:tran:Generate Slides]**. In the floating panel, select any additional
   Bible versions to include. The original version stays selected. Enter an optional
   **[en:tran:Font Size]** in pixels, or leave it empty for **[en:tran:Auto]**.
   Choose **[en:tran:Dark]** or **[en:tran:Light]** under **[en:tran:Theme]** to set
   the generated slides' background and text colors. Both themes retain the
   translucent, inset background. 📸
9. Click **[en:tran:Generate Slides]** in the panel. The new document contains a
   title slide with the passage and Bible keys, then one slide per verse, with
   all selected versions together. Each version uses its own configured font.
   Compact margins leave room for the text; long verses resize to fit, with a
   consistent reading size throughout the passage, reducing your chosen size only
   when needed to fit. The upcoming verse appears
   at the bottom right in muted text at 85% of the current verse's font size.
   The last slide has no upcoming verse. 📸
10. Find the file in **Documents**. Its name uses the English reference and all
    selected keys, for example `Genesis 1 3-5 KJV-ពគប.ows` (the colon becomes a
    space for the filename). Generating again adds a numbered suffix to preserve
    the earlier file. **[en:tran:Cancel]** closes the panel without creating a
    file. If a selected version lacks a verse, generation reports it without
    saving a partial passage.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`NAV-06` · `NAV-07` · `RD-02` · `PM-12` · `PR-02` · `KB-01` · `KB-02` · `KB-06` · `KB-09` · `CB-61` · `CM-101`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-02).
:::
