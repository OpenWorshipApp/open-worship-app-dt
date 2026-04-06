# Open Worship Functionality Inventory

This file is a feature checklist for breaking the repository into smaller AI skills or focused work prompts.

Recommended usage:

1. Pick one functionality block.
2. Use its ID and name in the next prompt.
3. Build or refine a dedicated skill for that block without mixing unrelated areas.

Status labels:

- `production`: actively part of the main app surface.
- `supporting`: infrastructure or cross-cutting capability that supports product features.
- `experimental`: present in the repo, but should be verified before treating it as a stable product feature.

## 1. Presentation and Slide Workflows

### `P1` Presenter workspace

- Status: `production`
- What it does: main presentation workspace with left, middle, and right panes for controlling content and previewing output.
- Main locations: `src/presenter/`, `src/presenter.tsx`, `html/presenter.html`

### `P2` Custom slide documents

- Status: `production`
- What it does: native editable slide documents and document/slide models.
- Main locations: `src/app-document-list/`, `src/app-document-editor/`, `src/appDocumentEditor.tsx`

### `P3` Canvas slide editor

- Status: `production`
- What it does: drag, resize, rotate, position, and edit slide items on a visual canvas.
- Main locations: `src/slide-editor/`, `src/slide-editor/canvas/`, `src/slide-editor/BoxEditorController.ts`
- Dedicated skill: [p3-canvas-slide-editor](../../p3-canvas-slide-editor/SKILL.md)

### `P4` Slide previews and thumbnails

- Status: `production`
- What it does: preview slide layouts, vary-slide previews, and document preview UIs.
- Main locations: `src/app-document-presenter/`, `src/slide-editor/SlideEditorPreviewerComp.scss`, `src/app-document-presenter/items/`

### `P5` Playlist sequencing

- Status: `production`
- What it does: organize documents/slides into ordered presentation sequences.
- Main locations: `src/playlist/`

### `P6` Slide autoplay and timing

- Status: `production`
- What it does: automatic slide progression and timing-driven presentation flow.
- Main locations: `src/slide-auto-play/`

### `P7` Undo and editing history

- Status: `production`
- What it does: editing history, undo, redo, and edit-state support.
- Main locations: `src/editing-manager/`

## 2. Screen Output and Live Display

### `S1` Multi-screen management

- Status: `production`
- What it does: create, position, show, hide, and assign external screen windows.
- Main locations: `electron/ElectronScreenController.ts`, `src/_screen/`, `electron/electronEventListener.ts`

### `S2` Screen background system

- Status: `production`
- What it does: control solid-color, image, video, and camera-backed backgrounds.
- Main locations: `src/background/`, `src/_screen/ScreenBackgroundComp.tsx`, `src/_screen/ScreenBackgroundImageComp.tsx`, `src/_screen/ScreenBackgroundVideoComp.tsx`

### `S3` Screen Bible rendering

- Status: `production`
- What it does: render Bible passages on audience screens with screen-specific styling.
- Main locations: `src/_screen/ScreenBibleComp.tsx`, `src/_screen/managers/ScreenBibleManager.ts`

### `S4` Screen foreground overlays

- Status: `production`
- What it does: render foreground text or lyric overlays on top of screen content.
- Main locations: `src/_screen/ScreenForegroundComp.tsx`, `src/_screen/managers/ScreenForegroundManager.ts`

### `S5` Screen document rendering

- Status: `production`
- What it does: show slides and imported document pages on audience screens.
- Main locations: `src/_screen/ScreenVaryAppDocumentComp.tsx`, `src/_screen/managers/ScreenVaryAppDocumentManager.ts`

### `S6` Transition and screen effects

- Status: `production`
- What it does: visual transitions and effect helpers between screen states.
- Main locations: `src/_screen/RenderTransitionEffectComp.tsx`, `src/_screen/transitionEffectHelpers.ts`, `src/_screen/managers/ScreenEffectManager.ts`

### `S7` Screen timers and clocks

