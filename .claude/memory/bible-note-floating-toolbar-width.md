---
name: bible-note-floating-toolbar-width
description: The Bible Note window is the bible-note package's Lexical editor, not a plain textarea (only the note TITLE box is one); note windows open at 870px and CDP resize_page can't resize popups
metadata:
  type: project
---

**The vendored Lexical build is gone; the Lexical editor is not.**
`public/modules/` no longer exists, but the Bible Note window (`src/bibleNote.tsx`)
mounts the `bible-note` package — a Lexical rich-text editor
([[bible-note-editing-history]]) whose own stylesheet still carries
`.floating-text-format-popup`. `src/others/SimpleNoteEditorComp.tsx`, a plain
`<textarea>`, is only the item TITLE box in the Bible Notes list
(`NoteTitleEditorComp` in `src/bible-list/note/NoteEditorComp.tsx`) and the slide
note boxes, never the note window. Whether that popup still needs a wider window
has not been re-checked live.

Still true, and what this note is now about:

- The Bible Note popup window opens at `width: 870`
  (`src/bible-list/note/BibleNoteItemRenderComp.tsx:46`).
- CDP `resize_page` does NOT work on popups — Electron has no
  `Browser.getWindowForTarget`. Resize with `window.resizeTo(1500, 950)` via
  `evaluate_script` instead — which the firewall refuses unless the server was started
  with `OWA_MCP_FIREWALL=off` ([[evaluate-script-disposablestack]]). See also [[cdp-dynamic-import-hijack]].
