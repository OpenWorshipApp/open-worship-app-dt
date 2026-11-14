---
name: coverage-run-load-flakes
description: Tests that pass alone fail only under the whole-surface coverage run on a loaded machine -- a hard per-test timeout, a count-based poll for a lazy chunk, a stream-open race; how each was fixed and how to make the race reproducible
metadata:
  type: project
---

The whole-surface run (`coverage-gap.mjs`) instruments every source file and,
during a parallel batch session, shares the CPU with several focused vitest
runs. Three failure classes showed up there only, never focused (2026-11-03):

- **A test's own timeout beats `--testTimeout`.** `coverage-gap.mjs` passes
  `--testTimeout=60000`, but `tools/owa-devtools-mcp/undeclaredNames.test.mjs`
  ended `}, 30000)`: ESLint over every module takes 1-4 s alone and went past
  30 s under load. Raised to 120 s. A timed-out test means NO coverage report.
- **A poll counted in tries, not time.** `src/helper/errorReportOfferPress.test.tsx`
  waited for a `lazy()` dialog chunk 50 × 20 ms -- about a second -- and the
  chunk's first transform under instrumentation took longer (2 of 3 loaded
  runs). Now a 5 s wall-clock deadline, plus a `beforeAll` that imports the
  chunk once (60 s hook) so the cold transform is not raced at all.
- **A stream-open race nobody could see** (`bibleXmlDraft.mjs`, a body that
  failed at once left `<id>.xml.part` behind: the `rm` ran before the write
  stream's delayed open created the file). It never showed in 60 straight
  runs. Made deterministic by slowing `fs.open` for that path in the test --
  `fs.WriteStream` reads `open` off the `fs` MODULE OBJECT when it opens, so
  `import fs from 'node:fs'; fs.open = ...` reaches it (restore it in
  `onTestFinished`). A script outside vitest also needs the test's
  `vi.mock('node:dns/promises')` equivalent, or the address check refuses
  `*.example` before any stream opens.

**Why:** each looks like an unrelated break in an untouched file, and the
first two block the whole report (and `npm run lint`'s `test:all` on a slow
machine).

- **A fixed number of event-loop hops before a lazy import is read**
  (2026-11-14, UT-102). `ChatbotAppComp.ask.test.tsx`'s `settle()` turns
  the loop twice, and _a word typed alone in a new tab is asked about_
  waited on the question corpus, which `questionHelpers.ts` reads once by
  dynamic imports (`questionMatch.mjs` and every page JSON). Focused it
  passed every time; cold under the whole-surface run the read outlasted
  the two hops and no answer was drawn, so the first measurement wrote no
  report. A `beforeAll` that loads the corpus once (`genTopicChoices`)
  ended it -- the same cure as the lazy dialog chunk above.
- **The tree changed under the run** (2026-11-04). The suite reads files as
  it reaches them, so a commit or a save made mid-run is half in the run:
  four tests failed on files committed during it, all green when re-run.
  Note `git rev-parse HEAD` (and `git status`) before and after a run, and
  re-run alone what failed before believing it.

**How to apply:** in a test, wait by a deadline and pre-load what is lazy;
never give a slow test a hard timeout under 60 s; when a race reproduces only
under load, make the slow step slow on purpose in the test rather than
retrying. See [[vitest-env-leak-flakes]] for the other flake class and
[[coverage-number-is-loaded-files-only]] for the measurement.
