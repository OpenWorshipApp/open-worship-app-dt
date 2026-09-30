---
name: appprovider-mock-node-env
description: There is NO appProvider mock any more — a test that reaches it must `vi.mock` it in its own file, and it still touches `document` at module scope
metadata:
  type: project
---

`src/server/appProvider.ts` reads the Electron preload bridge off `globalThis.provider` and
runs `document.addEventListener('mouseenter', …)` at module scope. It is reached from
`src/lang/langHelpers.ts`, which nearly every `helper/` module imports for `tran`, so it
lands in test files that never mention it.

**There is no shared mock and no fallback (2026-08-24, by the user's explicit decision).**
`appProvider.mock.ts` — a 1200-line browser fake with a virtual fs, path/crypto helpers and
a message bus — was deleted in `47053c9d` (2026-08-24 "enhanced setting") so it stops
shipping in the renderer bundle. A
test-only revival (moved to `src/test-setup/` and injected through a `setupFiles` entry) was
then removed too: *"remove all mock for app-provider, I don't need mocking anymore."*
**65 test files were deleted with it** (the prune touched 66 paths; the 66th was
`appProvider.mock.ts` itself) — everything that only passed because that fake
existed: `appLocalStorage`, `fileHelpers`, `langHelpers`, `bibleXML*`, `dataArchiveHelpers`,
`documentVariants`, every `presentingFlow*` unit test, the toast/popup/canvas suites. Do not
re-add it in any form.

**Shape of the prune (verified):** everything deleted was a test whose import graph
reached `appProvider` only through the deleted fake (filesystem/IPC/settings-heavy
modules). Concentration: presenting-flow 12 (the ENTIRE `src/presenting-flow` suite —
zero tests remain there), server 4, bible-list/note 4, app-document-list 4,
slide-editor/canvas 4, setting/bible-setting 3, app-modal 3, helper 3, plus
`src/lang/data/{en,km}/index.test.ts` and `src/lang/langHelpers.test.ts` — so the
km-translation completeness tests are gone, which matters given `tran()` throws on a
missing key. What survived: tests that mock appProvider in-file, and every
`electron/*.test.ts` (separate config, never used the fake). Even a freshly written
test isn't safe from it: `src/app-modal/floatingWidgetModalLayer.test.tsx` was added
2026-08-16 (`3f7253ac`) and the prune deleted it a week later — the modal-layer
invariants are unit-untested today. The same commit added
`server.deps.inline: ['open-lyric', /monaco-editor/]` to `vitest.config.ts`;
`package.json` test scripts were unchanged.

**Why it matters:** with nothing on `globalThis.provider`, the module throws
`TypeError: Cannot read properties of undefined (reading 'isPageReader')` at line 239 while
the test file is still being IMPORTED. Every test in that file dies at once and the stack
points at `appProvider`, not at the import that reached it. A node-env test hits the same
wall one step earlier with `ReferenceError: document is not defined`.

**How to apply:**

- A new test whose import graph reaches `appProvider` must stub it in its own file:
  `vi.mock('../server/appProvider', () => ({ default: { …only what it calls… } }))`.
  100 of the current 183 src test files do exactly this (12 test files added since the
  prune; the suite grew back past its pre-prune 171) — copy the nearest one rather than
  inventing a shape. `src/others/CacheManager.test.ts` (hoisted, mutable flags) and
  `src/bible-list/Bible.test.ts` are good models.
- `src/server/appProvider.test.ts` is the exception that must NOT mock it: it sets
  `globalThis.provider` by hand to prove the real injection path, and asserts the module
  deletes the global afterwards.
- Prefer keeping shared constants in a LEAF module so node-env tests never reach
  `langHelpers` at all — that is why `src/editing-manager/editingHistoryPathHelpers.ts`
  (`HISTORY_DIR_NAME_SUFFIX`, `toEditingHistoryFolderPath`) exists rather than exporting
  them from `DirSource`. Adding one such import to `EditingHistoryManager` took 32 tests
  down on 2026-08-06.
- A mocked module's named exports are `undefined` unless the mock lists them: import shared
  values from a module nobody mocks. `dataArchiveHelpers.test.ts` (itself deleted in the
  prune) baked an `undefined` constant silently into a regex this way.
- Symptom to recognize: a whole test FILE failing with one error whose stack is
  `appProvider.ts` → `langHelpers.ts` → <the module you just touched>. Check the newest
  import, not the assertion. See [[vitest-env-leak-flakes]].
