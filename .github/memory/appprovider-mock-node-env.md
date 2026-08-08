---
name: appprovider-mock-node-env
description: appProvider touches `document` at module scope, so any NODE-env test whose import chain reaches langHelpers dies while the file is still being imported
metadata:
  type: project
---

`src/server/appProvider.ts` runs `document.addEventListener('mouseenter', …)` at module
scope, and `appProvider.mock.ts` read `globalThis.document.title` the same way. Both are
reached from `src/lang/langHelpers.ts`, which nearly every `helper/` module imports for
`tran`.

**Why it matters:** a NODE-environment test (`vitest.config.ts` picks the environment per
file; `EditingHistoryManager.test.ts`, `dataArchiveHelpers.test.ts` and friends are node)
that gains ONE new import reaching `langHelpers` does not fail an assertion — it throws
`ReferenceError: document is not defined` while the file is still being IMPORTED, so every
test in it fails at once and the stack points at `appProvider`, not at the import that
reached it. Adding `import { X } from '../helper/DirSource'` to `EditingHistoryManager` for
a single string constant took 32 tests down this way on 2026-08-06.

**How to apply:**

- The mock now reads `globalThis.document?.title ?? ''` / `?.hasFocus() ?? false`, so IT is
  safe. `appProvider.ts` itself is NOT guarded — the real module is browser-only by design.
- So the rule stands: **do not add an import that reaches `langHelpers` to a module a
  node-env test loads.** Put shared constants in a LEAF instead — that is why
  `src/editing-manager/editingHistoryPathHelpers.ts` (`HISTORY_DIR_NAME_SUFFIX`,
  `toEditingHistoryFolderPath`) exists rather than exporting them from `DirSource`.
- The same leaf fixes a second trap: `dataArchiveHelpers.test.ts` mocks `DirSource`
  wholesale, so a constant imported THROUGH it came back `undefined` and was baked silently
  into a regex. A mocked module's named exports are `undefined` unless the mock lists them —
  import shared values from a module nobody mocks.
- Symptom to recognize: a whole test FILE failing with one error whose stack is
  `appProvider.ts` → `langHelpers.ts` → <the module you just touched>. Check the newest
  import, not the assertion.
