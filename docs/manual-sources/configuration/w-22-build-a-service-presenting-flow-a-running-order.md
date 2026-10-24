---
id: W-22
title: "Build a service presenting flow (a running order)"
section: "Configuration"
verify: [PL-10, PL-29, PL-32, PL-33, PL-34, PL-35, PL-36, PL-37, PL-38, PL-39, PL-40, PL-41, PL-42, PL-43, PL-44, PL-45, PL-46, PL-47, PL-48, PL-49, PL-50, PL-51, PL-52, PL-53, PL-54, PL-55, PL-56, PL-57, PL-58, PL-59, PL-60, PL-61, PL-62, PL-63, PL-64, PL-65, PL-66, PL-67, PL-68, PL-69, PL-70, PL-71, PL-72, PL-73, PL-74, PL-75, PL-76, PL-81, PL-82, PL-83, PL-84, PL-85, PL-86, PL-87, PL-88, PL-89, PL-90, PL-91, PL-92, PL-93, PL-94, PL-95, PL-96, PL-101]
screenshots: 4
generatedFrom: user-workflows.md
workflowsVersion: "2026-10-24"
---
# W-22 — Build a service presenting flow (a running order)

**Goal:** collect everything one service needs — songs, slides, verses, backgrounds and
foreground presets — into one running order you can work down live.

1. Find the **[en:tran:Presenting Flows]** panel — it is the lower of the two lists on the
   left, under **[en:tran:Documents]**. If the list is empty, right-click its empty area (or
   use the **⋮ [en:tran:More Options]** button in its title bar) → **[en:tran:New File]** to create one. 📸
2. **Drag things onto the presenting flow's NAME row to add them.** The NAME row is the
   presenting flow's own row in the list — the one with its name on it; not the empty part of
   the list, and not a line inside an open presenting flow (dropping onto a _line_ does
   something else — it attaches: see W-22g). So, to add a song or a verse: take hold of
   its row — in the Documents list, or in the Bible list — drag it over to the Presenting
   Flows list and let go on the row that shows the presenting flow’s name. It is added
   at the end. Anything you can present can go in:
   - a **background** — a colour, image, video, camera or website;
   - a **document** — a slide document or a **song** (a song is a document too): drag its row out of the Documents list;
   - a **single slide** — from the previewer, or from a document already in the presenting flow;
   - a **Bible verse** — from the Bible list;
   - a **foreground preset** — drag the blue **[en:tran:Show Marquee Top]** / **[en:tran:Start Countdown]** /
     **[en:tran:Show Time]** button itself. Whatever you typed and styled travels with it, so the
     presenting flow remembers _that_ announcement, not just "a marquee". 📸
   - an **audio track** — drag it out of the **[en:tran:Audios]** split.
3. Click the presenting flow name to **open it**. Each element is one short line: an icon for
   what it is, its id, and its name. A **document** line has its own arrow at its left end —
   a song is a document too. Click the **arrow**, not the line, to see that document's
   slides underneath; clicking the line itself opens the document in the previewer. 📸
4. **A song or document line opens its previewer.** To present one of its slides,
   click that slide in the previewer, or expand the document with its arrow and
   click a slide underneath. An **audio track** opens the **[en:tran:Audios]** split
   and flashes the track there; use that panel's play button to play it.
   Click a **single slide**, Bible verse, background or foreground preset to put
   it on the screen. You can also **drag an element onto a mini screen**, or
   **right-click → [en:tran:Show on Screens]** to pick the screen.
5. Right-click an element for **[en:tran:Move up]** / **[en:tran:Move down]**, **[en:tran:Choose Color]**
   to group your running order by colour, or **[en:tran:Remove from Presenting Flow]**. To move a line a long
   way, use **[en:tran:Move to Top]** or **[en:tran:Move to Bottom]** instead of
   clicking **[en:tran:Move up]** over and over — the line jumps straight to that end and everything
   else keeps its order. (A line that is already at the top is not offered **[en:tran:Move up]** or
   **[en:tran:Move to Top]**, and one already at the bottom is not offered **[en:tran:Move down]** or
   **[en:tran:Move to Bottom]**.) **[en:tran:Duplicate]** puts a copy of the line **directly below** it,
   with its colour, its pinned screens and its parked slides already on the copy — the quick
   way to sing a song twice in one service, then change only the second one. The two copies
   are separate from then on: parking or recolouring one leaves the other alone. 📸
   You can also drag a
   line up or down **inside the same presenting flow** (dragging a line into a _different_
   presenting flow does nothing — add it there from its own list instead). A colour shows as a
   stripe down the left edge of the line and a dot at its right end; the lines stay in
   your running order — they are never re-sorted into colour groups, because the order
   _is_ the meaning here. The colour belongs to that presenting flow alone, so the same song can
   be marked differently in two services. Changes are saved as you make them — there is
   **no save button** anywhere in this panel.
6. Whatever is **live on the screen right now** is marked with a magenta `●` — on the
   element itself, on the document it belongs to, on the presenting flow, and on the
   **[en:tran:Presenting Flows]** heading — so you can see at a glance where you are in the running order.
7. Not sure which "5.jpg" a line means? Right-click it → **[en:tran:Reveal Original]** — the app scrolls to the real item elsewhere in the window and
   flashes it. This works on the slides inside an opened document too. A colour or a
   camera has no original to point at, and the panel holding the original has to be
   open already.

**What else a running order can do** — each has a page of its own:

- be run from one floating panel, with the keyboard (W-22b);
- hold a line that clears the screen, or shows or hides it (W-22c);
- wait on a line and then move on by itself (W-22d), loop a set of slides or jump back
  (W-22e), answer to a key of your own (W-22f);
- make one line bring others up with it (W-22g), or play the video inside a slide (W-22h);
- send a line to one particular screen every time, or park a line (W-22i);
- be handed to another machine as one file (W-22j).

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-10` · `PL-29` · `PL-32` · `PL-33` · `PL-34` · `PL-35` · `PL-36` · `PL-37` · `PL-38` · `PL-39` · `PL-40` · `PL-41` · `PL-42` · `PL-43` · `PL-44` · `PL-45` · `PL-46` · `PL-47` · `PL-48` · `PL-49` · `PL-50` · `PL-51` · `PL-52` · `PL-53` · `PL-54` · `PL-55` · `PL-56` · `PL-57` · `PL-58` · `PL-59` · `PL-60` · `PL-61` · `PL-62` · `PL-63` · `PL-64` · `PL-65` · `PL-66` · `PL-67` · `PL-68` · `PL-69` · `PL-70` · `PL-71` · `PL-72` · `PL-73` · `PL-74` · `PL-75` · `PL-76` · `PL-81` · `PL-82` · `PL-83` · `PL-84` · `PL-85` · `PL-86` · `PL-87` · `PL-88` · `PL-89` · `PL-90` · `PL-91` · `PL-92` · `PL-93` · `PL-94` · `PL-95` · `PL-96` · `PL-101`

Regenerated from `user-workflows.md` (workflowsVersion 2026-10-24).
:::
