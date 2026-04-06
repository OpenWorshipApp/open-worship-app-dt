# Open Worship Repository Guide

## Purpose

Open Worship is a cross-platform desktop app for church presentation and Bible study. It is designed to run offline on lower-spec machines and combines presentation workflows, Bible reading and search, media/document support, and network-sharing features in one Electron application.

The current source of truth is the codebase plus `README.md`. `REACT.md` is leftover Create React App boilerplate and should not be used as architecture guidance.

For a categorized checklist of feature areas that can be turned into narrower skills, use `functionality-inventory.md` in this same references folder.

## Runtime Architecture

The app has four main runtime layers.

### 1. Electron main process

- Source: `electron/`
- Entry point: `electron/index.ts`
- Responsibilities: app lifecycle, windows, menus, screen control, dialogs, settings persistence, process spawning, filesystem access, native integrations, and IPC handlers.
- Build target: CommonJS output in `electron-build/` via `electron.tsconfig.json` and `npm run electron:build`.
- Agent-debug entrypoint: `electron/agentDebugServer.ts` exposes the opt-in loopback inspection server used by local agents and tooling.

### 2. React renderer pages

- Source: `src/`
- HTML entrypoints: `html/*.html`
- Responsibilities: UI, editing workflows, slide and Bible interfaces, local IndexedDB usage, screen state, and calls into the main process through the provider/IPC layer.
- Build target: Vite multi-entry output in `dist/`.
- Agent-debug bridge: `src/server/agentDebugHelpers.ts`, initialized from `src/boot.ts`, publishes page-specific state into the live debug snapshot.

### 3. Worker scripts for document/media tasks

- Source: `public/js/`
- Invoked from Electron through `electron/processHelpers.ts`
- Responsibilities: PDF page counting, PDF-to-image conversion, PPTX-to-HTML, DOCX-to-HTML, Word export, and PowerPoint slide utilities.
- Behavior: Electron forks these scripts as child processes and communicates through `process.send()`/`message`.

### 4. Bundled helper binaries and native assets

- Source/build area: `extra-work/bin-helper/`
- Responsibilities: .NET helper compilation, bundled tools, runtime assets such as `yt-dlp`, FFmpeg, and .NET runtime files.
- Important note: if the helper source changes, the helper must be rebuilt separately before Electron packaging picks it up.

## Boot Flow

The main boot sequence is:

1. `electron/index.ts` registers the custom protocol and starts Electron.
2. It waits for `app.whenReady()`, acquires the single-instance lock, initializes protocol handling, event listeners, menus, and devtools.
3. `ElectronAppController` wires together the setting manager, main window controller, and screen controller behavior.
4. `ElectronMainController` creates the BrowserWindow and loads the current HTML route chosen from persisted settings.

Renderer boot is:

1. Vite serves or builds from `html/` as the root.
2. Each HTML file imports a page entry in `src/`.
3. Shared boot logic runs from `src/boot.ts`, which initializes the agent debug bridge and then loads locale data and app-wide font settings before the page mounts.

## Agent Debugging Surface

The repo includes an opt-in local inspection surface for coding agents and other local tooling.

- Startup path: `npm run dev:agent`
- Launcher: `extra-work/dev-agent.mjs`
- Host binding: `127.0.0.1`
- Default port: `47831`
- Server file: `electron/agentDebugServer.ts`
- Renderer bridge: `src/server/agentDebugHelpers.ts`

The launcher checks whether a debug session already exists, reuses an existing Vite dev server on `https://127.0.0.1:3000` when possible, builds Electron, and starts the app with `OPEN_WORSHIP_AGENT_DEBUG=1`.

The server currently exposes read-only endpoints:

- `/health`
- `/snapshot`
- `/dom`
- `/screenshot.png`

`/snapshot` combines Electron-side window metadata with renderer-side DOM and provider data. Pages can publish extra structured state by registering providers through `registerAgentDebugProvider()` or by storing direct values through `setAgentDebugData()`.

If you extend this surface, keep it loopback-only, opt-in, and bounded. Prefer summary data over raw controller dumps.

## Page Entrypoints

The renderer is multi-page, not a single SPA shell.

- `html/presenter.html` -> `src/presenter.tsx`
- `html/reader.html` -> `src/reader.tsx`
- `html/setting.html` -> `src/setting.tsx`
- `html/screen.html` -> `src/screen.tsx`
- `html/finder.html` -> `src/finder.tsx`
- `html/lwShare.html` -> `src/lwShare.tsx`
- `html/lyricEditor.html` -> `src/lyricEditor.tsx`
- `html/appDocumentEditor.html` -> `src/appDocumentEditor.tsx`
- `html/noteItemEditor.html` -> `src/noteItemEditor.tsx`
- `html/webEditor.html` -> `src/webEditor.tsx`
- `html/about.html` is an additional page entry routed from Electron.
- `html/experiment.html` is experimental and should not be treated as a core production flow without verifying usage.

