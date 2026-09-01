---
id: W-41
title: "Share a whole page of Bible Notes with another machine"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [PR-30, PR-31, CM-69, CM-98, CM-99]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-41 — Share a whole page of Bible Notes with another machine

Until now a note could only leave the app **one item at a time**. A whole note file —
every note in it, the pictures and clips inside them, and the background you attached
to it — travels as one bundle.

1. In the **Bible Notes** panel, click the `⋮` on the note file you want (or right-click
   its name) and choose **Export** (នាំចេញ). It sits just under **Import**. 📸
2. A small panel asks for a **Password** (ពាក្យសម្ងាត់) and a **Confirm Password**
   (បញ្ជាក់ពាក្យសម្ងាត់). Leave both empty for an ordinary bundle, or type the same
   password in both to lock it. Press **Ok** (យល់ព្រម).
3. You get one `<name>.owanote.tar.gz` file in your **Downloads** folder —
   `<name>.owanote.enc` if you set a password — and the app opens the folder on it. 📸

   > Everything a note points at rides inside: a picture you pasted, a clip you inserted,
   > the sound file you attached. That makes this bundle much larger than a bible list's,
   > so give a note full of video a moment to finish.
4. On the other machine, click the `⋮` at the top of the **Bible Notes** panel → **Import**
   (នាំចូល) and pick the file — or **drag the `.owanote.tar.gz` (or `.owanote.enc`) onto
   the Bible Notes panel**. A protected one asks for its password first.
   **Import From URL** (នាំចូលពី URL) works here too if the bundle is on the web. 📸
5. The note file appears in that machine's notes folder with all its notes, your
   highlights and comments, and its pictures and clips playing from the local copies.

   > If a note file of that name is already there, yours is never overwritten: the
   > imported one arrives beside it as `name (1)`. Rename whichever you prefer.
6. To move a **single note** instead of the whole page, use the `⋮` on that note →
   **Export**, and **Import** on the note file you want it to land in — any note file,
   not only **Default**.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PR-30` · `PR-31` · `CM-69` · `CM-98` · `CM-99`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
