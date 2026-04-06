# D3 DOCX Import and Conversion Guide

## Scope

This guide covers the DOCX import and conversion workflow used by Open Worship to present `.docx` files as static, page-based content.

Use it when changing:

- DOCX file detection and discovery
- DOCX cached HTML preview generation
- Electron IPC channels for DOCX conversion
- worker scripts in `public/js/`
- the .NET helper interface in `extra-work/bin-helper/`
- presenter rendering of DOCX pages

Do not use this guide for editable slide workflows. DOCX documents are intentionally non-editable in this app.

## Runtime Layers

The DOCX flow crosses four layers.

### 1. Renderer document model

- `src/app-document-list/DocxAppDocument.ts`
- `src/app-document-list/DocxSlide.ts`
- `src/server/docxHelpers.ts`

These files decide how a DOCX file appears inside the app and how cached conversion output is loaded.

### 2. Renderer presentation layer

- `src/app-document-presenter/items/DocxSlideRenderComp.tsx`

This renders converted DOCX pages inside iframes.

### 3. Electron bridge and workers

- `electron/electronEventListener.ts`
- `electron/msHelpers.ts`
- `public/js/docx-to-htmls.js`
- `public/js/get-docx-to-htmls-version.js`

These files move the request from renderer to worker and then into the helper.

### 4. Bundled helper pipeline

- `extra-work/bin-helper/Helper.cs`
- `extra-work/bin-helper/build.sh`
- bundled `DocxToHtml.dll`

This is where the real DOCX-to-HTML conversion implementation is bridged into Node/Electron.

## File Discovery and Import Entry Points

DOCX discovery starts in the app-document list flow.

- `src/app-document-list/appDocumentHelpers.tsx` contains DOCX detection helpers.
- `src/app-document-list/VaryAppDocumentListComp.tsx` identifies `.docx` files and excludes temporary lock files.
- `src/app-document-list/VaryAppDocumentFileComp.tsx` exposes DOCX-specific file actions such as refresh.
- `varyAppDocumentFromFilePath()` routes `.docx` files into `DocxAppDocument.getInstance(filePath)`.

Important rule: lock files created by Office, such as names starting with `~$`, must remain filtered out or the UI will show broken phantom documents.

## DOCX Document Model

### DocxAppDocument

`src/app-document-list/DocxAppDocument.ts` is the main renderer-side document wrapper.

Key behaviors:

- `isEditable = false`
- `getSlides()` reads cached conversion output through `getDocxData()`
- compares the cached `toolVersion` with the current helper version
- invalidates stale cache by calling `removeDocxHtmlsPreview()`
- prepends a synthetic `slide0.html` title page when slides exist
- `preDelete()` removes the cached preview directory

This class is instance-pooled, so multiple callers for the same file path share the same JS object.

### DocxSlide

`src/app-document-list/DocxSlide.ts` wraps one converted DOCX page.

It contains:

- `id`
- `htmlFilePath`
- `metadata.width`
- `metadata.height`

It supports drag serialization but not clipboard-based editable content.

## Cached Preview Directory and Metadata

Renderer-side cache helpers live in `src/server/docxHelpers.ts`.

### Output directory

`toDocxHtmlsPreviewDirPath(filePath)` creates a sibling directory named:

- `{original-name}-docx-htmls`

### Main files in the cache

- `info.json`
- one HTML file per converted page

### Cache semantics

`getDocxData(filePath)`:

1. computes the DOCX file MD5
2. reads `info.json`
3. validates the cached checksum
4. deletes and rebuilds the cache if missing or stale
5. retries conversion up to three times
6. maps relative HTML file names to full file paths

### Tool version handling

`getDocxToHtmlsVersion()` caches the helper version in memory.

`DocxAppDocument.getSlides()` compares that version against `docxData.info.toolVersion`. If they differ, it clears the preview cache and returns an empty slide list until the document is rebuilt.

## Renderer-to-Electron Flow

The renderer starts DOCX conversion through `src/server/docxHelpers.ts`.

### Renderer call

`docxToHtmls(filePath, outDir)` calls:

- `electronSendAsync('main:app:docx-to-htmls', { filePath, outDir })`

`getDocxToHtmlsVersion()` calls:

- `electronSendAsync('main:app:get-docx-to-htmls-version')`

### Main-process wiring

`electron/electronEventListener.ts` registers:

- `main:app:docx-to-htmls`
- `main:app:get-docx-to-htmls-version`

Both go through the repo's custom `onAsync()` wrapper, so `replyEventName` is mandatory for correct async replies.

### Electron helper layer

