---
id: W-37
title: "Keep your own files beside the verse (Resources)"
section: "Keyboard shortcut reference (tutorial appendix)"
verify: [RD-81, RD-82, RD-83, RD-84, RD-85, RD-86, RD-87, RD-88, RD-89, RD-90, RD-114, RD-115, RD-116, RD-117, RD-118, RD-119, RD-120, RD-122, RD-127, RD-128, RD-129, RD-130, RD-131, RD-132, RD-133, RD-134, RD-135, RD-137, CM-93]
screenshots: 17
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-22"
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

1. In the bible lookup, click **[en:tran:Advance Bible Lookup]** (the binoculars, top right) to open
   the side panel, then pick **[en:tran:Resources]** from the panel's dropdown — the fourth entry
   after **[en:tran:Find]**, **[en:tran:Cross Reference]** and **[en:tran:Location-Name (KJV)]**. 📸
2. The top line of the view is the file-name patterns being looked for, one for **each
   passage you have open**, in the order of your panes, so you can always see what it is
   matching — reading Genesis 24 beside Genesis 27, a solid `GEN.24.*` and a solid
   `GEN.27.*` for the chapters' own files, then one dashed `GEN.0.*` for the book's.
   Above each group of files, the heading also spells out the book and chapter:
   `JHN.3.*, John chapter 3` or `JHN.0.*, John Introduction`. These full names
   follow the interface language and are visible without hovering.
   Two panes on the same chapter in two versions count once. The pane you are typing a
   reference into follows what its box says, as soon as the reference is complete;
   moving to another verse of the same chapter changes nothing here — it is the chapter
   that decides. 📸
3. The first time, the body holds a single **[en:tran:Add Folder]** button. Click it and
   pick the folder your files are in. You can add as many as you want — the
   **⋮ [en:tran:More Options]** button, or a right-click anywhere in the view including the empty space below
   the folders, offers **[en:tran:Add Folder]** again. Adding the same folder twice does nothing. 📸
   **Folders already in your data folder are one press away.** Everything
   **[en:tran:Copy to Data Directory]** (step 8) makes lands in a `resources` folder inside
   your data folder, and so does what **[en:tran:Import Data]** (W-25) brings back. Any
   folder in there that is not on the list yet is listed at the bottom of the view under
   **[en:tran:In the data directory]** — the first time, right under the **[en:tran:Add Folder]**
   button. Click one and it becomes a group straight away, with its matching files already
   listed and no folder picker; it leaves that list as it joins the shelf, and
   **[en:tran:Remove Folder]** puts it back. A folder you make in there while the view is
   open appears after **[en:tran:Reload]**. Nothing is offered that the view already shows —
   including every folder in there when the whole `resources` folder is itself on the list —
   and the heading is not drawn at all when there is nothing to offer. 📸
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
   of that book you have open, and, unless the panel is very narrow, carries a dashed **[en:tran:Introduction]** tag so a
   `PSA.0.pdf` says why it is there. A group with nothing for what you are reading says
   **[en:tran:No matching files]**.
5. Sometimes you want a file that is _not_ named after this verse. Click the **magnifier**
   at the right-hand end of the pattern line and a search box opens under it.
   Type any part of a file's name — `abc`, `baptism`, `PSA.11` — and every file in your
   folders whose name contains it is listed too, added below that folder's verse files under
   a `*abc*` heading so you can tell the two apart. Your verse files stay exactly where they
   were. 📸
   Upper and lower case do not matter, and it looks anywhere in the name, not just at the
   start — searching `abc` finds `abc.pdf` and `01-abc-notes.docx` alike. If you are used to
   writing `abc*`, that works too; the `*` is simply ignored.
   Click the magnifier again to close the box and put the lists back as they were. If a
   folder has hundreds of matches only the first 200 are shown, and the box says
   **[en:tran:Too many matching files]** — type a bit more to narrow it down.
   **To see everything else without typing, tick [en:tran:Others]**, the box just left of the
   magnifier. Each folder then also lists every file whose name is _not_ a book and a
   chapter — `family-tree.jpeg`, `church-map.pdf`, `README.txt` — under an
   **[en:tran:Others]** heading after its verse files and anything you searched for. 📸
   A file only counts as a book-and-chapter file when it starts with a real book key and a
   plainly written chapter, so `GEN.5.pdf` stays out of this list while `IMG.2.jpg` and a
   misnumbered `GEN.01.pdf` show up in it — handy for spotting a file you named wrongly. A
   file your search found is listed under the search heading instead, never twice. Up to 200
   are shown per folder; past that the group says **[en:tran:Too many other files]**, and pointing
   Resources at the folder your material is actually in keeps the list short. Untick
   **[en:tran:Others]** to hide them again — the box stays the way you left it next time.
