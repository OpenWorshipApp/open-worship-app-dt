---
name: d3-docx-import-conversion
description: 'Open Worship D3 DOCX import and conversion workflow. Use when working on DocxAppDocument, DocxSlide, docxHelpers, DOCX file discovery, cached HTML preview generation, docx-to-htmls worker scripts, Electron DOCX IPC handlers, or the .NET DOCX helper pipeline.'
argument-hint: 'Optional focus area, for example: discovery, cache, rendering, ipc, worker, helper, or validation.'
user-invocable: true
---

# D3 DOCX Import and Conversion

Use this skill for tasks centered on DOCX import, conversion, cache invalidation, and presentation rendering.

## When to Use

- You are changing how `.docx` files are discovered, filtered, or opened in the app.
- You are changing DOCX cached preview generation or invalidation.
- You are changing the Electron worker flow for `docx-to-htmls` or `get-docx-to-htmls-version`.
- You are changing the .NET helper contract or DOCX conversion output.
- You are changing DOCX slide rendering, refresh behavior, or presenter integration.

## Procedure

1. Read [d3-docx-import-conversion-guide.md](./references/d3-docx-import-conversion-guide.md).
2. Classify the change before editing:
   - File discovery or UI refresh: `src/app-document-list/`
   - Renderer cache and conversion calls: `src/server/docxHelpers.ts`
   - Document model and slide wrappers: `DocxAppDocument.ts`, `DocxSlide.ts`
   - Electron IPC and worker invocation: `electron/electronEventListener.ts`, `electron/msHelpers.ts`, `public/js/docx-to-htmls.js`
   - Helper implementation or versioning: `extra-work/bin-helper/`
   - Presentation rendering: `src/app-document-presenter/items/DocxSlideRenderComp.tsx`
3. Preserve core invariants:
   - DOCX is read-only and page-based in the UI.
   - Cached HTML output lives in a sibling `-docx-htmls` directory with `info.json` metadata.
   - Async DOCX IPC must keep the custom `replyEventName` flow intact.
   - Helper changes require both helper rebuild and Electron rebuild before runtime testing.
4. Validate with mocked tests where available, then do manual DOCX import and refresh checks because end-to-end DOCX coverage is limited.

## References

- [d3-docx-import-conversion-guide.md](./references/d3-docx-import-conversion-guide.md)
