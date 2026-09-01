---
id: W-37
title: "Keep your own files beside the verse (Resources)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, CM-93]
screenshots: 7
generatedFrom: user-workflows.md
workflowsVersion: "2026-08-31"
---
# W-37 — Keep your own files beside the verse (Resources)

If you already keep study material on disk named after the verse it belongs to —
`PSA.1.pdf`, `GEN.49.pptx` — **Resources** (ឯកសារពាក់ព័ន្ធ) puts those files
right beside whatever verse you are reading, from as many folders as you like.

The name has to follow one pattern: **`<book key>.<chapter>.<anything>`**. The book key is
the three-character one the app uses (Psalm is `PSA`, Genesis `GEN`, 1 Chronicles `1CH`), so
anywhere in Psalm 1 looks for `PSA.1.*` — `PSA.1.pdf`, `PSA.1.outline.docx`. Any file type
at all. It is the **chapter** that decides, not the verse, so every verse of a chapter shows
you the same files.

**Files for the whole book** get chapter number **0**: `PSA.0.pdf` is your introduction to
the Psalms, and it is listed for _every_ chapter of the Psalms, above that chapter's own
files. If you have more than one such document, keep going downwards — `-1`, `-2` and so on
all count as book-level too.

1. In the bible lookup, click **Advance Bible Lookup** (`bi-search`, top right) to open
   the side panel, then pick **Resources** from the panel's dropdown — the fourth entry
   after **Find**, **Cross Reference** and **Location-Name (KJV)**. 📸
   You can also get here from the verse itself: right-click any verse in the lookup body
   and choose **Open in Resources** (បើកនៅក្នុងឯកសារពាក់ព័ន្ធ), just under **Open in
   Cross Reference**. That opens the panel on this view AND on that verse.
2. The top of the view shows the verse it is working from — its version, its reference and
   its text, exactly as **Cross Reference** shows it. Click the reference to move to
   another verse, or the version chip to read it in another translation. Under it sit the
   file-name patterns being looked for, so you can always see what it is matching — for
   anywhere in Psalm 1, a solid `PSA.1.*` for the chapter's own files and a dashed
   `PSA.0.*` for the book's. Moving to another verse of the same chapter changes the
   heading but not the files. 📸
3. The first time, the body holds a single **Add Folder** (បន្ថែមថត) button. Click it and
   pick the folder your files are in. You can add as many as you want — the **⋮ More
   Options** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **Add Folder** again. Adding the same folder twice does nothing. 📸
   That same menu has **Reload** (ផ្ទុកឡើងវិញ), which re-reads everything at once: your
   folder list, and the files inside every folder. Use it after adding files on disk while
   the app is open, or after changing the list from another window. 📸
4. Each folder becomes its own group, named after the folder, with the folder it lives in
   shown beside the name and the full path if you hover it. Under the name, hanging off a
   single vertical line, are the matching files — **from that folder and every folder
   inside it** — sorted by file type, each with its own icon (PDF, Word, PowerPoint,
   video, image, bible note). The extension is set quieter than the rest of the name so the
   reference reads first. Hover a file to see where it actually lives. 📸
   A file that matched the book-level pattern rather than this chapter's carries a dashed
   **Introduction** (សេចក្ដីផ្ដើម) tag, so a `PSA.0.pdf` listed under Psalm 1 says why it
   is there. A group with nothing for this verse says **No matching files**.
5. Sometimes you want a file that is _not_ named after this verse. Click the **magnifier**
   (`bi-search`) at the right-hand end of the pattern line and a search box opens under it.
   Type any part of a file's name — `abc`, `baptism`, `PSA.11` — and every file in your
   folders whose name contains it is listed too, added below that folder's verse files under
   a `*abc*` heading so you can tell the two apart. Your verse files stay exactly where they
   were. 📸
   Upper and lower case do not matter, and it looks anywhere in the name, not just at the
   start — searching `abc` finds `abc.pdf` and `01-abc-notes.docx` alike. If you are used to
   writing `abc*`, that works too; the `*` is simply ignored.
   Click the magnifier again to close the box and put the lists back as they were. If a
   folder has hundreds of matches only the first 200 are shown, and the box says **Too many
   matching files** — type a bit more to narrow it down.
6. Click a file to open it in whatever application your computer normally uses for it — a
   PDF in your PDF reader, a PowerPoint in PowerPoint. Right-click one for **Open**,
   **Copy Path to Clipboard**, or **Reveal in Finder** / **Reveal in File Explorer**.
7. Click a group's header to fold it away; it stays folded next time. Right-click a header
   for **Refresh** (re-reads that one folder — **Reload** in step 3 does all of them),
   **Add Folder**, **Reveal in Finder**/**File Explorer**, and **Remove Folder**,
   which asks you to confirm and then only removes it from this list — nothing on disk is
   touched. 📸

> **Watch the numbering.** The chapter number has to stand on its own between two dots. For
> Psalm 1 that means `PSA.1.pdf` is found while `PSA.10.pdf`, `PSA.100.pdf` and `PSA.149.pdf`
> are left alone — which is exactly what you want, since a full set of the Psalms has all of
> them in one folder. Write the numbers plainly: no leading zeros (`PSA.01.pdf` is not
> found), and `-0` is not a number. Upper and lower case do not matter.

> **If a group shows a warning** instead of files: **Folder not found** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **Cannot read folder** means the app is not allowed to read it. **Too many folders to
> search** means the folder tree was too large to finish — point Resources at the folder
> your material is actually in rather than at a whole drive.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`RD-81` · `RD-82` · `RD-83` · `RD-84` · `RD-85` · `RD-86` · `RD-87` · `RD-88` · `RD-89` · `RD-90` · `CM-93`

Regenerated from `user-workflows.md` (workflowsVersion 2026-08-31).
:::