Renderer page navigation is handled by `src/router/routeHelpers.tsx`, which updates `location.href` and stores the last page in local storage.

## Directory Map

### Root-level directories

- `src/`: renderer TypeScript and React code.
- `electron/`: Electron main-process source and Electron-specific tests.
- `html/`: Vite HTML entrypoints.
- `public/`: static assets plus worker scripts under `public/js/`.
- `extra-work/`: build helpers, release tooling, and bundled helper assets.
- `electron-build/`: generated Electron build output. Do not edit manually.
- `release/`: packaged artifacts and unpacked build outputs. Do not edit manually.
- `docs/`: small project notes and diagrams. Useful context, but not a complete source of truth.

### Important renderer areas in `src/`

- `src/server/`: bridge layer for provider access, IPC wrappers, file helpers, and application utilities.
- `src/server/agentDebugHelpers.ts`: renderer bridge for agent debug provider registration and snapshot data.
- `src/db/`: IndexedDB abstractions used by renderer-side persistent data.
- `src/helper/`: shared helpers, types, logger, sanitizers, Bible helpers, and error utilities.
- `src/presenter/`: main presentation/editor workflow.
- `src/slide-editor/`: slide editing model and canvas behavior.
- `src/bible-find/`, `src/bible-reader/`, `src/bible-lookup/`, `src/bible-cross-refs/`: Bible search and reading flows.
- `src/setting/`: settings UI, theme, font, language, and configuration flows.
- `src/_screen/`: presenter/audience screen behavior and timers.
- `src/app-document-editor/`, `src/app-document-list/`, `src/app-document-presenter/`: imported document viewing and presentation.
- `src/lwShare/`: local network sharing UI.
- `src/lang/`: locale data and translation helpers.
- `src/archived/`: old experiments and non-primary code. Avoid refactoring here unless the task explicitly targets it.

### Important Electron areas in `electron/`

- `electron/index.ts`: main entrypoint.
- `electron/electronEventListener.ts`: most IPC handlers and many app integrations.
- `electron/ElectronAppController.ts`: main application orchestration.
- `electron/ElectronMainController.ts`: BrowserWindow creation and main-window messaging.
- `electron/ElectronScreenController.ts`: external display windows and screen lifecycle.
- `electron/ElectronSettingManager.ts`: persisted `setting.json` handling in `userData`.
- `electron/msHelpers.ts`: PowerPoint, DOCX, and Word-export helper wrapper.
- `electron/pdfToImagesHelpers.ts`: PDF page counting and preview rendering wrapper.
- `electron/electronOfficeHelpers.ts`: LibreOffice-based Office-to-PDF conversion.
- `electron/processHelpers.ts`: child-process execution for worker scripts.
- `electron/client/`: provider and preload-side Node/Electron utilities exposed to the renderer.
- `electron/agentDebugServer.ts`: loopback-only HTTP server for screenshots, DOM snapshots, and structured renderer state.

## Provider and IPC Model

Renderer code should not directly own native access. Instead:

- `src/server/appProvider.ts` reads a preloaded `globalThis.provider` object.
- The provider exposes message, file, path, system, browser, font, crypto, database, and yt-dlp helpers.
- After reading the provider, the module deletes `globalThis.provider` to keep it from being globally accessible.

The async IPC pattern is custom and important:

- Renderer calls `electronSendAsync()` from `src/server/appHelpers.ts`.
- That helper creates a unique `replyEventName` and listens once for the reply.
- `electron/electronEventListener.ts` uses an internal `onAsync()` helper that requires `replyEventName` in the payload.
- If you change a channel name or forget `replyEventName`, the feature fails silently or hangs.

This repo uses both `ipcMain.handle()` and string-based custom event channels, but most app-level workflows still rely on the custom reply-event pattern.

## Settings, Routing, and Window Selection

- Electron persists settings in a JSON file under the platform `userData` directory through `electron/ElectronSettingManager.ts`.
- Persisted values include main window bounds, chosen audience display, and the `mainHtmlPath` to open on launch.
- The default main page comes from `htmlFiles.presenter`.
- Renderer-side route changes use `src/router/routeHelpers.tsx`, which stores the current page in local storage.

When a feature depends on settings, verify whether the setting is stored in Electron, in renderer local storage, or in IndexedDB. The repo uses all three depending on the feature.

## Data Storage Model

There are two different persistence layers.

### Renderer persistence

