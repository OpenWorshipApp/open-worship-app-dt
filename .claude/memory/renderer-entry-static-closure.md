# Renderer entry static closure — fixed by leaf startup helpers

Date: 2026-09-23. EN-37.

## The trap

A tiny import can carry a feature graph. Before EN-37, every renderer reached a
463 KB minified chunk containing both React DOM server builds, app-document
rendering, the canvas and screen managers. The paths were not obvious from the
entry files:

- `boot -> settingHelpers -> fileHelpers -> FileSource -> ...`
- `themeHelpers -> colorHelpers -> dragHelpers -> background/screen -> ...`
- `fontHelpers -> appHelpers -> fileHelpers/FileSource -> ...`
- `langHelpers -> SettingManager -> appLocalStorage -> fileHelpers -> ...`

Rolldown shared the resulting graph across entries. A manual shared-chunk rule
did not help: the static dependency paths were real, so the entries still had
to load the code.

## The boundary

Startup code imports dependency-light leaves:

- `storageFileHelpers.ts` — synchronous path, portable-text, marker and
  storage primitives; `fileHelpers.ts` re-exports them.
- `colorValueHelpers.ts` — color math only; dragging stays in
  `colorHelpers.tsx`.
- `electronSendHelpers.ts` — request/reply IPC only; `appHelpers.ts`
  re-exports it.
- `appFontSettingHelpers.ts` — startup font settings without the setting UI
  module.
- `AboutComp` loads DOCX/PPTX version helpers dynamically.

`appLocalStorage.test.ts` asserts that importing startup storage does not load
the broad `fileHelpers` module. Keep that boundary when adding storage calls;
rare asynchronous listing/deletion imports `fileHelpers` inside the method.

## Measured result

Production static minified JavaScript closures, same Vite build and graph
walker:

| Renderer | Before | After | Change |
| --- | ---: | ---: | ---: |
| About | 1,056 KB | 236 KB | -78% |
| Finder | 1,058 KB | 237 KB | -78% |
| AI Chat | 1,096 KB | 323 KB | -71% |
| Settings | 1,139 KB | 605 KB | -47% |
| Chatbot | 1,697 KB | 956 KB | -44% |

Presenter stayed effectively flat (1,288 -> 1,300 KB), and Screen stayed near
1.06 MB because those renderers actually use the document/screen graph. That is
the intended distinction: auxiliary windows no longer pay for it.

When changing a renderer entry, `boot.ts`, theme, settings or another helper
used by all windows, build to the OS temp directory and compare the entry's
recursive static JS imports. A chunk name is not evidence; inspect the source
map and trace the source import path.

