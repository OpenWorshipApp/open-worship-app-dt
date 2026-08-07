<!-- Project knowledge (performance rules, dev-launch/lint gotchas, CDP driving
notes, rendering/event architecture gotchas, print flow, codebase patterns,
owa-robot-test directives) now lives in the repo at `.claude/CLAUDE.md`, which
is loaded every session. Don't duplicate that content here — add a memory file
only for something NOT captured in CLAUDE.md or the codebase. -->

- [Foreground sync shared refs](foreground-sync-shared-refs.md) — sync-grouped screens share identical foreground-data objects; never key a module-global map by them
- [Screen draw feature](screen-draw-feature.md) — FreeShow-style Draw overlay; Paint-only shipped (Fill/Pointer/Focus/Particles deferred, Zoom skipped); native-px coords + incremental begin/points sync
- [Screen focus spotlight](screen-focus-spotlight.md) — Focusing = its own `#focus` layer/manager, NOT a draw mode; radial-gradient mask (a big box-shadow silently won't paint)
- [EventHandler sync dispatch](eventhandler-sync-dispatch.md) — addPropEvent dispatches synchronously; CLAUDE.md's 10ms/MD5-debounce claim is stale
- [Codebase audit 2026-07](codebase-audit-2026-07.md) — audit findings FIXED 2026-07-22 (uncommitted); deferred: webPreferences hardening, trash-path containment, color-note dir-refresh reads
- [Screen sync-group echo guard](screen-sync-group-echo-guard.md) — noSyncGroupMap is sticky, so color-note groups silently go one-way; reload now repairs the resulting divergence
- [Lint known-failure note is stale](lint-known-failure-stale.md) — CLAUDE.md's ElectronMainController icon.png failure is fixed; don't assume a lint abort is "pre-existing"
- [Dev HMR stale state during QA](dev-hmr-stale-state-qa.md) — an HMR reload kills keyboard layers and unmounts overlays; reload fully before calling it a regression
- [`build` kills the running dev app](build-kills-running-dev-app.md) — `electron:build` rm -rf's `electron-build/`, the app's own main entry; verify live FIRST, build last
- [CDP dynamic import hijack](cdp-dynamic-import-hijack.md) — never `import()` app modules in evaluate_script; it re-runs `document.onkeydown = …` and kills every app shortcut
- [Bible Note floating toolbar width gate](bible-note-floating-toolbar-width.md) — the selection format popup only exists above ~1025px; the default 870px note window never shows it
- [On-screen slide setting all-or-nothing — FIXED](screen-onscreen-setting-all-or-nothing.md) — refactor21 now drops only invalid entries; stop blaming this path for blank-after-restart screens
- [Apply Settings skips popups — FIXED](apply-settings-skips-popups.md) — refactor22 reloads popups too; a stale-looking label is a missed reload, not a missing `tran()`
- [Injected app-document `?file=` param](injected-app-document-file-param.md) — every renderer treats `?file=` as a document name, so bibleNote/lyric/web popups always log a load error
- [Missing km key throws in dev](tran-missing-key-throws-in-dev.md) — `tran()` throws (blanks the page) on a missing key; concatenated + dynamic `tran(prop)` sites hide from literal grepping
- [Confirm popup labels are auto-tran'd](confirm-popup-labels-auto-tran.md) — ConfirmPopupComp `tran()`s the button labels; pass raw English keys, and pair `'Yes'` with `'No'`
- [Vitest env-leak flakes](vitest-env-leak-flakes.md) — node-env tests importing `appProvider` pass only when a jsdom file shares the worker; plus the whole-suite "reading 'config'" flake
- [npm 12 install gotchas](npm-12-install-gotchas.md) — plain `npm i` fails on git deps and leaves electron with no `dist/`; use `--allow-git=all` + run electron's install.js
- [open-lyric subtree-branch dep](open-lyric-subtree-branch-dep.md) — npm can't install a git subdirectory; the dep is a subtree-split branch that must be re-split + force-pushed on every update
- [Blob downloads pop a Save As dialog](blob-download-pops-save-dialog.md) — no will-download handler, so `<a download>` orphans a .tmp; write files with fsWriteFile instead
- [Screen change-bible IPC — FIXED](screen-change-bible-dead-ipc.md) — refactor22 added the `src/` receiver; stepping works from the presenter, still not from the reader
- [TypeScript 7 side-by-side](typescript-7-side-by-side.md) — `tsc` is TS7 via `@typescript/native`; the `typescript` alias to TS6 is load-bearing for typescript-eslint, don't "fix" it
- [Dev data dir is separate](dev-data-dir-is-separate.md) — dev writes user files to `Desktop\open-worship-data-dev`; checking the non-dev dir makes working downloads look broken
- [Lyric subsystem architecture](lyric-subsystem-architecture.md) — lyric slides are HTML from the `open-lyric` dep; `openLyric` is set by ONE component, so screen renderers see null
- [On-screen check must not parse](onscreen-check-must-not-parse.md) — `checkIsVaryAppDocumentOnScreen` runs per row per screen event; match on `filePath`, never call `getSlides()`
- [QA: intentional, not bugs](qa-intentional-not-bugs.md) — PPTX blank slide0, bible-present swapping the background, and the video-sync log burst are all deliberate
- [`app-ellipsis-left` reverses names](app-ellipsis-left-reverses-names.md) — `direction:rtl` makes `12_cv.mp4` display as `cv_12`; the label is not the filename
- [Vite dep-optimizer 504 → touch config](vite-dep-optimizer-504-restart.md) — a 504 on a `.vite/deps` chunk is a stale optimizer cache; touch vite.config.ts instead of restarting dev
- [Full view toggle collapses a widget](full-view-toggle-collapses-widget.md) — it persists a zero-height Background panel; several elements share the title "Full view"
- [Lyrics live in the Documents list](lyric-in-documents-list.md) — refactor23 merged `.owl` into the documents folder/list; the LYRIC dir setting is gone and old lyrics must be moved
- [appDocumentHelpers ↛ LyricAppDocument](app-document-helpers-lyric-cycle.md) — importing it closes a cycle through `AppDocument` and throws `class extends undefined`
- [Playlist: references vs presets](playlist-references-vs-presets.md) — slides/documents are file references, backgrounds/bible/foregrounds are verbatim presets; foreground buttons now serialize themselves
- [Screen window had no app fonts — FIXED](screen-window-has-no-app-fonts.md) — `screen.tsx` skipped `init()` + `getAllLangsAsync` never registered CSS; stage-CSS fixes are inert against open-lyric's inline dump
- [On-screen setting parse amplification — FIXED](onscreen-setting-parse-amplification.md) — readers memoized on the raw setting string; the getters MUST keep returning a copy or a present wipes the other screen
- [Reveal Original is a context item](reveal-original-context-menu.md) — the 3-second hover-to-locate is gone; use `genRevealOriginal`, and note it can't open a closed panel yet
- [Playlists panel is no longer dev-only](playlist-panel-no-longer-dev-only.md) — `203d35cc` dropped the `isDev` gate and took the Lyric List's slot; every "dev builds only" note is stale
- [Playlist on-screen marking design](playlist-onscreen-marking-design.md) — ONE shared subscription + shared debounce for the whole tree; per-row screen hooks hit "Maximum update depth exceeded"
- [Playlist preview is a run player](playlist-preview-run-player.md) — forward-only focus-gated keys; a document element is walked slide by slide before the run leaves it
- [Playlist screen pinning](playlist-screen-pinning.md) — `Set Specific Screen` rides `chooseScreenIds`; `isForceChoosing` and a drag deliberately outrank a pin
- [Playlist screen actions](playlist-screen-actions.md) — a run sheet can hold things to DO; two families now (screen vs run), extend `playlistActionList`, never `acceptedDragTypeList`
- [Playlist auto next](playlist-auto-next.md) — the run walks itself and jumps; the CURSOR MOVING cancels a timeout and restarts an interval, raw clicks/keys mean nothing; a timeout may also be armed with a time of day
- [Playlist CC elements](playlist-cc-elements.md) — followers that ride a host's present; copies not links, and they may never raise a second "which screen?" menu
- [Downloads are protocol-aware now](http-downloads-protocol-aware.md) — only `initHttpRequest` speaks plain http; `httpUtils.request` is still https/443-only
- [`.owapl.tar.gz` playlist archive](playlist-archive-owapl.md) — bundles the whole documents behind slide references; import resolves every destination folder before writing anything
- [Single-item archives (`.owadoc` / `.owbible`)](document-archive-owadoc.md) — one document, lyric or bible list + everything attached to it; three layers, add a config not a copy
- [Whole-data archive (`.owadata.tar`)](data-archive-owadata.md) — File → Export/Import Data; uncompressed + no staging copy on purpose, and the File menu now takes renderer items
- [Playlist drag & setting rules](playlist-drag-and-settings-rules.md) — `playlistDraggingStore` makes cross-playlist drag a silent no-op; setting names must be sanitized paths
- [Reader full ref not resolved](reader-full-ref-not-resolved.md) — typing `John 3:16` in the Bible Reader drops the chapter:verse; the five docs that claimed otherwise are now corrected
- [PDF preload decodes all pages — FIXED](pdf-preload-decodes-all-pages.md) — presenter load turned a selected 88-page PDF into 162MB of bitmap; preload is now file-scoped and sizes come from the PNG header
- [Dev Electron hardcodes port 3000](dev-electron-hardcodes-port-3000.md) — a stale Vite there gets silently attached while your own dev server sits on :3001