- Status: `production`
- What it does: countdown, stopwatch, and timing state used during live presentation.
- Main locations: `src/_screen/managers/CountdownController.ts`, `src/_screen/managers/StopwatchController.ts`, `src/_screen/managers/TimingController.ts`

## 3. Bible Reading, Lookup, and Search

### `B1` Bible reader

- Status: `production`
- What it does: browse and read Bible passages in the main app.
- Main locations: `src/bible-reader/`, `src/reader.tsx`, `html/reader.html`

### `B2` Bible lookup popups

- Status: `production`
- What it does: quick lookup of verses/passages from other app flows.
- Main locations: `src/bible-lookup/`, `src/app-modal/`

### `B3` Bible search

- Status: `production`
- What it does: text search across Bible data and result browsing.
- Main locations: `src/bible-find/`, `electron/client/databaseUtils.ts`
- Detailed guide: [b3-bible-search-guide.md](./b3-bible-search-guide.md)

### `B4` Bible cross references

- Status: `production`
- What it does: show related verses and cross-reference previews.
- Main locations: `src/bible-cross-refs/`

### `B5` Bible persistence layer

- Status: `supporting`
- What it does: renderer-side Bible data storage on IndexedDB.
- Main locations: `src/db/databaseHelpers.ts`, `src/helper/bible-helpers/BibleDatabaseController.ts`

### `B6` Bible translation/source settings

- Status: `production`
- What it does: select and manage Bible-related settings and sources.
- Main locations: `src/setting/bible-setting/`

### `B7` Bible screen styling

- Status: `production`
- What it does: configure Bible text appearance for audience display.
- Main locations: `src/screen-setting/`

## 4. Lyrics and Song Presentation

### `L1` Lyric editor

- Status: `production`
- What it does: create and edit lyric-based presentation content.
- Main locations: `src/lyric-list/`, `src/lyricEditor.tsx`, `html/lyricEditor.html`

### `L2` Lyric preview and slide splitting

- Status: `production`
- What it does: preview lyric layouts and slide segmentation.
- Main locations: `src/lyric-list/LyricPreviewerComp.tsx`, `src/lyric-list/LyricSlidesPreviewerComp.tsx`

### `L3` Lyric library and files

- Status: `production`
- What it does: store, browse, and manage lyric files and related UI.
- Main locations: `src/lyric-list/`

### `L4` Lyrics on audience screens

- Status: `production`
- What it does: render lyrics as screen foreground or presentation content.
- Main locations: `src/_screen/ScreenForegroundComp.tsx`, `src/_screen/managers/ScreenForegroundManager.ts`

## 5. Documents, Conversion, and File Formats

### `D1` PDF document import and preview

- Status: `production`
- What it does: import PDFs, count pages, render previews, and present PDF pages.
- Main locations: `src/app-document-list/PdfAppDocument.ts`, `src/app-document-list/PdfSlide.ts`, `electron/pdfToImagesHelpers.ts`, `public/js/pdf-to-images.mjs`, `public/js/count-pdf-pages.mjs`

### `D2` PPTX import and conversion

- Status: `production`
- What it does: convert PowerPoint files into presentable HTML-backed slide content.
- Main locations: `src/app-document-list/PptxAppDocument.ts`, `electron/msHelpers.ts`, `public/js/pptx-to-htmls.js`, `extra-work/bin-helper/`

### `D3` DOCX import and conversion

- Status: `production`
- What it does: convert DOCX files into rendered content and cached previews.
- Main locations: `src/app-document-list/DocxAppDocument.ts`, `src/app-document-list/DocxSlide.ts`, `electron/msHelpers.ts`, `public/js/docx-to-htmls.js`, `extra-work/bin-helper/`
- Dedicated skill: [d3-docx-import-conversion](../../d3-docx-import-conversion/SKILL.md)

### `D4` Office-to-PDF conversion

- Status: `production`
- What it does: convert office documents to PDF via LibreOffice integration.
- Main locations: `electron/electronOfficeHelpers.ts`

