---
name: bible-note-floating-toolbar-width
description: Bible Note's selection format popup only exists above ~1025px window width; the default note window (870px) never shows it
metadata:
  type: project
---

The Bible Note editor's floating text-format popup (`.floating-text-format-popup`,
from the vendored Lexical build in `public/modules/bible-note/`) is gated behind
the playground's `!isSmallWidthViewport` check — `window.matchMedia('(max-width:
1025px)')`. Below that width the plugin is not rendered at all, so no amount of
selecting text produces the popup.

`handleOpening` in `src/bible-list/note/BibleNoteItemRenderComp.tsx` opens the
note popup window at `width: 870`, i.e. BELOW the threshold — a freshly opened
note window never shows the popup until the user widens it.

**Why:** cost me a long detour while verifying a popup fix — a reopened note
window "reproduced" a dead toolbar that was really just absent by design.

**How to apply:** when testing anything about that popup, first widen the window
(`window.resizeTo(1500, 950)` via CDP works; `resize_page` does NOT — Electron
has no `Browser.getWindowForTarget`), then confirm
`document.querySelector('.floating-text-format-popup')` exists before drawing
conclusions. See also [[cdp-dynamic-import-hijack]].
