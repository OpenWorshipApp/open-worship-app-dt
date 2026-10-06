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
  `breakAfter: 'page'` (`appDocumentPrintHelpers.ts:245`, not a raw CSS rule),
  with `preferCSSPageSize: true`. Slides render UNSCALED.
- **If slide HTML ever needs scaling for print, use CSS `zoom`, not
  `transform: scale()`.** Transform only scales painting; the element keeps its
  full-size layout box, and print fragmentation works on layout coordinates, so
  text/boxes crossing a page boundary get silently dropped (backgrounds/images
  print, text vanishes). Verify via the real Print flow (a `print-preview-*.pdf`
  CDP target appears — screenshot it); an iframe in the presenter is continuous
  media with no fragmentation and does NOT prove the PDF is correct. Entry point:
  `printAppDocument` in `src/app-document-list/appDocumentPrintHelpers.ts`.