### `D5` Word export for Bible content

- Status: `production`
- What it does: export Bible content to DOCX files.
- Main locations: `public/js/export-bible-ms-word.js`, `electron/msHelpers.ts`, `src/server/appHelpers.ts`

### `D6` PowerPoint slide utilities

- Status: `production`
- What it does: count slides and remove PowerPoint slide backgrounds.
- Main locations: `public/js/count-ms-pp-slides.js`, `public/js/remove-ms-pp-slides-bg.js`, `electron/msHelpers.ts`

### `D7` Worker process execution layer

- Status: `supporting`
- What it does: fork child processes for conversion and media tasks.
- Main locations: `electron/processHelpers.ts`, `public/js/`

### `D8` Bundled .NET helper pipeline

- Status: `supporting`
- What it does: provide helper binaries, runtime assets, and converter support for Office-related workflows.
- Main locations: `extra-work/bin-helper/`, `extra-work/bin-helper/Helper.cs`, `extra-work/bin-helper/build.sh`

## 6. Media, Downloads, and Background Assets

### `M1` Video and audio download

- Status: `production`
- What it does: download media from remote URLs for offline use through yt-dlp integration.
- Main locations: `src/server/appHelpers.ts`, `electron/client/ytUtils.ts`, `extra-work/bin-helper/`

### `M2` Image download/import

- Status: `production`
- What it does: fetch images from URLs and save them into app-managed locations.
- Main locations: `src/server/appHelpers.ts`

### `M3` Camera background access

- Status: `production`
- What it does: request camera access and use live camera feed as background media.
- Main locations: `src/background/BackgroundCamerasComp.tsx`, `src/_screen/ScreenBackgroundVideoComp.tsx`, `electron/electronEventListener.ts`

### `M4` Background attachment and caching

- Status: `supporting`
- What it does: manage background-related file attachments and cached assets.
- Main locations: `src/background/`, `src/others/AttachBackgroundManager.ts`, `src/others/CacheManager.ts`

## 7. Networking and Sharing

### `N1` LW-Share integration

- Status: `production`
- What it does: expose local network sharing and related device workflows.
- Main locations: `src/lwShare/`, `src/lwShare.tsx`, `electron/ElectronLWShareController.ts`, `electron/lwShareHelpers.ts`, `html/lwShare.html`

### `N2` LW-Share preload/provider wiring

- Status: `supporting`
- What it does: provide preload-side bridge code and supporting provider utilities for sharing features.
- Main locations: `electron/client/lwShare.preload.ts`, `electron/client/`

## 8. Settings and Configuration

### `C1` General settings UI

- Status: `production`
- What it does: configure theme, language, font family, and general app options.
- Main locations: `src/setting/`, `src/setting.tsx`, `html/setting.html`

### `C2` Directory settings

- Status: `production`
- What it does: configure directories and filesystem-related locations used by the app.
- Main locations: `src/setting/directory-setting/`

### `C3` Screen settings

- Status: `production`
- What it does: manage display-related configuration and screen-specific style settings.
- Main locations: `src/screen-setting/`, `src/screen.tsx`, `html/screen.html`

### `C4` Electron setting persistence

- Status: `supporting`
- What it does: persist window state, theme source, selected display, and chosen main HTML route.
- Main locations: `electron/ElectronSettingManager.ts`

### `C5` Fonts and locale boot setup

- Status: `supporting`
- What it does: load fonts and locale data during renderer startup.
- Main locations: `src/boot.ts`, `src/lang/`, `src/setting/settingHelpers.ts`

## 9. Search, Editors, and Utility Pages

### `U1` Finder page

- Status: `production`
- What it does: application finder and in-page search support.
- Main locations: `src/find/`, `src/finder.tsx`, `html/finder.html`, `electron/electronEventListener.ts`

### `U2` Note item editor

