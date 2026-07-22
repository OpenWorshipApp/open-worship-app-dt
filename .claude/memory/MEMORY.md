<!-- Project knowledge (performance rules, dev-launch/lint gotchas, CDP driving
notes, rendering/event architecture gotchas, print flow, codebase patterns,
owa-robot-test directives) now lives in the repo at `.claude/CLAUDE.md`, which
is loaded every session. Don't duplicate that content here — add a memory file
only for something NOT captured in CLAUDE.md or the codebase. -->

- [Foreground sync shared refs](foreground-sync-shared-refs.md) — sync-grouped screens share identical foreground-data objects; never key a module-global map by them
- [Screen draw feature](screen-draw-feature.md) — FreeShow-style Draw overlay; Paint-only shipped (Fill/Pointer/Focus/Particles deferred, Zoom skipped); native-px coords + incremental begin/points sync
- [Screen focus spotlight](screen-focus-spotlight.md) — Focusing = its own `#focus` layer/manager, NOT a draw mode; radial-gradient mask (a big box-shadow silently won't paint)
