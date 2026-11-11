---
name: markdown-preview-window
description: "Resources previews in-app: a `.md` opens markdownPreview.html (HTML parsed then DOMPurify-sanitized, mermaid lazy, locked down; Edit opens a lazy Monaco editor LEFT of the page, which draws the draft; explicit Save); a `.own` lists its notes AND marked verses, notes open bibleNote.html READ-ONLY via `?preview-file=`"
metadata: 
  node_type: memory
  type: project
  originSessionId: 72b344c9-3290-4ac1-967c-af73cbff0484
  modified: 2026-09-17T17:23:04.392Z
---

Added 2026-09-17 at the user's ask (*Resources should support in app preview
for markdown file and Bible-note file… bible-note preview read-only… markdown
popup like bible-note… Mermaid if possible*), extended the same day (*it should
have all like highlight and comments as well*; *the markdown preview should be
rendered*, with the README selected). Matrix `RD-118`/`RD-119`/`RD-127`/`RD-128`, W-37 step 6.

**Markdown** — a new popup page `html/markdownPreview.html` → `src/markdownPreview.tsx`
→ `src/markdown-preview/*`, registered in `htmlFiles` (`electron/fsServe.ts`,
which derives `isPageMarkdownPreview`/`markdownPreviewHomePage`), `PagePropsType`,
`cdp.mjs` page rank, and **`LOCKED_DOWN_PATH_NAMES`** (no `require` in the page;
file read, watch and the editor's save go through the provider bridge, the read
and watch proven live). It does NOT call
`run()` and does not mount `AppWindowToolsComp`. The file path rides
`?preview-file=`. **A row's press opens ANOTHER window every time** (2026-11-10,
the user: _as a user I want to open 2 windows of one resource file so I can read
different parts at the same time_; RD-127): its url uuid is `preview-<random>`, so
`getPopupWindowData` finds no window of that exact URL and the new one cascades
off its group (the same URL minus `uuid`). The 🤖 and the study `preview` open
with the fixed uuid `preview` AND the `appReuseOpen` feature: main raises the
group and opens nothing while any window of that file is open, whatever its uuid.
Following a `.md` link `history.replaceState`s the URL so the group keeps
matching what is on screen. A PDF preview (`openPdfPreview`) works the same way
(`<file name>-<random>` for another; the file name plus `appReuseOpen` for the
Documents list and the 🤖).

- **The security line is `sanitizePreviewHtml` (DOMPurify), not markdown-it.**
  `html: true` since the README ask — a README is mostly `<p align="center">`,
  `<img>`, `<details>` — and EVERY render goes through one DOMPurify instance:
  HTML profile only, no style/form/input/button/textarea/select/option/dialog/
  template, no `srcset`, no `data-*` except `data-mermaid-index`, `style` kept
  only as `text-align` (markdown-it's aligned columns), classes only
  `language-*`/`app-markdown-*`, ids/names `root`/`app-*`/`dapp-*` dropped. Nothing
  may reach `innerHTML` without it. `dompurify` is a direct dependency now (it was
  only mermaid's/monaco's).
- **Image `src` is resolved INSIDE the sanitizer's hooks**: DOMPurify's own URI
  check drops `C:%5Cpics%5Ca.png` (reads as a `c:` scheme), so `uponSanitizeAttribute`
  stashes `toImageSrc(...)` in a WeakMap and drops the attr, and
  `afterSanitizeAttributes` sets it back. `forceKeepAttr` does NOT help — it
  `continue`s before DOMPurify writes a changed value back.
- **A file that shows `\#`/`\*\*` literally is escaped ON DISK** (the user's
  `GEN.1.md` was, likely pasted into an editor's formatted view — Windows Notepad
  does this). CommonMark is right to print them; don't "unescape".
- **Every link press is decided in `classifyMarkdownHref`**, never by the
  browser: `#x` scrolls to `md-heading-x` (ids PREFIXED so a heading can't be
  `id="root"`), then to an `[id]`/`a[name]` the file wrote itself, inside the
  article only; `.md` opens in place with Back, http(s) → `openExternalURL`,
  any other local file is REVEALED (a link to `evil.exe` must never run it).
  markdown-it percent-encodes `C:\` as `C:%5C`, so the drive-path test decodes
  first or it reads as a `c:` scheme.
- **mermaid 12** (new dependency) is `import()`ed only when a block exists,
  `securityLevel: 'strict'`, `suppressErrorRendering: true`. On SUCCESS the SVG
  carries the render `id` — only remove `#id` on failure (a `finally` removing
  it deleted the diagram); the layout wrapper is `#d<id>`.
- Watcher per window, debounced 500 ms, re-armed after each reload (rename-saves),
  with an `'error'` listener. 5 MB size cap read BEFORE the bytes.
