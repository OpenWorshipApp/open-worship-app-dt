---
paths:
  - "**/*Print*"
  - "**/*print*"
  - "electron/electronHelpers.ts"
---

# Printing


- `all:app:print` IPC with an htmlText arg loads the HTML in a hidden
  `BrowserWindow` and runs `previewPrintCurrentWindow` → `printToPDF` → opens a
  "Print Preview" window with the PDF. Load the HTML from a temp `file://` URL,
  NOT a `data:` URL (Chromium caps URLs at 2MB; documents with embedded images
  exceed it and `loadURL` fails silently).
- App/bible-lang @font-face rules must be copied into the print HTML with
  `url()` absolutized (`collectFontFaceCss`) and the electron side must await
  `document.fonts.ready` before `printToPDF`, or glyphs rasterize as fallback.
- Layout: one slide per PDF page, page size == slide px size via
  `@page page-WxH { size: Wpx Hpx; margin: 0 }` + the inline style
  `breakAfter: 'page'` (`genSlidePageHtml` in
  `appDocumentPrintHelpers.ts`, not a raw CSS rule),
  with `preferCSSPageSize: true`. Slides render UNSCALED.
- **A window printed AS ITSELF** — `all:app:print` with no htmlText, File ▸
  Print, Print Without Preview — is `print`/`printToPDF` of that window's own
  DOM, so it needs a `@media print` sheet of its own. Main first runs the
  page's `globalThis.appPreparePrint?.()` (`waitForPagePrintPreparation`;
  the hidden HTML print window is not asked) and prints NOTHING when it
  answers `false` -- the person pressed Cancel on the page's question
  (below). It waits at most 10 minutes (`PAGE_PRINT_PREPARATION_MILLISECONDS`;
  10 s until 2026-11-12, when a person's answer joined the wait and the page
  took over bounding its own diagram wait); a page that throws, or has no
  `appPreparePrint`, prints as it stands. A page that GOES AWAY while main
  waits prints NOTHING: its main frame navigates (a reload or another page,
  `did-start-navigation`; a jump to a heading stays on the page) or its
  renderer ends (`render-process-gone`). Its question went with it
  (2026-11-12: a dev reload under the Markdown Preview's open question had
  main print the NEW page, nobody having answered and not made light;
  Settings' Apply reloads every window the same way). The Markdown
  Preview's (`MarkdownPreviewAppComp.scss`, 2026-11-11, asked as _100%
  printing alike_ then _have to print in light mode_) prints ALWAYS LIGHT:
  `.app[data-bs-theme='dark']` takes `app-light-theme-in-dark`
  (`src/others/theme-light-tokens.scss` — Bootstrap's 52 dark properties set
  to `inherit` so `:root`'s light values come back, then the app's light
  `--app-*` tokens, the same mixin `theme-override-light.scss` uses;
  `themeLightTokens.test.ts` holds both lists). Mermaid bakes its theme into
  the SVG, so `appPreparePrint` (`markdownPrintHelpers.ts`) waits for the
  screen's diagrams, then in a dark window draws each one light in a hidden
  box inside the page (same faces), places it beside its own as
  `--print` (paper only; the screen's gets `--has-print`, hidden on paper)
  and drops them on `afterprint`. The head row's Print runs it itself before
  sending the print. The sheet also hides the head row (its **Sections**
  list with it), the editor, the page's arrow back to the top
  (`.app-to-the-top`, `ScrollToTopComp`: absolute in the corner of
  `.app-markdown-preview-body`, the whole document's height on paper, so
  it would print after the last line, faint once the page had scrolled) and
  everything outside `#root` (the agent's fixed `#owa-agent-notice-host`
  note printed on every sheet), undoes `.app`'s `100vh !important` and the scroll box, sets
  `@page { margin: 0 }` with a `position: fixed` `::before` painting
  `--bs-body-bg` (repeated per sheet; `<html>` carries no `data-bs-theme`),
  and `box-decoration-break: clone` padding for every sheet's top and foot.
  **Blink answers `prefers-color-scheme` with LIGHT while printing**, so a
  window on the System theme flips light mid-print through the `matchMedia`
  listener; a window that paints its paper itself calls
  `keepThemeWhilePrinting()` (`themeHelpers.tsx`) so it is not redrawn
  mid-print — every other window still flips. Verify by rendering the
  `print-preview-*.pdf` (the viewer takes no synthetic keys; `mupdf` in
  node_modules renders pages) and diffing a dark window's PDF against the
  same page's light one — pixel-identical on 2026-11-11. File ▸ Print /
  Ctrl+P in that window can only be pressed for real: it has no Node, so
  `owa_menu` cannot ask from it, and a key sent over the debugging
  connection (`Input.dispatchKeyEvent`) never reaches a menu accelerator.
  To set the paper beside the SCREEN, draw the page as wide as the paper's
  (8.5in less 2 × 0.6in = 700.8 px: a 748 px viewport with no scrollbar
  gives 700) -- a line that fits one and not the other wraps differently.
  owa-devtools' `emulate` viewport fails (chrome-devtools-mcp 1.12 parses
  its arguments twice) and `resize_page` needs `Browser.getWindowForTarget`,
  which Electron lacks, so set `Emulation.setDeviceMetricsOverride` over
  the debugging connection and clear it after. mupdf's `getPixels()` is a
  view into WebAssembly memory that detaches when it grows: copy it.
