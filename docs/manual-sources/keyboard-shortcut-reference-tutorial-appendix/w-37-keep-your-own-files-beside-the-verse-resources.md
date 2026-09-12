---
id: W-37
title: "Keep your own files beside the verse (Resources)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, RD-114, RD-115, CM-93]
screenshots: 9
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-12"
---
# W-37 — Keep your own files beside the verse (Resources)

If you already keep study material on disk named after the chapter it belongs to —
`PSA.1.pdf`, `GEN.49.pptx` — **[en:tran:Resources]** puts those files
right beside whatever you are reading, from as many folders as you like — and it
follows **every passage you have open**, not one verse you clicked: three panes on
Genesis 24, 27 and 29 list the files of all three.

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
2. The top line of the view is the file-name patterns being looked for, one for **each
   passage you have open**, in the order of your panes, so you can always see what it is
   matching — reading Genesis 24 beside Genesis 27, a solid `GEN.24.*` and a solid
   `GEN.27.*` for the chapters' own files, then one dashed `GEN.0.*` for the book's.
   Two panes on the same chapter in two versions count once. The pane you are typing a
   reference into follows what its box says, as soon as the reference is complete;
   moving to another verse of the same chapter changes nothing here — it is the chapter
   that decides. 📸
3. The first time, the body holds a single **[en:tran:Add Folder]** button. Click it and
   pick the folder your files are in. You can add as many as you want — the **⋮ More
   Options** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **Add Folder** again. Adding the same folder twice does nothing. 📸
   **Or drag the folder straight in.** Take it from your file manager — Explorer, Finder —
   and drop it anywhere on the Resources view: while you hold it there the view outlines
   itself and its top line reads **[en:tran:Drop folders here]** in place of the patterns,
   and letting go shelves the folder exactly as the button does, with its matching files
   already listed under it. Several folders at once is one drop. 📸
   Nothing is copied or moved — the folder stays where it is, and Resources only
   remembers where to look. Drop a **file** by mistake and nothing is added: it says
   **[en:tran:Drop a folder, not a file]**, because the folder a stray file sits in is as
   often your whole Downloads as it is a library, and pointing Resources at that would
   set it walking everything you own. A folder that is already on the list says
   **[en:tran:Folder is already added]** rather than changing nothing in silence.
   That same menu has **[en:tran:Reload]**, which re-reads everything at once: your
   folder list, and the files inside every folder. Use it after adding files on disk while
   the app is open, or after changing the list from another window. 📸
4. Each folder becomes its own group, named after the folder, with the folder it lives in
   shown beside the name and the full path if you hover it. Under the name, hanging off a
   single vertical line, are the matching files — **from that folder and every folder
   inside it** — filed under the pattern each one answered to (`GEN.24.*`, then
   `GEN.27.*`, then the dashed `GEN.0.*`), sorted by file type within each, each with its
   own icon (PDF, Word, PowerPoint, video, image, bible note). The extension is set quieter
   than the rest of the name so the reference reads first. Hover a file to see where it
   actually lives. 📸
   A book-level file is listed **once**, under its dashed pattern, however many chapters
   of that book you have open, and carries a dashed **[en:tran:Introduction]** tag so a
   `PSA.0.pdf` says why it is there. A group with nothing for what you are reading says
   **No matching files**.
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
7. **A `.json` file can hold a list of links** — videos, articles, anything on the web for
   that chapter — and the panel shows them instead of opening the file. Write it as a list
   of entries, each with a **title** to read and a **url** to open:

   ```json
   [
       {
           "title": "Overview: 1-2 Chronicles",
           "url": "https://www.example.com/watch?v=overview-chronicles"
       },
       { "title": "Notes on the genealogies", "url": "https://www.example.com/notes" }
   ]
   ```

   Save that as `1CH.0.json` beside your other files and the row for it gains a chevron
   (`bi-chevron-down`) and a 🔗 icon, with one row per entry hanging under it. **Click a
   title to open it in your own web browser** — Chrome, Edge, Safari, whatever you
   normally use — and the site it goes to is shown after the title when the panel is wide
   enough, with the title and the full address on the tooltip either way. Right-click a
   link (or use its **⋮**) for **Open Link in Browser** and **Copy URL to Clipboard**. 📸
   A few details worth knowing:
   - A bare address on its own line — `"https://www.example.com/talk"` — is a link that
     titles itself, so a quick list needs no titles at all. An entry with no title shows
     its address as the title.
   - Only **`http`** and **`https`** addresses are offered. Anything else is left out and
     the panel says how many entries it could not read (**1 entry was not understood**),
     so a typo shows instead of a row quietly going missing.
   - **A `.json` that is not a list of links is just a file.** If it holds other data, or
     is not valid JSON at all, the row keeps the ordinary file icon with no chevron and a
     click opens it in your text editor like any other file — nothing to dismiss.
   - The file is read when its row appears, so editing it on disk and folding the group
     shut and open again shows your change. Files found by the **search** in step 5 are
     read on the first click instead, which is why a link list found that way needs one
     press to show its links.
   - Right-click the `.json` row itself (or its **⋮**) for **Open** if you want to edit
     the file rather than follow a link.
8. Click a group's header to fold it away; it stays folded next time. Right-click a header
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

`RD-81` · `RD-82` · `RD-83` · `RD-84` · `RD-85` · `RD-86` · `RD-87` · `RD-88` · `RD-89` · `RD-90` · `RD-114` · `RD-115` · `CM-93`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-12).
:::
