---
name: vitest-mock-factory-survives-resetmodules
description: vi.mock factory results are cached past vi.resetModules(), so a resetting test and its module under test end up on different electron mocks
metadata:
  type: project
---

In the electron test suite, `vi.mock('electron', async () => (await import('./testElectronModule')).createElectronModuleMock())`
is evaluated **once, lazily** and its result is cached — `vi.resetModules()` does
NOT re-run the factory. But `vi.resetModules()` DOES invalidate
`./testElectronModule`, so a later `await import('./testElectronModule')` inside
a test hands back a **fresh** `electronMockState` while the module under test is
still calling into the **first** one. Every assertion then reads "Number of
calls: 0" even though the code ran fine.

This is invisible in a single-test file (the factory happens to run after that
test's reset, so both land on the same instance) and only appears when a second
test resets again — which is exactly what happened when `electron/index.test.ts`
grew from one test to three.

**Why:** `./index` runs `main()` at import, so testing a second startup path
genuinely requires `vi.resetModules()`; the mock instance then silently forks.

**How to apply:**
- If the test needs `vi.resetModules()` (re-running a module's import side
  effects), pin the mock by requesting it **before** any reset — a top-level
  `import 'electron';` in the test file, alongside a static
  `import { electronMockState } from './testElectronModule';`. Both then refer
  to instance #1 forever. Drop the per-test `await import('./testElectronModule')`.
- If the test only needs different `isDev`/`isWindows` per case, do NOT reset at
  all — mock `./electronHelpers` with **getters** over a `vi.hoisted()` object
  and flip the fields in `beforeEach`. Works because every helper reads those
  flags inside a function body, not at module scope. See
  `electron/taskbarHelpers.test.ts`.
- `electronMockState.reset()` uses `mockClear()`, not `mockReset()`, so a
  `mockReturnValue(...)` set in one test leaks into the next when the instance is
  pinned. Use `mockReturnValueOnce`, or re-set the default in `beforeEach`.

Related: [[appprovider-mock-node-env]], [[vitest-env-leak-flakes]].