- **A Markdown Preview page that names verses, people or places ASKS before
  it prints** (2026-11-12, the user: _when print if there bible verses and
  names, let ask user do they want to print those information. if yes then
  append to the last page with list of bible and name/location detail_).
  `preparePrint` (`MarkdownPreviewAppComp.tsx`) collects the page's
  `.app-markdown-ref` links (`collectPrintReferences`,
  `markdownPrintAppendixHelpers.ts`: by `findMarkdownRef`, de-duplicated in
  page order, a file left out) -- the module imported only when the page has
  a link -- and shows `MarkdownPrintAskComp`, the window's own small dialog
  (this window runs none of the app's popups), hidden on paper: **Add and
  Print** (focused) / **Print Page Only** / **Cancel** (Esc, and a question
  left 5 minutes unanswered). Cancel answers main `false`. **Add and Print**
  reads only then (`readPrintAppendix`, `markdownPrintAppendixReadHelpers.ts`,
  a second dynamic import): a verse through `bibleRenderHelper.toVerseTextList`
  -- not `bibleVerseHelpers.ts`, which brings the Reader's controller -- in
  the installed Bible named in brackets right after it
  (`John 3:1-36 (Amplified)`: `findWrittenBibleKey` in
  `markdownPreviewReferenceHelpers.ts` reads it through `findStudyBible` and
  marks the link `isBibleNamed`), else
  the Bible whose book names it was written in, else KJV, else the first
  installed, `??` (a verse the Bible lacks) left out, 6 000 characters a
  passage; a passage that one printed BEFORE it holds whole, as far as that
  one went on paper, is not printed again and not counted as left out
  (`readVerseEntries`: a study names the verses of the chapter it quotes at
  its top, and on the user's John 3 study every one of them was a chapter
  read and a passage printed twice -- 26 sheets, 23 with the rule; only one
  already printed covers, because a long one is cut and only then is it
  known where). It holds a reference read from its own Bible, or -- one
  that names no Bible -- from any Bible of the same language (`toLocaleLang`,
  the part of the Bible's `locale` before `-`/`_`; a Bible whose locale names
  none holds only its own). Held by its own Bible alone, the study's
  second-language part, its chapter headed with one of that language's
  Bibles in brackets, was printed AGAIN from the first Bible that writes the
  book as it does: eight passages more, 25 sheets, 23 since 2026-11-12. Such
  a reference that STARTS inside a passage printed before it from a Bible of
  its language, and is not held by it (cut short, or run past), is read from
  that passage's Bible (`findCarryingBibleKey`; the Bible it would have been
  read from when that one cannot read it): the study's `John 3:31-36`, after
  the Amplified chapter stopped at verse 31, had printed from the KJV. A
  person or
  place through `acquireLookupData`, released in a `finally` the moment its
  records are read (the names dataset is ~34 MB; the window's heap measured
  105 MB, 163 MB while reading, 106 MB after a GC). At most 60 printed
  passages and 80 records; past a cap or unreadable is counted in one closing
  line. The
  appendix (`addPrintAppendix`) is built of text nodes only, the last child of
  `.app-markdown-body`, hidden on screen and shown by `@media print` -- after
  the page's last line with no page break of its own, each person or place
  kept whole on a sheet -- and removed on `afterprint`, at the next print's
  start, or with the page drawn again. **Asked once per print**: the head
  row's Print prepares first and stamps the time, so main's own
  `appPreparePrint` call within 10 s (`PREPARED_PRINT_MILLISECONDS`) answers
  `true` at once; a call while one is being asked answers `false`. Each
  diagram wait inside the page is bounded at 10 s (`waitAtMost`), which is
  what lets main wait 10 minutes for a person.
