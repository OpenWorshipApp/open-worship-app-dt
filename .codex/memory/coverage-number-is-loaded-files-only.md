---
name: coverage-number-is-loaded-files-only
description: npm run test:coverage reports ~78% because v8 measures only the files a test imported; over the whole surface it is 48% with 502 files at 0%
metadata:
  node_type: memory
  type: project
  originSessionId: 1a0abd43-6b35-43bb-bad5-7bc1def7ec6e
  modified: 2026-09-26T13:01:58.589Z
---

Neither `vitest.config.ts` nor `vitest.electron.config.ts` sets
`coverage.include`, and vitest's v8 provider then measures **only the files a
test actually imported**. So the committed scripts report a number about a
subset:

| | Reported | Files in the denominator |
| --- | --- | --- |
| `npm run test:coverage` | 78.28% lines | 526 of 932 `src` files |
| `npm run test:electron:coverage` | 84.29% lines | 35 of 46 `electron` files |
| honest, whole surface | **48.17%** (25 395 / 52 715) | **986**, 502 of them at exactly 0% |

Measured 2026-09-26 @ `22217577` by
`.claude/skills/owa-upgrade-unit-test/scripts/coverage-gap.mjs`, which passes
`--coverage.include` for `src/**`, `electron/**` and
`tools/owa-devtools-mcp/*.mjs`.

**Why it matters:** the reported figure moves the wrong way. Delete a test that
loads a big untested module and the denominator shrinks with it, so coverage
*rises* while the suite got weaker. Any goal, threshold or progress claim set
against that number is measuring the wrong thing.

By kind, honestly: `module` 70%, `*Helpers.ts` 57.3%, **`*Comp.tsx` 10.1%**
(415 files — about half the whole remaining gap), renderer entry files 0%.
Two folders are dark — `src/presenting-flow` (29 files, 0.4%) and
`src/presenter-foreground` (28 files, 0.2%) — and the cause is recorded, not
mysterious: the 2026-08-24 prune that deleted `appProvider.mock.ts` took 65
test files with it. See [[appprovider-mock-node-env]].

**How to apply:**

- Quote the honest number, from `coverage-gap.mjs`, never `test:coverage`.
- Full instrumentation costs ~2.5× wall clock (src 124 s vs 55 s, electron 33 s
  vs 9 s) and pushes `src/_screen/components.smoke.test.tsx` past the committed
  10 s `testTimeout` — pass `--testTimeout=60000`, or a timeout reads as a test
  you broke.
- **A failing test means vitest writes no coverage report at all**, so a gap
  number is unavailable until the suite is green — not merely stale.
- Adding `coverage.include` to the committed configs would fix the reported
  number for everyone, at the cost of that 2.5× on every `test:coverage` run.
  Not done; it is a decision for the user.

Related: [[vitest-env-leak-flakes]],
[[vitest-mock-factory-survives-resetmodules]].
