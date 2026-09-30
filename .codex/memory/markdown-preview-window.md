---
name: markdown-preview-window
description: "Resources previews in-app: a `.md` opens markdownPreview.html (HTML parsed then DOMPurify-sanitized, mermaid lazy, locked down); a `.own` lists its notes AND marked verses, notes open bibleNote.html READ-ONLY via `?preview-file=`"
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
rendered*, with the README selected). Matrix `RD-118`/`RD-119`, W-37 step 6.

**Markdown** — a new popup page `html/markdownPreview.html` → `src/markdownPreview.tsx`
→ `src/markdown-preview/*`, registered in `htmlFiles` (`electron/fsServe.ts`,
which derives `isPageMarkdownPreview`/`markdownPreviewHomePage`), `PagePropsType`,
`cdp.mjs` page rank, and **`LOCKED_DOWN_PATH_NAMES`** (no `require` in the page;
file read + watch go through the provider bridge, proven live). It does NOT call
`run()` and does not mount `AppWindowToolsComp`. The file path rides
`?preview-file=` with a FIXED url uuid `preview`, so a second press focuses the
open window (`getPopupWindowData` dedupes by URL); following a `.md` link
`history.replaceState`s the URL so dedupe keeps matching what is on screen.

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
