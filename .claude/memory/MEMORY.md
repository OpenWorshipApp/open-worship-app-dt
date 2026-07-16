<!-- Project knowledge (performance rules, dev-launch/lint gotchas, CDP driving
notes, rendering/event architecture gotchas, print flow, codebase patterns,
owa-robot-test directives) now lives in the repo at `.claude/CLAUDE.md`, which
is loaded every session. Don't duplicate that content here — add a memory file
only for something NOT captured in CLAUDE.md or the codebase. -->

- [Foreground sync shared refs](foreground-sync-shared-refs.md) — sync-grouped screens share identical foreground-data objects; never key a module-global map by them