- Status: `production`
- What it does: edit note content used alongside slide/document workflows.
- Main locations: `src/noteItemEditor.tsx`, `html/noteItemEditor.html`, `src/slide-editor/note/`

### `U3` Web editor page

- Status: `experimental`
- What it does: separate web-oriented editor surface that should be validated before deep changes.
- Main locations: `src/webEditor.tsx`, `html/webEditor.html`

### `U4` About page and app info

- Status: `production`
- What it does: app information and about-screen routing.
- Main locations: `src/about.tsx`, `html/about.html`, `electron/ElectronAppController.ts`

### `U5` Router and multi-page navigation

- Status: `supporting`
- What it does: navigation between major HTML-backed pages and layout helpers.
- Main locations: `src/router/`

### `U6` Modal, popup, toast, and progress systems

- Status: `supporting`
- What it does: shared interaction primitives for dialogs, notifications, and progress display.
- Main locations: `src/app-modal/`, `src/popup-widget/`, `src/toast/`, `src/progress-bar/`

### `U7` Context menus and interaction helpers

- Status: `supporting`
- What it does: context menu behavior and reusable interaction helpers.
- Main locations: `src/context-menu/`, `src/event/`

## 10. Native Bridge and Provider Surface

### `I1` Provider bootstrap

- Status: `supporting`
- What it does: expose controlled Electron/Node capabilities to the renderer via `globalThis.provider`.
- Main locations: `src/server/appProvider.ts`, `electron/client/fullProvider.ts`, `electron/client/preloadProvider.ts`

### `I2` Async IPC reply-event pattern

- Status: `supporting`
- What it does: implement custom async renderer-to-main events using generated `replyEventName` values.
- Main locations: `src/server/appHelpers.ts`, `electron/electronEventListener.ts`

### `I3` File, path, crypto, browser, and system helpers

- Status: `supporting`
- What it does: provide the reusable native bridge surface used across renderer features.
- Main locations: `src/server/`, `electron/client/`

## 11. Build, Packaging, and Release Workflows

### `R1` Renderer build pipeline

- Status: `supporting`
- What it does: bundle all HTML entrypoints and renderer code with Vite.
- Main locations: `vite.config.ts`, `html/`, `dist/`

### `R2` Electron build pipeline

- Status: `supporting`
- What it does: compile Electron TypeScript, copy runtime assets, and prepare packaged output.
- Main locations: `electron.tsconfig.json`, `extra-work/copy-build.mjs`, `extra-work/build-info.mjs`, `electron-build/`

### `R3` Platform packaging

- Status: `supporting`
- What it does: package installers and platform-specific distributables.
- Main locations: `package.json`, `release/`

### `R4` Test suites and Electron mocks

- Status: `supporting`
- What it does: validate renderer and Electron behavior and mock Electron APIs for tests.
- Main locations: `vitest.config.ts`, `vitest.electron.config.ts`, `electron/testElectronModule.ts`, `electron/testUtils.ts`

### `R5` Release automation

- Status: `supporting`
- What it does: date-based versioning, release tagging, and release scripting.
- Main locations: `extra-work/setTodayVersion.mjs`, `extra-work/release.sh`, `extra-work/release-tag.sh`

## 12. Experimental and Archive Areas

### `X1` Experiment page

- Status: `experimental`
- What it does: separate experiment surface that should be validated before using as a product baseline.
- Main locations: `html/experiment.html`, `src/experiment` if added later, and related experimental assets

### `X2` Archived editor experiments

- Status: `experimental`
- What it does: old or paused editor experiments such as archived Lexical or Monaco-related work.
- Main locations: `src/archived/`

## Suggested Next-Step Prompt Format

Use a prompt like:

- `Create a dedicated repo skill for P3 Canvas slide editor.`
- `Expand the documentation and workflow guidance for B3 Bible search.`
- `Make a focused AI skill for D3 DOCX import and conversion.`

If a functionality needs to be split further, keep the original ID and add suffixes in follow-up docs, for example `D3a` and `D3b`.
