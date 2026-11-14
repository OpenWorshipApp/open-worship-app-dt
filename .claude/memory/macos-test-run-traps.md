---
name: macos-test-run-traps
description: The suites were written and run on Windows; on macOS 17 electron tests failed for three platform reasons (temp folder behind a link, a reset instead of a FIN, the darwin microphone ask) -- how each was fixed in the test, not the app
metadata:
  type: project
---

The first whole-surface coverage run on a Mac (2026-11-11, UT-101) failed
the electron suite in 7 files / 18 tests that are green on Windows. vitest
writes no coverage report when a test fails, so the number could not be
measured until all were fixed. Three causes:

- **`os.tmpdir()` is behind a link on macOS** (`/var/folders/...` ->
  `/private/var/folders/...`; `/tmp` -> `/private/tmp` too). Screen Mirror's
  `MirrorContentRegistry.serve` refuses a published file whose
  `realpath` differs from its published path -- a path through ANY link, on
  purpose: two tests publish through a directory junction and expect 404.
  So every test that published a file from `mkdtemp(tmpdir())` got 404.
  Fixed in the tests: `directory = await realpath(await mkdtemp(...))`.
  The app was NOT changed: whether a data folder behind a link (a temp
  folder, a symlinked Dropbox folder) should serve is the user's decision;
  reported 2026-11-11.
- **A destroyed server connection is a RESET on macOS, a FIN elsewhere.**
  `events.once(socket, 'close')` rejects on the reset's `error`
  (`ECONNRESET`). Wait for `close` with an `error` listener attached.
- **`process.platform === 'darwin'` branches ask for the microphone**
  (`systemPreferences.askForMediaAccess`) in `screenMirrorService.setIntercom`
  and `virtualDisplayService.setMp4Mic`. A test file whose electron mock has
  no `systemPreferences` throws; the shared `testElectronModule` mock is a
  bare `vi.fn()` that answers `undefined`, which reads as denied. Grant it
  in the test (`mockResolvedValue(true)` in `beforeEach`, since `mockReset`
  is on) when the test is about what happens after the person allowed it.

**Why:** each looks like a broken feature, not a platform difference, and
one of them blocks the whole measurement.

**How to apply:** a test that touches the temp folder, a socket's end, or a
platform branch should hold on every OS the user develops on (Windows and
macOS both). Related: [[coverage-run-load-flakes]],
[[stale-node-modules-blocks-coverage]].
