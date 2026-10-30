---
id: W-06
title: "Look up and present a Bible verse"
section: "Presenting content"
verify: [NAV-06, NAV-07, RD-02, PM-12, PR-02, KB-01, KB-02, KB-06, KB-09, SC-03, SP-33, SP-34, CB-61, CB-131, CM-101]
screenshots: 5
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-29"
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
   > **Escape** clears it. The **[en:tran:Bible Reader]** page works the same way.
3. The verse renders in the preview panel. To present it, point at the passage's
   title (_John 3:16_) — its buttons appear over the end of the title — and click
   **[en:tran:Save bible item and show on screen]** (the cast icon), or just press
   **Ctrl+Shift+Enter**. The passage is saved to the **[en:tran:Bibles]** list as it goes up.
   To keep a passage without putting it on the screen, click **[en:tran:Save bible item]**
   (the floppy disk) beside it instead: it goes to the **[en:tran:Bibles]** list only. The
   Bible Reader's lookup has the same button.
   Double-clicking a verse only brings it into view; it does not present. 📸
4. The dialog closes by itself once the passage is saved, unless _[en:tran:Keep Open]_
   is ticked; to close it yourself use the red ✕ button or **Ctrl+Q**.
5. Press **F9** ([en:tran:Clear Long Text]) to take the verse off screen.
6. The presented verse also appears in the **[en:tran:Bibles]** tab (middle column) and the
   **[en:tran:Bibles]** list (right column) for re-presenting later.
   **More than one verse.** In the grid of verse numbers, click the first verse and then
   **Shift**-click the last one (or press on the first and drag to the last);
   **[en:tran:Show all verses]**, at the end of the grid, takes the whole chapter. Typed into
   the **[en:tran:Bible Reference]** box it is `John 3:16-18`.
   **A passage across chapters.** Type it the way you would say it —
   `John 1:50-6:3`, `John 1-3`, `John 3:16-4:2` — and present it as above. The
   projector shows the first three chapters, each starting with its chapter
   number on a thin rule. On the mini screen card the passage ends with **...**
   (**[en:tran:Show the next chapter]**): each press puts one more chapter on the
   projector. The projector itself never shows the **...**. From the projector
   window, **Ctrl+→** steps to the verse just after the passage (John 6:4) and
   **Ctrl+←** to the verse just before it (John 1:49).
   **The next verses, from the projector window.** Click the projector window itself and
   press **Ctrl+→** (or **Alt+→**): the screen moves on by as many verses as it is showing —
   John 3:16 becomes 3:17, John 3:16-18 becomes 3:19-21 — into the next chapter when the
   chapter ends, and **Ctrl+←** goes back. It only works while the main window is on the
   Presenter: from the Bible Reader, press **[en:tran:Go Back to Presenter]** first. Nothing
   on the mini screen card steps the verse; from the Presenter itself, present the next
   passage the same way you presented this one.
   **Another version on the screen.** If no passage is on the screen yet, press **Ctrl+B**,
   choose the book, chapter and verse, then press **Ctrl+Shift+Enter** to present it.
   On the mini screen card, each column of the passage
   begins with the short name of its version (`KJV`, say). Click that name and a list of
   versions opens. A plain click on one **changes** that column to it — it adds nothing.
   To put a second version **beside** the first, hold **Shift** while you click it
   (the list says **[en:tran:Shift Click to Add]** at its top). With two
   or more versions showing, the same list has a red row that takes that column away.
7. In a hurry, ask the app instead: open the assistant (**🤖**, W-42) and type
   _Put John 3:16 on the screen_ — or the command **/verse John 3:16**, which
   needs no assistant. The passage goes up in the version the lookup is on, and
   the answer says what is on the screen now; it is not saved to the **[en:tran:Bibles]**
   list. 📸

8. To make an editable slide document from a saved passage, first save one if needed:
   press **Ctrl+B**, choose the book, chapter and verse, then point at the passage's title
   to reveal its buttons and click **[en:tran:Save bible item]** (the floppy disk).
   Open that item's
   **⋮** menu in the Presenter's **[en:tran:Bibles]** list (the right column) and choose
   **[en:tran:Generate Slides]**. In the floating panel, tick every other Bible version
   you want on the same slides — one document holds them all, so this is done once, not
   once for each version. The original version stays selected. Enter an optional
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
10. Find the file in **[en:tran:Documents]**. Its name uses the English reference and all
    selected keys, for example `Genesis 1 3-5 KJV-ពគប.ows` (the colon becomes a
    space for the filename). Generating again adds a numbered suffix to preserve
    the earlier file. **[en:tran:Cancel]** closes the panel without creating a
    file. If a selected version lacks a verse, generation reports it without
    saving a partial passage.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`NAV-06` · `NAV-07` · `RD-02` · `PM-12` · `PR-02` · `KB-01` · `KB-02` · `KB-06` · `KB-09` · `SC-03` · `SP-33` · `SP-34` · `CB-61` · `CB-131` · `CM-101`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-29).
:::
