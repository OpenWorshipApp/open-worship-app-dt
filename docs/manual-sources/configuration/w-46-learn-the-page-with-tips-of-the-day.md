---
id: W-46
title: "Learn the page with Tips of the Day"
section: "Configuration"
verify: [GL-25]
screenshots: 0
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-06"
---
# W-46 — Learn the page with Tips of the Day

**Goal:** learn each operator page at your own pace and see the exact
control without having to search the manual.

1. Five minutes after the window starts, the operator page in
   front shows one **Tip of the Day** in the top-right corner — never at launch,
   when it would cover the controls you reach for while opening the service.
   Reloading or switching between Presenter and Reader does not restart those
   five minutes. The card then takes itself off after one minute: a thin bar
   along its bottom edge drains over that minute, and resting the mouse
   pointer on the card freezes the bar and the minute with it, so nothing
   disappears while you are reading it. Moving away carries on from where the
   bar stopped. **Next tip** starts the minute again, browsing **All tips**
   holds it, and **×** closes the card at once. The tip
   belongs to that page only, and the first tip is chosen at random without
   repeating the last automatic tip shown for that page. **Help → Tips of the
   Day** opens one at once, and a tip opened that way stands in for that
   page's automatic card. Settings, Slide Editor, Bible Note, Web Editor, Lyric
   Editor, and Local Web Share also have their own tips. Each page remembers
   whether its automatic tip has already appeared; visiting another page lets
   you learn that page too. Audience screens and help-only windows show no tips.
2. Click **Next tip** to move through that page's tips in order. The list wraps to
   the first tip after the last. Click **All tips** to open the numbered learning
   list for the current page. Search by a control or task, or scan the topic name
   that leads each lesson's line;
   the counter shows how many lessons match. Each lesson says what it teaches;
   choose one to return to its card and practise it at your own pace. The
   Presenter has **89 topics**: 79 start with a safe **Do it** for a visible
   control or shortcut, while ten disruptive or native-menu lessons stay self-guided. They
   cover documents and slides, audience screens, backgrounds and media, service
   planning, app help, and every native application menu from **File** through
   **Help**. _Write a note on a document or slide_ opens the previewer's **Note**
   panel, which ships closed (W-03, W-31). Presenter lessons also cover lookup references and history, study
   tools inside Bible Lookup, media folder filtering and sorting, finding a service
   flow, and **[en:tran:Messages]** for separate notices, rotation and spacing.
   Foreground lessons explain **[en:tran:Effects]** and preparing an Image Show
   slide show; output and style changes stay in your hands.
   The Reader has **99 topics**: 49 start with a safe **Do it** and
   50 stateful, file-dependent, native-menu, pane-visibility or audience-output lessons stay
   self-guided. They cover reference entry and
   history, reading panes and formatting, Find and cross references,
   people/places and connection graphs, Resources, verse marks and notes,
   presenting a verse, the Reader header, every native application menu, and
   detailed lessons for every command under **View**. The **×** closes the card
   for now; reloading a page does not show its automatic card again in the same
   window session. A page whose delay expires while it is behind another window
   waits until you focus it.
3. In Settings, **Help → All tips** shows three lessons for **General**,
   **Bible**, and **Others**. Choose **Explore General settings**, then **Show it**:
   the demo card and its red outline appear inside Settings.
   **Show it** always starts in the originating window, even when a popup and
   the main window show the same kind of page. With an actionable lesson, the control
   is ringed in red. This uses a checked-in walkthrough and no model or provider
   credit. The deterministic walkthroughs open, copy, toggle, or
   adjust safe app controls. Press **Do it** once per actionable step; when the
   safe setup is complete, an explanation-only follow-up uses **Next**, never a
   disabled or failing **Do it**. If the renderer refreshed before the local
   walkthrough service, Show it sends the current lesson inline and still opens
   the card. Steps that would present, control an audience screen, export, or use
   a disruptive native-menu action remain self-guided numbered cards.
   In the Reader, search for **[en:tran:Copy Text]**, **[en:tran:New File]**,
   **[en:tran:Search file name]**, or **[en:tran:Find Connection]** to find a
   focused lesson. Each tip explains when to use that control. Saved Bibles
   lists and Bible Notes have separate folder, creation, organization and
   import/export tips; graph and Resources tools have their own lessons too.
   Use **Back** to revisit a guide step. If a panel is hidden, reopen it through
   **View → Widgets** before practising. An older walkthrough service can
   show the complete Reader lesson as a self-guided fallback.
   Reader lessons that depend on selected text, files, a graph, or the native
   menu are self-guided too. They explain the exact action but do not reload,
   relaunch, export, reset the layout, open Developer Tools, or change what the
   congregation sees. If **AI features** is off, the app
   offers to open Settings → Others because the local walkthrough server is
   switched off with it.
4. Click **Don't show again** to stop automatic tips on all operator pages in future app
   launches. This does not remove the lessons: use **Help → Tips of the Day** to
   open one suggestion, or **Help → All tips** to browse the whole learning list
   for the page in front. Opening either from Help does not turn automatic tips
   back on. To restore the automatic card, open **Settings → General → Other
   General Options**, turn on **[en:tran:Show Tips of the Day automatically]**, and
   start the app again. The switch restores tips for every supported operator page.

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

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-06).
:::
