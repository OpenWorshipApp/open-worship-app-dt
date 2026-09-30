---
name: resources-json-link-list
description: "A `.json` in a Resources folder is a list of clickable links, decided by its CONTENT and never by its extension"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d512e7b-1d7e-408b-b899-48038f5907ce
  modified: 2026-09-12T16:08:14.353Z
---

A `.json` matched by the Resources panel (`<BOOK>.<CHAPTER>.*`, so `1CH.0.json`) holds a
list of links — `[{ "title": ..., "url": ... }]`, a bare URL string as shorthand — and each
`title` is a row that opens its address in the system browser. Schema + parse + read live in
`src/resources/resourceLinksHelpers.ts`; `docs/schemas/resource-links.schema.json` is the
same rules for an editor; W-37 step 7 and matrix `RD-115` are the user-facing record. Asked
for by the user 2026-09-12, who already had a library of `<BOOK>.0.json` files holding a
title and a YouTube address per video.

**Why:** two decisions are easy to undo by accident.

1. **The extension only makes a row a CANDIDATE; the content decides**
   (`checkIsResourceLinkList` — at least one openable link). The user asked for this in so
   many words: *if not or parsing fail then show it as normal file*. A `.json` that holds
   other data, is not an array, is unreadable, or is over 256KB keeps `bi-filetype-json`,
   gets no chevron, and is handed to the OS like any other row — **with no warning to
   dismiss**, because an error report about the shape of somebody's data file, beside the
   verse they are reading, is not what a shelf is for.
2. **`http(s)` only.** `appProvider.browserUtils.openExternalURL` is `shell.openExternal`
   with no scheme check of its own, and every desktop will launch whatever program has
   registered a scheme — so a `file:`/`smb:`/bespoke URL in a data file that arrived inside
   a shared archive would start a program on the operator's machine. Checked in the parse
   AND again in `openResourceLinkUrl`, which is the call with `openExternal` behind it.

**How to apply:** do not "simplify" the row to trust the extension, do not widen the
scheme allowlist, and do not add a visible error for a `.json` that is not a link list.
Reads are on demand and uncached — as the row appears for a verse match, on the FIRST CLICK
for a free-text search hit, since a one-letter search can put 200 rows on screen and must
not cost 200 file reads. The link button's host label is `aria-hidden` so the accessible
name is the title alone (otherwise it reads `...bare-stringexample.com`), and it is dropped
entirely under a 340px panel by a `@container` query on `.app-resources`. Related:
[[resources-panel]], [[hover-hidden-controls]].
