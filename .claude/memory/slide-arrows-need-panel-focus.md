---
name: slide-arrows-need-panel-focus
description: "Slide navigation is gated on the slides previewer holding DOM focus; an unowned keyboard (body) is now claimed, and picking a document hands focus back"
metadata:
  node_type: memory
  type: project
  originSessionId: b235b5dc-e5b5-4b4c-8e7b-9404b6966677
  modified: 2026-09-28T23:55:35.255Z
---

`handleSlideMoving` (`src/app-document-presenter/items/varyAppDocumentHelpers.ts`)
only steps a slide while `document.activeElement` is the previewer's own
`.app-slide-items-container`. That gate has to exist — several previewers are
mounted at once (a floating document preview, one pane per lyric stage) and every
one of them gets the key, so without it they would all step together.

What was missing is that nothing handed the focus BACK:

- Every file list is a tab stop of its own (`FileListHandlerComp`'s root carries
  `tabIndex={0}`), so **picking the next song moved focus to the Documents list**
  and the arrows went dead. Measured live 2026-09-28: click a document row →
  `div.app-document-list`; click a slide card → `div.app-slide-items-container`.
- `document.activeElement === null` was written as the rescue and is
  **unreachable** — Chromium parks focus on `<body>`, never on null (blurred the
  container live and read `BODY`). So a popup closing, or this previewer
  re-mounting because the selected document changed kind (lyric ↔ slides ↔ PDF
  render different trees), left the arrows silently dead with a projector
  waiting.

**How to apply:**
- `checkCanMoveSlide` treats `<body>`/null as UNOWNED and claims it with
  `focus({ preventScroll: true })`, but only for `getContainerDiv()` — the first
  previewer in the document — or every mounted one would step at once. Focus
  INSIDE the panel counts as the panel's (its sticky menu button, the slides menu
  row), and `checkIsTypingTarget` defers to any field being typed in.
- `VarySlidesPreviewerComp` claims the keyboard when
  `varyAppDocument.filePath` changes, so picking a document arms the arrows at
  once. Main panel only, never out of a typing target, never when it already has
  focus.
- Still not covered: clicking the ALREADY-selected row, or the list's own chrome,
  leaves focus on that list and the arrows do nothing until a slide card or the
  panel is clicked. Widening it means deciding which focused elements "consume"
  arrows, which is a list that rots.

The other half of the same complaint was [[keyboard-layer-stack-leak]] — that one
killed `Ctrl+B` too.
