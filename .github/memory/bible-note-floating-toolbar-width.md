---
name: bible-note-floating-toolbar-width
description: The Bible Note selection-format popup no longer exists — the note editor is a plain textarea now; note windows still open at 870px and CDP resize_page still can't resize popups
metadata:
  type: project
---

**The Lexical toolbar era is over.** The vendored Lexical build
(`public/modules/`) and its `.floating-text-format-popup` no longer exist
anywhere in the repo — the note editor is now
`src/others/SimpleNoteEditorComp.tsx`, a plain `<textarea>` (line ~176), reached
via `src/bible-list/note/NoteEditorComp.tsx`. There is no selection-format popup
at ANY window width, so any "widen the window to see the format popup" advice is
obsolete.

Still true, and what this note is now about:

- The Bible Note popup window opens at `width: 870`
  (`src/bible-list/note/BibleNoteItemRenderComp.tsx:46`).
- CDP `resize_page` does NOT work on popups — Electron has no
  `Browser.getWindowForTarget`. Resize with `window.resizeTo(1500, 950)` via
  `evaluate_script` instead. See also [[cdp-dynamic-import-hijack]].
