---
id: W-46
title: "Learn the page with Tips of the Day"
section: "Configuration"
verify: [GL-25]
screenshots: 0
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-26"
---
# W-46 — Learn the page with Tips of the Day

**Goal:** learn the Presenter or Bible Reader at your own pace and see the exact
control without having to search the manual.

1. Five minutes after the app starts, the Presenter or Bible Reader page in
   front shows one **Tip of the Day** in the top-right corner — never at launch,
   when it would cover the controls you reach for while opening the service.
   Reloading or switching between Presenter and Reader does not restart those
   five minutes. The card stays there until you choose an action. The tip
   belongs to that page only, and the first tip is chosen at random without
   repeating the last automatic tip shown for that page. **Help → Tips of the
   Day** opens one at once, and a tip opened that way stands in for that
   launch's automatic card.
2. Click **Next tip** to move through that page's tips in order. The list wraps to
   the first tip after the last. Click **All tips** to open the numbered learning
   list for the current page. Search by a control or task, or scan the topic badges;
   the counter shows how many lessons match. Each lesson says what it teaches;
   choose one to return to its card and practise it at your own pace. The
   Presenter has **61 topics**: 51 start with a safe **Do it** for a visible
   control or shortcut, while ten native-menu lessons stay self-guided. They
   cover documents and slides, audience screens, backgrounds and media, service
   planning, app help, and every native application menu from **File** through
   **Help**. The Reader has **54 topics**. They cover reference entry and
   history, reading panes and formatting, Find and cross references,
   people/places and connection graphs, Resources, verse marks and notes,
   presenting a verse, the Reader header, every native application menu, and
   detailed lessons for every command under **View**. The **×** closes the card
   for now; reloading or moving between
   Presenter and Reader does not show a second automatic card in the same app
   launch.
3. Click **Show it** to start a numbered card in the current page, with the control
   ringed in red. This uses a checked-in walkthrough and no model or provider
   credit. The Presenter's deterministic walkthroughs only open, toggle, or
   adjust safe app controls. Press **Do it** once per actionable step; when the
   safe setup is complete, an explanation-only follow-up uses **Next**, never a
   disabled or failing **Do it**. If the renderer refreshed before the local
   walkthrough service, Show it sends the current lesson inline and still opens
   the card. Steps that would present, control an audience screen, export, or use
   a disruptive native-menu action remain self-guided numbered cards.
   Reader lessons that depend on selected text, files, a graph, or the native
   menu are self-guided too. They explain the exact action but do not reload,
   relaunch, export, reset the layout, open Developer Tools, or change what the
   congregation sees. If **AI features** is off, the app
   offers to open Settings → Others because the local walkthrough server is
   switched off with it.
4. Click **Don't show again** to stop automatic tips on both pages in future app
   launches. This does not remove the lessons: use **Help → Tips of the Day** to
   open one suggestion, or **Help → All tips** to browse the whole learning list
   for the page in front. Opening either from Help does not turn automatic tips
   back on. To restore the automatic card, open **Settings → General → Other
   General Options**, turn on **[en:tran:Show Tips of the Day automatically]**, and
   start the app again. The switch restores tips for both Presenter and Bible Reader.

The **File**, **Edit**, **Tools**, **Window**, and **Help** overviews name every
row users can encounter, including conditional and macOS-only rows, so searching
for a command finds the menu that owns it. They are self-guided because Electron
draws the operating-system menu outside the page and a walkthrough cannot safely
ring or press it. The detailed **View** lessons remain separate so each View
command can explain its effect and risk.

The Presenter and Reader catalogs deliberately keep **Reload**, **Force Reload**,
**Relaunch** and **Toggle Developer Tools** under the **View menu** topic for
completeness, but do not put those troubleshooting commands into the random
daily rotation.
**Actual Size / Zoom In / Zoom Out** are taught as whole-window zoom, separately
from the passage's **Font Size**. **Toggle Full Screen** is taught as whole-window
full screen, separately from the passage's **Full** button. **Widgets** explains
the checked pane list; **Reset Widgets Size** explains its confirmation and that
it both restores default sizes and reopens collapsed panes.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`GL-25`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-26).
:::