- Uses IndexedDB through `src/db/databaseHelpers.ts`.
- Store versioning is tied to `appProvider.appInfo.versionNumber`, so schema resets can happen when the app version changes.
- `BibleDatabaseController` in `src/helper/bible-helpers/BibleDatabaseController.ts` is one concrete renderer-side IndexedDB wrapper.

### Main-process database usage

- Uses Node's SQLite support via `electron/client/databaseUtils.ts`.
- Loads the FTS5 extension from bundled files in `db-exts/`.
- This is used for Bible search and is separate from renderer IndexedDB.

When changing Bible or search behavior, determine first whether the feature reads from IndexedDB, SQLite, or both.

For the B3 Bible search workflow specifically, use `b3-bible-search-guide.md` in this same references folder.

## Document and Media Conversion Pipeline

There are several separate pipelines, and they are easy to confuse.

### Office to PDF

- `electron/electronOfficeHelpers.ts` uses `libreoffice-convert`.
- It reads the source Office file, converts to PDF, and writes the result to a target path.

### PDF preview generation

- `electron/pdfToImagesHelpers.ts` wraps worker scripts in `public/js/`.
- `count-pdf-pages.mjs` returns page count.
- `pdf-to-images.mjs` renders preview images.
- Results are cached per file path unless forced.

### PowerPoint and DOCX to HTML

- `electron/msHelpers.ts` builds helper paths and delegates to child-process workers.
- `pptx-to-htmls.js` and `docx-to-htmls.js` run via `execute()` from `electron/processHelpers.ts`.
- The worker receives arguments from Electron, runs the helper pipeline, and replies over process messaging.

### Word export for Bible content

- `export-bible-ms-word.js` is triggered through `electron/msHelpers.ts` and the async IPC path.

### Helper rebuild rule

- If you change `extra-work/bin-helper/Helper.cs`, helper packaging, or bundled helper dependencies, rebuild with `bash extra-work/bin-helper/build.sh`.
- `npm run electron:build` copies helper outputs into the packaged Electron asset layout.

DOCX support follows the same Electron-side conversion and cached preview pattern as PPTX conversion, but it behaves more like PDF in the UI because it is page-based and not directly editable.

## External and Platform Dependencies

- Node.js 18.16+ is declared in `package.json`.
- The README currently recommends Node.js 22+ in practice.
- `.NET 8` tooling is required for Microsoft Office helper flows.
- Git Bash or similar Unix-like shell support matters on Windows because some scripts use `bash`.
- `yt-dlp-wrap` and bundled binaries under `extra-work/bin-helper/` support video/audio download flows.
- `lw-share` supports network sharing.
- `mupdf` is used by the PDF pipeline.
- `font-list` supports font discovery.

If a task touches setup, release, or media-processing behavior, verify whether the dependency is installed from npm, bundled in `extra-work/bin-helper/`, or provided by the operating system.

## Build, Test, and Release Commands

Common commands from `package.json`:

- `npm install`: install dependencies and run the repository install hook.
- `npm run dev`: run Vite dev server plus Electron.
- `npm run dev:agent`: start or reuse a local development session with the loopback agent debug server enabled.
- `npm run electron:build`: compile the Electron target and copy build assets.
- `npm run electron:dev`: Electron-only development loop with watch and restart.
- `npm run build`: production renderer build plus Electron build.
- `npm run test`: renderer Vitest suite.
- `npm run test:electron`: Electron Vitest suite.
- `npm run test:all`: both test suites.
- `npm run lint:all:error`: TypeScript no-emit typecheck.
- `npm run lint:pre`: Prettier write across `src/` and `electron/`.
- `npm run lint:es`: ESLint on renderer and Electron source.
- `npm run lint`: tests, typecheck, format, eslint, then build.
- `npm run pack:win`, `npm run pack:mac`, `npm run pack:linux`: package platform-specific builds.
- `npm run release:version`: set date-based version and refresh install state.
- `npm run release`: release automation script.

Use the narrowest command that proves the change while iterating, but treat `npm run lint` as the default final validation source after code changes. Favor `npm run build` in addition when the change spans renderer plus Electron or modifies packaging-sensitive code.

## Testing Structure

