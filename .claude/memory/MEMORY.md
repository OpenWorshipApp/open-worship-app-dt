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
- [open-lyric subtree-branch dep](open-lyric-subtree-branch-dep.md) — npm can't install a git subdirectory; the dep is a subtree-split branch that must be re-split + force-pushed on every update
- [Blob downloads pop a Save As dialog](blob-download-pops-save-dialog.md) — no will-download handler, so `<a download>` orphans a .tmp; write files with fsWriteFile instead
- [Screen change-bible IPC — FIXED](screen-change-bible-dead-ipc.md) — refactor22 added the `src/` receiver; stepping works from the presenter, still not from the reader
- [TypeScript 7 side-by-side](typescript-7-side-by-side.md) — `tsc` is TS7 via `@typescript/native`; the `typescript` alias to TS6 is load-bearing for typescript-eslint, don't "fix" it
- [QA: intentional, not bugs](qa-intentional-not-bugs.md) — PPTX blank slide0, bible-present swapping the background, and the video-sync log burst are all deliberate
