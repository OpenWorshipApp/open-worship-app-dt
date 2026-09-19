---
id: W-37
title: "Keep your own files beside the verse (Resources)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, RD-114, RD-115, RD-116, RD-117, RD-118, RD-119, RD-120, CM-93]
screenshots: 14
generatedFrom: user-workflows.md
workflowsVersion: "2026-09-18"
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
   single vertical line, are the matching files — **from that folder and the folders
   inside it, two levels down** (`Library/Genesis/Sermons/GEN.24.pdf` is found, a file one
   folder deeper than that is not) — filed under the pattern each one answered to (`GEN.24.*`, then
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
   **To see everything else without typing, tick [en:tran:Others]**, the box just left of the
   magnifier. Each folder then also lists every file whose name is _not_ a book and a
   chapter — `family-tree.jpeg`, `church-map.pdf`, `README.txt` — under an
   **[en:tran:Others]** heading after its verse files and anything you searched for. 📸
   A file only counts as a book-and-chapter file when it starts with a real book key and a
   plainly written chapter, so `GEN.5.pdf` stays out of this list while `IMG.2.jpg` and a
   misnumbered `GEN.01.pdf` show up in it — handy for spotting a file you named wrongly. A
   file your search found is listed under the search heading instead, never twice. Up to 200
   are shown per folder; past that the group says **Too many other files**, and pointing
   Resources at the folder your material is actually in keeps the list short. Untick
   **[en:tran:Others]** to hide them again — the box stays the way you left it next time.
6. Click a file to open it in whatever application your computer normally uses for it — a
   PDF in your PDF reader, a PowerPoint in PowerPoint. Right-click one for **Open**,
   **Copy Path to Clipboard**, or **Reveal in Finder** / **Reveal in File Explorer**.
   Two kinds of file open **inside the app** instead:
   - **A markdown file** (`.md`, `.markdown`, drawn with the `bi-markdown` icon) opens in its
     own **Markdown Preview** window, like a Bible Note does: headings, lists, tables, quotes,
     code, pictures kept beside the file, and **Mermaid diagrams** written in a ` ```mermaid `
     block are drawn as diagrams (a diagram with a mistake in it shows the error above its
     code). The window follows the file — save it in your editor and the preview changes.
     A link to a heading scrolls there; a link to another `.md` opens it in the same window,
     with **[en:tran:Back]** (`bi-arrow-left`) to return; a web link opens in your browser; a
     link to any other file shows it in its folder rather than running it. HTML written
     inside the file is drawn the way GitHub shows a README — a centred picture, a table, a
     section that folds away — but nothing in it can run: scripts, buttons, forms and styles
     are taken out. If a file shows `#` and `**` instead of a heading and bold, the file itself
     was saved with them escaped (`\#`, `\*\*`), which some editors' formatted view does
     when text is pasted into it; the preview shows what is written. The head row also has
     **[en:tran:Reload]**, **[en:tran:Open in Default App]** (to edit it) and **Reveal in
     File Explorer**. Right-click the row for **[en:tran:Preview]** or **Open**. Pressing a
     file whose preview is already open brings that window forward. 📸
   - **A bible note file** (`.own`) gains a chevron: click it and everything in it is
     listed under it, as the **Bible Notes** panel lists it — its notes, and each verse
     marked in it (`bi-highlighter`) with its highlights in their colour and its comments
     underlined, what was written beside them. Click a note to open it in the **Bible Note**
     window **read-only** — the title bar says **([en:tran:Read-only])**, the lock at the
     bottom shows it is locked, and nothing you do there is saved to the file. Click a
     highlight or comment to open that verse beside what you are reading; click a verse to
     fold it away to a count. Nothing in the file can be changed from here. A file that is
     not a bible note says **[en:tran:Not a bible note file]**. 📸
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
   **Add Folder**, **[en:tran:Add Files]**, **Reveal in Finder**/**File Explorer**,
   **[en:tran:Copy to Data Directory]** and **Remove Folder**, which asks you to confirm and
   then only removes it from this list — nothing on disk is touched. 📸
   **[en:tran:Add Files]** is the other way round: it puts files you already have INTO that
   folder. Pick one or several in the picker and they are **copied** in — the originals stay
   exactly where they were — then the group re-reads itself, opening if it was folded, and a
   note says how many were copied. **Nothing is ever overwritten**: a name the folder already
   holds gets a number beside it, so a second `GEN.4.pdf` lands as `GEN.4 (1).pdf`. Pick a file
   that is already in that folder and it is left alone rather than copied beside itself. Copy in
   a file named after no chapter — `notes.docx` — and it is on the shelf but not in the list;
   the note says so and tells you to tick **[en:tran:Others]** (step 5) to see it. 📸
   **[en:tran:Copy to Data Directory]** brings a folder you keep somewhere else in with the rest
   of the app's data, so it lives and moves with it. It asks first, naming the folder and where
   the copy goes — a `resources` folder inside your data folder (the one Settings calls the
   parent directory). Press **Yes** and everything in the folder is copied there, sub-folders
   and all, while the progress bar runs; then the group switches to the copy, in the same place
   and folded or open as it was, and a note says where it went. **Your original folder is not
   touched** — it only leaves this list, so delete it yourself once you are happy with the copy.
   A second copy of a folder with the same name is called `YouTube (1)` rather than mixed into
   the first. The item is not offered on a folder that already is a copy, and a folder that
   holds your data folder — your whole Desktop, when the data lives on the Desktop — is refused
   straight away with **[en:tran:The data directory is inside this folder]**, because it would
   be copied into itself. 📸

> **Watch the numbering.** The chapter number has to stand on its own between two dots. For
> Psalm 1 that means `PSA.1.pdf` is found while `PSA.10.pdf`, `PSA.100.pdf` and `PSA.149.pdf`
> are left alone — which is exactly what you want, since a full set of the Psalms has all of
> them in one folder. Write the numbers plainly: no leading zeros (`PSA.01.pdf` is not
> found), and `-0` is not a number. Upper and lower case do not matter.

> **If a group shows a warning** instead of files: **Folder not found** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **Cannot read folder** means the app is not allowed to read it. **Too many folders to
> search** means even those two levels held more folders than it could read — point
> Resources at the folder your material is actually in rather than at a whole drive.
> A file you expected that is simply **not listed** is usually more than two folders down:
> add the folder it sits in (or the one above it) as a group of its own.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`RD-81` · `RD-82` · `RD-83` · `RD-84` · `RD-85` · `RD-86` · `RD-87` · `RD-88` · `RD-89` · `RD-90` · `RD-114` · `RD-115` · `RD-116` · `RD-117` · `RD-118` · `RD-119` · `RD-120` · `CM-93`

Regenerated from `user-workflows.md` (workflowsVersion 2026-09-18).
:::