`electron/msHelpers.ts`:

- resolves `modulePath`, `binaryPath`, and `dotnetPath`
- calls worker scripts with `execute()`
- uses `unlocking()` to prevent concurrent conversion of the same file

## Worker Scripts and .NET Helper

### Worker scripts

- `public/js/docx-to-htmls.js`
- `public/js/get-docx-to-htmls-version.js`

The DOCX worker:

1. receives the conversion payload over `process.on('message')`
2. loads the helper through `getMSHelper()`
3. calls `msHelper.docxToHtmls(filePath, outputDirectory)`
4. replies with `{ isSuccessful, message? }`

### Helper bridge

`extra-work/bin-helper/Helper.cs` exports:

- `DocxToHtmls(string docxPath, string outputDirectory)`
- `GetDocxToHtmlsVersion()`

The actual conversion logic lives behind the bundled helper DLLs, especially `DocxToHtml.dll`.

## Rendering and Presenter Integration

DOCX rendering is HTML-based, not image-based.

- `src/app-document-presenter/items/DocxSlideRenderComp.tsx` renders the converted page inside an `iframe`
- the iframe source comes from the converted HTML file path through `FileSource.src`
- layout preserves aspect ratio based on page metadata
- pointer-events differ between screen pages and non-screen pages based on `appProvider.isPageScreen`

This is a key difference from PDF rendering, which is image-based.

## Relation to PPTX and PDF

DOCX sits between the PPTX and PDF flows conceptually.

### Like PPTX

- uses the .NET helper path
- uses worker scripts under `public/js/`
- uses version-aware cached conversion output

### Like PDF

- appears as static, page-based, non-editable presentation content in the UI

### Unlike editable slides

- DOCX documents do not participate in the canvas editor or editable slide pipeline
- methods like `setSlides()` and `setMetadata()` intentionally throw

## Change Routing Guide

### Change DOCX file discovery or refresh actions

- edit `src/app-document-list/VaryAppDocumentListComp.tsx`
- edit `src/app-document-list/VaryAppDocumentFileComp.tsx`
- check `src/app-document-list/appDocumentHelpers.tsx`

### Change cache invalidation, info parsing, or retry behavior

- edit `src/server/docxHelpers.ts`
- check `DocxAppDocument.ts` version-mismatch handling

### Change Electron DOCX IPC or worker parameters

- edit `electron/electronEventListener.ts`
- edit `electron/msHelpers.ts`
- edit `public/js/docx-to-htmls.js`

### Change helper versioning or actual conversion output

- edit `extra-work/bin-helper/Helper.cs`
- rebuild the helper with `bash extra-work/bin-helper/build.sh`
- rebuild Electron assets with `npm run electron:build`

### Change how DOCX pages render in presenter or screen views

- edit `src/app-document-presenter/items/DocxSlideRenderComp.tsx`
- check any shared document-preview wrappers around it

### Change DOCX page metadata shape

- edit `src/app-document-list/DocxSlide.ts`
- update `DocxSlideSchema.json`
- update `src/server/docxHelpers.ts` metadata loading

## Important Invariants

- DOCX is read-only in the app.
- DOCX cached output lives in a sibling `-docx-htmls` directory.
- `info.json.checksum.md5` must match the current DOCX file.
- tool-version mismatch should invalidate stale cache.
- DOCX conversion uses the custom async IPC reply-event pattern.
- one file should not be converted concurrently by multiple callers.

## Known Gotchas

- Office lock files must stay filtered.
- forgetting the helper rebuild step causes confusing stale behavior even if TypeScript code is correct.
- iframe rendering means DOM/CSS assumptions do not match editable slide or PDF rendering code.
- `slide0.html` is synthetic and added at runtime, not produced by `info.json`.
- the retry loop in `getDocxData()` can make failures look slow rather than immediate.
- DOCX and PPTX share patterns, but DOCX has a simpler page model and no PPTX-style sub-html assets.

## Validation Checklist

After changing the D3 DOCX flow, manually verify at least these steps:

1. Import or refresh a real `.docx` file in the document list.
2. Confirm lock files are not shown as real documents.
3. Open the DOCX and verify slides/pages appear.
4. Trigger `Refresh DOCX Pages` and confirm the cache rebuilds.
5. Verify a changed DOCX file invalidates the old cache.
6. Check presenter rendering and screen rendering behavior.
7. If helper or worker code changed, verify version-check behavior.

Also run the mocked Electron tests that cover this area when relevant:

- `npm run test:electron`

Use `npm run build` after changes that affect renderer plus Electron or the helper packaging surface.