- Renderer tests live under `src/` and match `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Electron tests live under `electron/` and match `electron/**/*.test.ts`.
- Both Vitest configs currently use the `node` test environment.
- Electron test mocks are centralized in `electron/testElectronModule.ts` and `electron/testUtils.ts`.

If you add a new Electron API call and tests start failing, update the Electron mock layer first.

## Naming and Design Conventions

- `*Controller`: stateful flow or orchestration object.
- `*Manager`: persistence, coordination, or service wrapper.
- `*Helpers`: utility functions.
- Page entrypoints are usually named after the HTML file they back.
- Shared renderer access to native features should go through provider helpers, not direct imports.

Follow the established split instead of collapsing logic into one layer for convenience.

## Editing Playbooks

### Renderer UI change

1. Find the entry page under `src/` and the corresponding feature directory.
2. Check whether the feature already has controllers, managers, or helpers that own the state.
3. Check Bootstrap utility classes and existing Bootstrap-compatible patterns before adding new SCSS. Add custom styles only when Bootstrap cannot cover the requirement cleanly.
4. If the change needs native access, route it through `src/server/` helpers and the provider layer.
5. Run narrow checks while iterating if helpful, but finish code changes with `npm run lint`. Run `npm run build` in addition if the change crosses feature boundaries.

### Agent debugging change

1. Read `agent-debugging.md` before editing the live inspection flow.
2. Decide whether the change belongs in the Electron server (`electron/agentDebugServer.ts`) or the renderer bridge/provider layer (`src/server/agentDebugHelpers.ts` plus the owning page/component).
3. Keep provider payloads small, JSON-like, and focused on user-visible state.
4. Preserve loopback-only opt-in behavior. Do not add always-on or unauthenticated remote access.
5. Validate with `npm run dev:agent` plus endpoint checks before running the usual final repo validation.

### Electron IPC change

1. Update the sender path in renderer helpers or feature code.
2. Update the matching channel in `electron/electronEventListener.ts`.
3. Preserve `replyEventName` behavior for async events.
4. Update Electron tests in `electron/*.test.ts`.

### Screen or presenter behavior change

1. Check both `src/_screen/` and the Electron screen controller.
2. Verify whether the change affects only the audience screen, only the main window, or both.
3. Test multi-display assumptions carefully because Electron screen state is persisted.

### Bible/search change

1. Identify whether the feature depends on renderer IndexedDB, main-process SQLite, or both.
2. Check `src/helper/bible-helpers/`, `src/bible-*`, and `electron/client/databaseUtils.ts`.
3. Be careful with version-coupled IndexedDB schema behavior.
4. For Bible search UI, query flow, or ranking changes, read `b3-bible-search-guide.md` before editing.

### PPTX, DOCX, PDF, or Word export change

1. Determine whether the behavior lives in Electron wrappers, worker scripts, or the bundled helper.
2. Update `public/js/` worker scripts when the child-process protocol changes.
3. Rebuild the helper if C# or bundled helper assets change.
4. Run Electron tests and a build when the pipeline changes.

## Non-obvious Constraints and Risks

- `electron/` and `src/` have different runtime constraints. Browser code in Electron files or Node/Electron code in renderer files will break builds or runtime behavior.
- `electron/electronHelpers.ts` still contains `isSecured = false`; do not assume the app is already hardened.
- `vite.config.ts` uses `html/` as the Vite root and auto-discovers every HTML file there as an entrypoint.
- `public/js/` scripts run as forked Node processes, not as browser scripts.
- Generated directories such as `electron-build/`, `dist/`, and packaged outputs under `release/` should not be hand-edited.
- `src/archived/` is not a safe refactor target unless the task explicitly calls for it.
- Release versioning is date-based, for example `2026.03.22`.

## High-value Files by Task

- New IPC or native bridge work: `src/server/appHelpers.ts`, `src/server/appProvider.ts`, `electron/electronEventListener.ts`
- Window boot or page selection: `electron/index.ts`, `electron/ElectronMainController.ts`, `electron/ElectronSettingManager.ts`
- Presenter or slide editing: `src/presenter/`, `src/slide-editor/`
- Bible reading or search: `src/bible-find/`, `src/bible-reader/`, `src/helper/bible-helpers/`, `electron/client/databaseUtils.ts`
- Screen behavior: `src/_screen/`, `electron/ElectronScreenController.ts`
- Settings: `src/setting/`, `electron/ElectronSettingManager.ts`
- Office and document conversion: `electron/msHelpers.ts`, `electron/electronOfficeHelpers.ts`, `electron/pdfToImagesHelpers.ts`, `public/js/`, `extra-work/bin-helper/`
- Network sharing: `src/lwShare/`, `electron/ElectronLWShareController.ts`, `electron/lwShareHelpers.ts`

## Guidance for AI Tools

When working in this repository:

1. Start by identifying whether the task belongs to renderer, Electron, worker-script, or helper-binary code.
2. Prefer existing controllers/managers/helpers over introducing a new abstraction family.
3. Treat IPC event names and payload shapes as part of the API surface.
4. Do not trust `REACT.md` as current documentation.
5. Avoid editing generated outputs unless the task is explicitly about build artifacts.
