---
name: document-html-sanitization
description: "EN-39: raw HTML and composed slides use separate DOMPurify policies; preserve typed media hydration without letting imported HTML impersonate it"
metadata:
  type: project
---

The two policies in `sanitizeHelpers.ts` are deliberately separate (2026-10-05,
EN-39). `sanitizeHtml` handles document/Bible/popup markup and strips embedded
documents and `data-website-*` / `data-camera-*`. `sanitizeSlideHtml` is ONLY for
the output of `SlideRendererComp` after its HTML and Bible items have passed the
raw policy. It keeps the typed hydration markers the Screen manager consumes
and approved sandboxed YouTube embeds. Passing a raw document directly to the
composed policy would undo the hydration protection.

Both policies preserve computed styles, SVG and application Bible attributes.
Electron `file:`, `blob:` and `owa:` URI exceptions apply only to `src` on
img/video/audio/source, never links or frames. Plain Text items escape markup
and preserve newlines; stored documents are not rewritten.

Purifiers initialize lazily so importing text/path helpers in Node needs no DOM;
calling HTML sanitization without a DOM fails closed. No cache of documents is
kept. React memoization holds only the current mounted item's sanitized content,
so moving/resizing a box does not parse it again. Clear DOMPurify's removed-node
list after every call, since it can retain the parsed document tree.

Live checks used an isolated development profile. Pin `OWA_CDP_PORT` on a
dedicated MCP client: another session can restart the user's app, causing
newest-first app tools to leave the scratch process while chrome page ids still
refer to it. A normal popup at `screen.html` does not receive the managed output
window's IPC synchronization; loading that route alone cannot prove projection.
