---
id: W-23
title: "Share one document (song, sermon slides, PDF) with another machine"
section: "Configuration"
verify: [PL-77, PL-78, PL-79, PL-80, CM-36, CM-37]
screenshots: 3
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-23 — Share one document (song, sermon slides, PDF) with another machine

Sometimes you only want to hand over **one** item, not a whole service. A document
travels as its own bundle, with everything attached to it.

1. In the **Documents** list, right-click the item you want — an Open Worship slide
   document, a lyric, a PDF, a PowerPoint or a Word file all work — and choose
   **Export** (នាំចេញ). 📸
2. A small panel asks for a **Password** (ពាក្យសម្ងាត់) and a **Confirm Password**
   (បញ្ជាក់ពាក្យសម្ងាត់). Leave both empty and press **Ok** for the ordinary bundle, or
   type the same password in both to lock it — see W-22 step 10a, it works identically
   here and there is no way to recover a forgotten one. 📸
3. You get one `<name>.owadoc.tar.gz` file in your **Downloads** folder (or
   `<name>.owadoc.enc` if you set a password), and the folder opens. It contains the
   document itself plus everything hanging off it: the background you attached to it
   (and that background's image or video file), any video placed inside its slides, and
   its colour note.
4. On the other machine, right-click an empty part of the **Documents** list →
   **Import** (នាំចូល) and pick that file — or just **drag the
   `.owadoc.tar.gz` (or `.owadoc.enc`) file from your file manager onto the Documents
   list**, which imports it the same way. A protected bundle asks for its password
   first; an ordinary one never does. 📸
5. The document appears in that machine's documents folder under its original name, with
   its background re-attached and its colour note restored, so it is ready to present
   straight away.
6. If the bundle is on a web server or a machine sharing it over the local network, use
   **Import From URL** (នាំចូលពី URL) instead and paste the link. The
   download goes to a temporary folder, is imported exactly as above, and is then
   deleted.

> Notes: the same rules as a presenting flow bundle apply. A file already there **with the same
> contents** is reused rather than duplicated, so importing twice is safe; a file of the
> same NAME that is actually a different file is left untouched and the bundled one lands
> beside it as `a (1).pdf`. A document that already has a background attached keeps its
> own — an import never overwrites it, and it does not overwrite that document's colour
> note either. Importing needs the folders it writes into to be **chosen already** (for a
> document with a video background, the Videos folder too), and if one is missing the
> import stops before copying anything and tells you which to choose.
>
> If you export the same document twice, the second file is named
> `<name>.owadoc.tar (1).gz`. That name no longer ends in `.owadoc.tar.gz`, so dragging
> _that_ copy onto the list will not import it — use **Import** and pick it
> instead (or rename it first).


> This works for a **lyric** too — a lyric is a row in the same Documents list. Its
> bundle carries the lyric plus every background you attached to its slides, so the song
> arrives on the other machine already looking the way you set it up.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-77` · `PL-78` · `PL-79` · `PL-80` · `CM-36` · `CM-37`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