- **The file is EDITED in the window** (2026-11-10, the user: _I want the bible
  markdown preview be editable … toggle editing (with monaco markdown)_; chosen
  when asked: an explicit Save; then, on seeing the editor take the page's
  place, _should edit on the left preview on the right_; RD-128). The head's
  **Edit** opens `MarkdownPreviewEditorComp`, a `React.lazy` chunk, in a pane
  LEFT of the page, so Monaco loads at the first press and never in a window
  only read. The page keeps its place in the tree (the pane is a `null` slot
  when closed), so opening or hiding the editor never mounts it again; the
  pencil reads **Hide Editor** while open.
  ONE model address for the window (`markdown-preview-editor`): the model cache
  keeps a model per address after its editor is gone, and toggling back into
  the same draft keeps Monaco's undo. Text lives in refs, not state
  (`savedTextRef` / `draftTextRef`, null when nothing is being edited); a
  keystroke re-renders only when the window flips (un)saved. Two traps fixed
  there: the hook's `onContainerInit` is a new callback each render and React
  re-attaches a changed ref, so the editor's element left the page (and its
  focus) on the first keystroke's re-render -- it is memoised; and Monaco
  rewrites mixed line endings on `setValue`, so the component's own `setValue`
  is not reported as a draft. Save is `fsWriteFile` through the bridge (the
  window is locked down); the window's own Ctrl+S runs wherever the focus is
  unless the editor's action already took the key (`defaultPrevented`). The
  page draws the DRAFT (`renderMarkdownPreviewText`) 500 ms after typing stops
  (a per-window `genTimeoutAttempt`), and at once on Discard, on Hide Editor
  and when a change on disk replaces a clean editor's text (one with unsaved
  words keeps them). **A diagram whose source did not change is kept, not
  drawn again** (`takeDrawnDiagrams` / `putBackDrawnDiagrams`, same theme
  only): drawing them was the whole cost of each re-render, and only the
  pictures on the page being replaced are taken -- nothing is cached between
  renders. While unsaved: Back and Reload are disabled, a `.md` link is
  refused, and `genBlockUnload` holds a close. The
  window has no popup host or `ToastComp` (that would bring `DailyTipComp`), so
  notes go in an inline bar under the head. No new `tran` keys: every label was
  already in all 87 packages (`Edit`, `Hide Editor`, `Save`, `Unsaved changes`,
  `Discard unsaved changes`, the two block-unload sentences, `Error`).
- Driving it: `navigate_page` on the preview target to
  `markdownPreview.html?preview-file=<encoded path>&uuid=preview` previews any
  file (the repo's `README.md` is a good HTML fixture); put the user's file back
  after.

**Bible note** — `.own` rows get a chevron; `ResourcesFileNotesComp` (LAZY-loaded
by the row, so the panel carries none of it until a note file is opened) reads the
file only when opened (16 MB cap). `parseResourceNoteItems` returns, in file
order, `{kind:'note', id, title}` and `{kind:'verse', id, title, verseKey,
bibleKey, isOpened, highlights[{id,text,color}], comments[{id,text,comment}]}` —
never content or offsets; a verse with no valid mark is skipped. A verse row is
drawn with the Bible Notes panel's own mark line, extracted to
`VerseAnnotationLineComp` (its SCSS scoped `.app[data-bs-theme] :is(.app-cue-list,
.app-resources)`; the comment underline is `__text--comment` on the span now, not a
`--comment` class on the `li`), folds to a count, and a mark press lazily imports
`verseAnnotationActionHelpers` → `openVerseBibleItem` (another view beside the
reading; Resources rows keep their state because the box keeps its scan result
while re-scanning). No recolour/edit/delete. `toVerseBibleKey` moved to the
import-free `noteItemHelpers.ts` for this.

A note opens `bibleNote.html?preview-file=<path>&id=<n>` (separate param
from `?file=`, so no URL means "notes-folder file, read-only"). `getNoteAndNoteItem`
returns `isReadOnly`; `initBibleNote` sets `bibleNote.isReadOnly = true` (the
package shows "Read-only mode is locked") AND `saveData` refuses on its own —
the package's toolbar Undo stays enabled, and pressing it live left the file
byte-identical. The insert-passage "Open Bible Lookup" footer button is skipped.
A verse item id is now refused by the note window in both modes.

**Imports:** `bibleNotePreviewHelpers.ts` / `markdownPreviewParamHelpers.ts`
import NOTHING (the lookup panel reads their name checks); the popup openers live
in `src/resources/resourcePreviewOpenHelpers.ts` (pulls `domHelpers`, which has
module-level IPC listeners) and are `import()`ed at the press. A test rendering
`ResourcesFileRowComp` and opening a note file must mock `bibleStyleHelpers` and
`BibleItemsViewController` (they reach `BibleDatabaseController`, which reads
`appProvider.appUtils` at load) and WAIT for the lazy list. Related:
[[resources-panel]], [[resources-json-link-list]], [[verse-marks-note-items]].