- **The head row's Word button writes the page as a `.docx`, asking the
  same question Print does** (2026-11-14, the user: _add ms-word icon to
  click and export to microsoft word, like printing it has to as for add
  name/location-name bible detail at the end of last page_). It sits after
  Print, Word blue, and shares Print's road up to the paper:
  `holdPageForOutput` + `readyPageForOutput(printHold, 'word')`
  (`MarkdownPreviewAppComp.tsx`) draw the page, ask in Word's words
  (`MarkdownPrintAskComp`'s `purpose: 'word'` -- **Add and Export** /
  **Export Page Only** / **Cancel**), read the appendix only on Add and wait
  for the diagrams, the light copies a dark window draws included. Nothing
  prints, so no `afterprint` cleans up: the handler's `finally` removes the
  light copies (`removeLightDiagramsForPrint`) and releases the page. The
  appendix is built DETACHED (`genPrintAppendixElement`, the same text nodes
  `addPrintAppendix` puts on paper) and never touches the page. Three dynamic
  imports, none on the window's static closure: `markdownWordHelpers.ts`
  turns the drawn DOM into WordprocessingML in one synchronous pass
  (`snapshotMarkdownWordPage`: headings with bookmarks a `#` link reaches,
  lists as numbering, tables with a repeated header row, quotes, code,
  links, pictures as tokens); `markdownWordMediaHelpers.ts` loads each
  picture only while it is written -- a PNG/JPEG/GIF/BMP as it is (a JPEG
  the camera turned by EXIF is redrawn), anything else redrawn on a canvas,
  a diagram's SVG drawn at 2x from a `data:` URL (a `blob:` one TAINTS the
  canvas once a `foreignObject` label is in it) with the page's
  `@font-face` fonts it names embedded, as an SVG drawn as a picture
  reaches no web font; `markdownWordExportHelpers.ts` streams the zip
  (`OfficeZipWriter` into `createOfficeFileSink`, shared with the
  PowerPoint export) to Downloads as `<file name>.docx`, the next free name
  when taken, deletes a half-written file on failure and reveals the result.
  A language's face and direction come from the INSTALLED language data
  (`genWordTextLangPicker`: `checkIsThisLang`, `checkIsRtl`), never a script
  table in code; the paper is Letter in a Letter region, else A4
  (`genWordPageSize`). The XML escapes it shares with the Bible export live
  in the leaf `officeXmlHelpers.ts`: `docxHelpers.ts` imports the file
  helpers, which reach `appProvider`.
