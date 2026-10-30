---
name: parallel-test-agent-coverage-run
description: "Lessons from UT-70 (81.4% -> 95.25% with 17 parallel test-writing subagents) — what wiped the shared report, what the gate checks, how many agents the machine and the usage limit take"
metadata:
  node_type: memory
  type: project
  originSessionId: 6b19606d-e141-42af-a60b-ae00eb15e7c4
  modified: 2026-10-29T19:21:54.241Z
---

UT-70 (2026-10-28/29) raised honest line coverage 81.40% → 95.25% by cutting
the gap into disjoint folder slices and running test-writing subagents in
parallel on one shared brief (owa-upgrade-unit-test `references/baseline.md`).
What cost time, so the next run does not pay it again:

- **`coverage-gap.mjs` with ANY flag but its own starts a full run.** An agent
  ran `--help` to read the usage; vitest empties its `reportsDirectory` at
  start, so `cov-src` was wiped for everyone using `--no-run --uncovered`.
  Tell agents: `--no-run` always, never another flag; focused coverage goes
  to their own `--coverage.reportsDirectory`.
- **`src/**` test files are type-checked by the gate** (`lint:all:error`,
  strict + `noUnusedLocals` / `noUnusedParameters`); `electron/**` tests and
  `tools/**/*.test.mjs` are not, and `lint:es` skips src tests. A
  `let onChange: ReturnType<typeof vi.fn>` passed as a typed prop fails —
  write `Mock<(value: number) => void>`. Agents can check only their own files
  with a scratch tsconfig that `extends` the repo's and `include`s
  `src/**/*.d.ts` plus their tests.
- **17 concurrent agents** held the 12-thread machine at 100% CPU and spent the
  account's 5-hour usage limit in ~2 hours: every agent stopped mid-slice and
  four slices never started. Run ~8 at a time; the subagent cap is 20.
- **Full-suite runs under that load time out** (a HEAD-worktree rebuild of the
  report failed on `tranKeyCoverage` / `manualRecipes` past 60 s). Measure
  when the agents are idle.
- **Do not put a test file in `src/lang/data/`**: the MCP `tran.mjs` test lists
  that folder as language packs.
- **The file-writing tool turns `\uXXXX` in its content into the character**,
  so a test meant to read `'\u200B'` held an invisible U+200B, and a U+2028
  in a regex literal broke the file. Build such characters at run time or fix
  them afterwards.
- Agents searching `extra-work/` recursively ran for minutes past their own
  timeout (multi-hundred-MB binaries); confine searches to `src`, `electron`,
  `tools`.

Related: [[coverage-number-is-loaded-files-only]],
[[vitest-env-leak-flakes]], [[appprovider-mock-node-env]].
