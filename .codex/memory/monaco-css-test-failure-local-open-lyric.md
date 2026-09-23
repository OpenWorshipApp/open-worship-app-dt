---
name: monaco-css-test-failure-local-open-lyric
description: open-lyric IS now importable in vitest — server.deps.inline landed 2026-08-24 with a jsdom recipe; tests that don't want it must still mock it, never import it in node env
metadata:
  type: project
---

History: the local `file:` open-lyric dep used to fail tests with
`Unknown file extension ".css"` (monaco css reaching node's ESM loader raw);
fixed 2026-08-07 by mocking open-lyric in `Lyric.test.ts` and moving
`initLyricMock`'s early return above its dynamic imports. Back then
`test.server.deps.inline: ['open-lyric']` was tried and rejected because tests
were importing open-lyric incidentally and its browser code died in the node
environment.

**Changed 2026-08-24 (SongSelect integration):** `vitest.config.ts` now DOES
carry `test.server.deps.inline: ['open-lyric', /monaco-editor/]`, and the full
suite is green. It is safe now because inlining only affects modules a test
actually imports — and only two tests import the real open-lyric, both
deliberately: `src/plugins/song-select/songSelectLyricHelpers.test.ts` (via the
app wrapper `checkOpenLyricMarkdown`, which wraps `api.document.checkMarkdown`,
transitively) and
`src/plugins/public-domain-songs/publicDomainSongsHelpers.test.ts:20-24`
(direct `await import('open-lyric')`, also driving `new OpenLyric()` for
attachment parsing) — both as validation oracles.

**Why:** the real validator catches mapping bugs (structure codes, fence
rules) that a mocked open-lyric would wave through.

**How to apply:** to import the REAL open-lyric in a test, copy
`src/plugins/public-domain-songs/publicDomainSongsHelpers.test.ts:17-24`
(the cleaner copy-source for this recipe):
`// @vitest-environment jsdom`, then patch
`document.queryCommandSupported ??= () => false` and
`document.execCommand ??= () => false` (monaco's clipboard contrib probes both
at module-eval time; jsdom has neither), then **dynamic-import** the module
under test AFTER the patch (static imports hoist above it). Tests that do NOT
want open-lyric must keep mocking it (`vi.mock('open-lyric', …)`) — and a
node-env test must never import it at all ([[appprovider-mock-node-env]]).
See [[open-lyric-fence-ground-truth]] for what the real API exposes and
[[open-lyric-subtree-branch-dep]] for how the dep is consumed.