- **Nothing of a Markdown Preview page is left off its paper** (2026-11-12,
  the user's goal _print preserve content_). Each way it was lost was found
  by checking a printout against its page -- every word of the page, read
  from DOMSnapshot, against the PDF's text, each sheet's pictures and any
  character off its sheet, with `mupdf` -- and each is fixed:
  - A fold closed on screen printed closed. Chromium hides a closed
    `<details>`' content through `::details-content` with
    `content-visibility: hidden`; the print sheet sets it `visible` and
    marks the summary `disclosure-open`. The window keeps it closed.
  - A diagram's label of one long word was cut on screen AND on paper (the
    user's John 3 study read `Judgment/Peris`). Mermaid measures a label in
    a wrapper of its own on `<body>`, with normal wrapping, and the page's
    `overflow-wrap: anywhere` broke the word onto a second line that the
    one-line label box hid. `.app-markdown-mermaid` takes
    `overflow-wrap: normal`.
  - Words typed in the half second before Print were not drawn yet: the
    page beside the editor is drawn once the typing pauses
    (`DRAFT_PREVIEW_MILLISECONDS`). `preparePrint` draws a pending draft
    first (`drawPageForPrint`, `isDraftDrawPendingRef`) and goes on once
    THAT render is on the page (`printDrawRef`, matched by the render
    itself, so the effect of an earlier one cannot answer for it). The
    draw that waited on the typing is called off: it would only draw the
    same words again after the print.
  - A page printed before its verses, people and places were made links
    printed without asking. The question waits for the page's
    `decoratePageReferences` (`pageReferencesRef`).
  - Pictures far down a page just drawn -- opened, reloaded, typed into --
    were blank space on paper: `loading="lazy"` fetches a picture only
    once it is scrolled near, and `printToPDF` does not wait for one.
    `loadPicturesForPrint` (`markdownPrintHelpers.ts`) sets every picture
    not fetched yet `eager` and waits for each to load or fail -- for a
    print only, so a page never printed fetches nothing it does not show.
  - A page drawn again in the middle of a print -- a save beside it, a
    pause in the typing, a reload, Edit or Hide Editor -- lost what the
    print had put in it (the light diagrams, the pictures fetched for
    paper, the appendix) and went on paper half drawn. From the moment a
    print is asked for until the paper is made, every draw of the page
    but the print's own goes through `showLoadResult`, which keeps the
    last one (`printHoldRef`) and draws it once the print is done
    (`releasePageAfterPrint`): on `afterprint` -- `printToPDF` fires it
    too, seen 2026-11-12 about 0.2 s before the Print Preview opened --
    at once on Cancel, and 10 s after the page was ready when main never
    prints (`PRINT_HOLD_MILLISECONDS`). The file is still read and the
    editor still follows; only the page waits. A print that starts while
    one still holds the page draws what it held first. A theme switched
    mid-print is not held: the diagram wait's loop waits for that page
    in its turn. Seen live the same day: a line saved under the question
    was not drawn for 2.5 s, came 60 ms after Cancel, and after Print
    Page Only was not in the PDF.
  - Found in the code rather than on paper (2026-11-13): a page printed
    the moment its window opened carried its diagrams' SOURCE. A
    diagram is drawn only once the languages' faces are read
    (`useLangFontFamilies` -> `initAllLangCss`: mermaid measures a label
    in the face it is given), and until then there was no drawing for a
    print to wait for (`diagramPassRef` null). While the page holds a
    diagram not drawn yet (`checkHasUndrawnDiagrams`,
    `markdownMermaidHelpers.ts`) and no drawing has started,
    `waitForDiagramsForPrint` waits for the draw effect to start one
    (`diagramPassWaitRef`), 10 s at most; a page with no diagram never
    waits. The faces come once per window, so nothing draws the page
    again for them after that wait. Unit-tested. Live the same day, on an
    English scratch profile, the faces were known 0.7 s after the window
    opened, before Print could first be pressed: the wait is not reached
    there. A print pressed at that first moment waited for the diagram
    still being drawn and its light copy, and the paper held the drawn
    diagram, none of its source.
  - Reading a printout's TEXT misses words that ARE on the sheet, so a
    word the PDF's text lacks is not yet a word lost. A diagram part
    Chromium prints as a picture (a timeline's event boxes) holds its
    words as pixels: look at the sheet. A syllable whose vowel is drawn
    in two pieces around its consonant (seen with Khmer) is read back
    twice, each piece mapping to the whole syllable: read a syllable
    written twice in a row once, on both sides. On the John 3 study
    (2026-11-13, Add and Print, 21 sheets) the text lacked 39 of 1357
    words: 17 diagram labels, each seen on its sheet, and 22 phrases
    found once their doubled syllables were read once -- none lost.
    The person's own app the same day (24 sheets) lacked the same 39, of
    1363. Hold a label against the PAGE before calling it cut: a long
    second-language timeline label ran past its box and under the next
    one on paper, and did the same on screen -- the diagram's own
    drawing, not the print. Fixed the same day: mermaid breaks a
    timeline's label at whitespace only, and the app now gives it a break
    between two touching words (`mermaidTimelineBreakHelpers.ts`, memory
    `markdown-preview-window`); that label is two lines inside its box,
    on screen and on paper.
  Each wait is bounded at 10 s (`PRINT_PAGE_WAIT_MILLISECONDS`). Beside
  them, the page's article and its status box are keyed apart: the page's
  words are put in outside React, which kept them in a status box made of
  the same element, so a file deleted while shown read as its whole old
  page with _File not found_ under the last line. **To try a print of
  typed words live**, keys sent over CDP never reach the editor of a window
  in the background, focus emulated or not; a text DROPPED on it
  (`Input.dispatchDragEvent`, `text/plain`) changes the draft as typing
  does -- that drop left a literal `$0` after the words.
- **If slide HTML ever needs scaling for print, use CSS `zoom`, not
  `transform: scale()`.** Transform only scales painting; the element keeps its
  full-size layout box, and print fragmentation works on layout coordinates, so
  text/boxes crossing a page boundary get silently dropped (backgrounds/images
  print, text vanishes). Verify via the real Print flow (a `print-preview-*.pdf`
  CDP target appears — screenshot it); an iframe in the presenter is continuous
  media with no fragmentation and does NOT prove the PDF is correct. Entry point:
  `printAppDocument` in `src/app-document-list/appDocumentPrintHelpers.ts`.