6. Click a file to open it in whatever application your computer normally uses for it — a
   PowerPoint in PowerPoint, a picture in your picture viewer. Right-click one for **[en:tran:Open]**,
   **[en:tran:Copy Path to Clipboard]**, or **[en:tran:Reveal in Finder]** / **[en:tran:Reveal in File Explorer]**.
   Three kinds of file open **inside the app** instead:
   - **A PDF** (`.pdf`) opens in the app's own PDF viewer window — the same one
     **[en:tran:Preview PDF]** opens from a PDF in the Documents list — with its pages down
     the side, zoom and print. Right-click the row for **[en:tran:Preview PDF]**, or **[en:tran:Open]**
     to use your own PDF reader instead. Each press opens one more window on the file, a
     little below and to the right of the last, so two parts of it can be read side by side. 📸
   - **A markdown file** (`.md`, `.markdown`, drawn with the markdown icon) opens in its
     own **Markdown Preview** window, like a Bible Note does: headings, lists, tables, quotes,
     code, pictures kept beside the file, and **Mermaid diagrams** written in a ` ```mermaid `
     block are drawn as diagrams (a diagram with a mistake in it shows the error above its
     code). The window follows the file — save it in your editor and the preview changes.
     A link to a heading scrolls there; a web link opens in your browser; a link to another
     file opens it in a window of its own, and this window keeps its file: another `.md` in a
     Markdown Preview of its own (one already open on that file comes forward instead), a
     PDF in the PDF window, a bible note file on its first note, and any other file is shown
     in its folder rather than run. HTML written
     inside the file is drawn the way GitHub shows a README — a centred picture, a table, a
     section that folds away — but nothing in it can run: scripts, buttons, forms and styles
     are taken out. If a file shows `#` and `**` instead of a heading and bold, the file itself
     was saved with them escaped (`\#`, `\*\*`), which some editors' formatted view does
     when text is pasted into it; the preview shows what is written.
     A Bible passage quoted the way the app quotes one into a study — a quote that opens on
     its bold reference and its Bible, `> **John 3:1-21** (KJV)`, with the verses under it —
     has a chevron before the reference, **[en:tran:Collapse]**: press it and the passage
     folds to that line; press it again (**[en:tran:Expand]**) to open it. The fold is on
     screen only.
     **People, places, verses and other files named in the page are links too**, drawn in
     the link colour with a dotted underline, as the names in a Bible Reader verse are: a
     person or place of the chapter the file is named after (a `JHN.3.…` file links Nicodemus
     and Moses; a file named after no chapter links only a name one person or place in the
     whole Bible has), a verse reference written the way an installed Bible names its books
     (`Ezek. 36:25-27`, `John 3:16; 5:8`, a reference in Khmer), and the name of another
     resource file (`JHN.3.pdf`, `JHN.0.pdf`) that is beside this file or in one of your
     Resources folders. Names light up once the Bible Reader has highlighted the names of a
     verse for the first time. Click a person, place or verse to open its detail panel in
     the Bible Reader, which comes forward: the main window when it shows the Reader, else a
     Reader window you have open, else the main window as it is, which stays on the page it
     is on. Click a file's name to open it in a window of its own, as a link does. Words in
     code, in a diagram or in a link stay as written, and a file that does not exist is not
     linked; selecting words across a link opens nothing. The head row also has
     **[en:tran:Reload]**, **[en:tran:Open in Default App]** and
     **[en:tran:Reveal in File Explorer]**.
     **To jump to a part of a long page:** press **[en:tran:Sections]** (the list, first
     of the head row's buttons, there when the page has headings). The page's headings are
     listed under the head row, each set in under the one before it by its level (`#`,
     `##`, `###` …), the one you are reading in the link colour; click one and the page
     jumps to it. The arrow keys, Home and End move along the list; Esc, a click anywhere
     else or the button again closes it. Once you scroll down, an arrow in the page's
     bottom-right corner, **[en:tran:Scroll to the top]**, takes you back to the top.
     Neither is printed. 📸 **[en:tran:Print]** (the printer) opens a Print
     Preview of the page in the light theme, whatever the window shows: a dark window prints
     exactly what it would show in light, its diagrams too, with the same fonts and layout,
     on as many pages as it needs, without the head row or the editor; print it or save it
     as a PDF from there. Nothing of the page is left off: a fold closed on screen prints
     open, every picture is there however far down the page, and words typed in the editor
     a moment before are printed too.
     **When the page names a verse, a person or a place, [en:tran:Print] asks first.** The
     window shows **[en:tran:Add the Bible text and the name and place details to the end of the printout?]**
     with how many verses, names and places it found. **[en:tran:Add and Print]** adds them
     after the page's last line: the words of each passage, from the Bible named in
     brackets right after its reference when that Bible is installed (`John 3:1-36
(Amplified)` from the Amplified), else from the Bible whose book names it is written
     in (a Khmer reference from a Khmer Bible), else the KJV. A passage already printed as
     part of a longer one is not printed again, and one that begins within it goes on from
     that one's Bible: a longer one from any Bible of its language holds it, or from its
     own Bible only when that Bible is named after it. Then each
     person and place with what the names lookup says of them,
     in the language that lookup is set to, a place's modern site too. A page that names
     very many says at the end how many more could not be added.
     **[en:tran:Print Page Only]** prints the page alone, and **[en:tran:Cancel]** (or Esc)
     prints nothing. A page that names none prints straight away. Ctrl+P (⌘+P on a Mac)
     and **File** → **Print Without Preview** in the menu bar (Alt shows it when it is
     hidden) ask the same question first. What is added is on the paper only: the window
     never shows it.
     **[en:tran:Ask the Assistant About This File]** (the 🤖, last in the row, shown while
     AI is on) brings the help window forward with this file attached in a chat of its own,
     as the 🤖 on its Resources row does.
     **To change the file right there:** press **[en:tran:Edit]** (the pencil). An editor
     of the file's markdown opens on the left, its lines wrapped, and the page stays on the right, drawing what you type a moment
     after you stop. The editor opens at the part of the page you were reading. Scroll either
     side and, once you stop, the other jumps to the same line. Nothing is written until you
     press **[en:tran:Save]** (the disk) or
     Ctrl+S (⌘+S on a Mac); until then a `*` after the name says there are
     **[en:tran:Unsaved changes]**, and **[en:tran:Discard unsaved changes]** (the round
     arrow) puts back what is saved. **[en:tran:Hide Editor]** (the pencil again) gives the
     whole window back to the page — your unsaved words still drawn there as they will
     look, still waiting for **[en:tran:Save]**. **To ask the assistant about some of the
     words**, select them in the editor, right-click them (or press Shift+F10) and choose
     **[en:tran:Ask the assistant about this]**: the help window comes forward with them
     quoted in its box under _Selected text_, the file's name and their line number, in the
     chat that already holds this file, else in a new one with the file attached. Nothing
     is sent until you type your question under the quote and press **[en:tran:Send]**.
     While something is unsaved,
     **[en:tran:Reload]** waits, and closing the window is stopped once with a note to save or discard first (keep trying and it
     closes anyway). A change saved in your own editor reaches an open editor here that
     has nothing unsaved; one with unsaved words keeps them, and **[en:tran:Save]** writes
     them over the file. Right-click the row for **[en:tran:Preview]** or **[en:tran:Open]**. Each
     press opens one more window on the file, as a PDF's does: scroll one to the
     diagrams and keep the other on the passage. 📸
   - **A bible note file** (`.own`) gains a chevron: click it and everything in it is
     listed under it, as the **[en:tran:Bible Notes]** panel lists it — its notes, and each verse
     marked in it (the highlighter icon) with its highlights in their colour and its comments
     underlined, what was written beside them. Click a note to open it in the **Bible Note**
     window **read-only** — the title bar says **([en:tran:Read-only])**, the lock at the
     bottom shows it is locked, and nothing you do there is saved to the file. Click a
     highlight or comment to open that verse beside what you are reading; click a verse to
     fold it away to a count. Nothing in the file can be changed from here. A file that is
     not a bible note says **[en:tran:Not a bible note file]**. 📸
7. **A `.json` file can hold a list of links** — videos, articles, anything on the web for
   that chapter — and the panel shows them instead of opening the file. Save the file
   inside a folder listed in **[en:tran:Resources]**; to add its folder, click the panel's
   **⋮** → **[en:tran:Add Folder]** and choose that folder. Write it as a list
   of entries, each with a **title** to read and a **url** to open — one link is
   `[{"title": "Notes", "url": "https://www.example.com/notes"}]` — exactly as in this example:

   ```json
   [
     {
       "title": "Overview: 1-2 Chronicles",
       "url": "https://www.example.com/watch?v=overview-chronicles"
     },
     {
       "title": "Notes on the genealogies",
       "url": "https://www.example.com/notes"
     }
   ]
   ```

   Save it named after its chapter, as the files beside it are (`JHN.3.json` for John 3,
   `1CH.0.json` for the whole of 1 Chronicles), and the row for it gains a chevron
   and a 🔗 icon, with one row per entry hanging under it. **Click a
   title to open it in your own web browser** — Chrome, Edge, Safari, whatever you
   normally use — and the site it goes to is shown after the title when the panel is wide
   enough, with the title and the full address on the tooltip either way. Right-click a
   link (or use its **⋮**) for **[en:tran:Open Link in Browser]** and **[en:tran:Copy URL to Clipboard]**. 📸
   A few details worth knowing:
   - A bare address on its own line — `"https://www.example.com/talk"` — is a link that
     titles itself, so a quick list needs no titles at all. An entry with no title shows
     its address as the title.
   - Only **`http`** and **`https`** addresses are offered. Anything else is left out and
     the panel says how many entries it could not read (**1 [en:tran:entry was not understood]**),
     so a typo shows instead of a row quietly going missing.
   - **A `.json` that is not a list of links is just a file.** If it holds other data, or
     is not valid JSON at all, the row keeps the ordinary file icon with no chevron and a
     click opens it in your text editor like any other file — nothing to dismiss.
   - The file is read when its row appears, so editing it on disk and folding the group
     shut and open again shows your change. Files found by the **search** in step 5 are
     read on the first click instead, which is why a link list found that way needs one
     press to show its links.
   - Right-click the `.json` row itself (or its **⋮**) for **[en:tran:Open]** if you want to edit
     the file rather than follow a link.

8. Click a group's header to fold it away; it opens again the next time Resources is shown. Right-click a header
   for **[en:tran:Refresh]** (re-reads that one folder — **[en:tran:Reload]** in step 3 does all of them),
   **[en:tran:Add Folder]**, **[en:tran:Add Files]**, **[en:tran:Reveal in Finder]**/**[en:tran:Reveal in File Explorer]**,
   **[en:tran:Copy to Data Directory]** and **[en:tran:Remove Folder]**, which asks you to confirm and
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
   of the app's data, so it lives and moves with it — **[en:tran:Export Data]** (W-25) carries
   it in a backup, which a folder only listed here does not. It asks first, naming the folder and where
   the copy goes — a `resources` folder inside your data folder (the one Settings calls the
   parent directory). Press **[en:tran:Yes]** and everything in the folder is copied there, sub-folders
   and all, while the progress bar runs; then the group switches to the copy, in the same place
   and open, and a note says where it went. **Your original folder is not
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

> **If a group shows a warning** instead of files: **[en:tran:Folder not found]** means the folder was
> moved, renamed or deleted since you added it (remove it and add it again);
> **[en:tran:Cannot read folder]** means the app is not allowed to read it. **[en:tran:Too many folders to search]**
> means even those two levels held more folders than it could read — point
> Resources at the folder your material is actually in rather than at a whole drive.
> A file you expected that is simply **not listed** is usually more than two folders down:
> add the folder it sits in (or the one above it) as a group of its own.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`RD-81` · `RD-82` · `RD-83` · `RD-84` · `RD-85` · `RD-86` · `RD-87` · `RD-88` · `RD-89` · `RD-90` · `RD-114` · `RD-115` · `RD-116` · `RD-117` · `RD-118` · `RD-119` · `RD-120` · `RD-122` · `RD-127` · `RD-128` · `RD-129` · `RD-130` · `RD-131` · `RD-132` · `RD-133` · `RD-134` · `RD-135` · `RD-137` · `CM-93`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-22).
:::
