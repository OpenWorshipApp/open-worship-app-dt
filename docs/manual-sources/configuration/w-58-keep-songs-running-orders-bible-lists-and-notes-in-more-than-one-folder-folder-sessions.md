---
id: W-58
title: "Keep songs, running orders, Bible lists and notes in more than one folder (folder sessions)"
section: "Configuration"
verify: [PM-170, PM-171]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-10"
---
# W-58 — Keep songs, running orders, Bible lists and notes in more than one folder (folder sessions)

**Goal:** keep this Sunday's songs, last Easter's set or a sermon series' notes in folders
of their own, and switch between them from the list itself — without re-pointing the
folder the app was set up with.

1. Under the title of **[en:tran:Documents]**, **[en:tran:Presenting Flows]**,
   **[en:tran:Bibles]** and **[en:tran:Bible Notes]** is a row of small buttons:
   **[en:tran:Default]** and a **＋** (**[en:tran:Add Session]**). 📸 **[en:tran:Default]**
   is the folder the list has always shown — the one **[en:tran:Path Settings]** names
   (W-16) — and nothing on this row ever changes it.
2. Press **＋**. A **Session 2** button appears and is the one you are on; its list is
   empty and says **[en:tran:No directory selected]**.
3. Give it a folder: press **[en:tran:Choose a folder]** and pick one, or press the folder
   line above the list, type the folder's path and press Enter.
   **[en:tran:Select Default]** points it at the list's usual folder instead. The list now
   shows that folder's files, with a sort and filter of its own. 📸
4. Press **[en:tran:Default]** to go back and **Session 2** to come again — the app
   remembers the one you were on.
5. The **⋮** on the session you are on (or a right-click on any of them) has
   **[en:tran:Rename Session]**, and on every session but **[en:tran:Default]**
   **[en:tran:Remove Session]**, which asks first. Removing forgets the session and its
   folder setting — the files in that folder are never touched. **[en:tran:Default]** can
   be renamed, never removed.

What follows the session you are on:

- a song or a slide document opened with **[en:tran:Edit]**, and a Bible note opened from
  the list, opens from that session's folder;
- what you make from somewhere else lands in it — a song or slides made from a Bible
  passage (W-06), a verse saved from **[en:tran:Bible Lookup]** into the **Default** list
  of **[en:tran:Bibles]**, a song or slides the assistant writes (W-42, W-56, W-57), and a
  file you import (W-23, W-22j, W-24, W-41);
- a session's folder outside the data folder is watched like the data folder, so a file
  copied into it shows up in the list.

What does NOT follow it: your highlights and comments on Bible verses (W-40) are always
kept in the **Default** session's notes, so switching **[en:tran:Bible Notes]** never hides
them, and the Reader marks a verse that has notes from both the **Default** session and the
one you are on. The Presenter and the Bible Reader keep their **[en:tran:Bibles]** sessions
apart, as they keep their folders apart.

Steps 1–5 were observed live 2026-11-07 on the dev Presenter: the row under all four
titles; **＋** on **[en:tran:Documents]** making **Session 2** with
**[en:tran:Choose a folder]** in its empty list; a typed folder listing its song and slide
document; **[en:tran:Edit]** on each opening it from that folder (the Lyric Editor and the
Document Editor); **[en:tran:Default]** bringing the usual list back; and
**[en:tran:Default]**'s menu offering **[en:tran:Rename Session]** alone. Unit-tested, not
seen live: a verse saved from Lookup into a session's list, a song made from a passage into
a session, verse marks staying in the **Default** session's notes, and the Lookup popup's
**[en:tran:Bibles]** row following the right column's.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PM-170` · `PM-171`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-10).
:::
