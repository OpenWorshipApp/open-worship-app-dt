---
name: presenting-flow-rename
description: The run-sheet subsystem was renamed to "presenting flow"; two lookalike survivors must never be swept up, and the migration discovers the old name instead of naming it
metadata:
  type: project
---

On 2026-08-07 the whole run-sheet subsystem was renamed away from its old name to
**presenting flow** — `src/presenting-flow/`, `PresentingFlow*`/`presentingFlow*`
identifiers, `presenting-flow-*` kebab keys and CSS classes, `PRESENTING_FLOW`
constants, the `Presenting Flows` UI label (and its Khmer key), the data folder
`presenting-flows`, and the file extensions `.owp` → **`.owpf`** / `.owapl` →
**`.owapf`**. The requirement was absolute: the old word appears nowhere in the
project, not even as a legacy constant.

**Two survivors are NOT the subsystem and must never be renamed:**

- `--no-playlist` in [src/server/appHelpers.ts](../../src/server/appHelpers.ts) —
  yt-dlp's own CLI flag. Renaming it breaks every media download
  ([[owa-robot-test-presenting-flow-mode]] rows `MD-01..04`).
- `displayListeners` in `src/_screen/preview/preview.runtime.test.tsx` — the
  letters `playList` fall inside `di-splayList-eners`. A case-insensitive sweep
  corrupts it.

**The one-off migration** lives in
[src/helper/presentingFlowRenameMigration.ts](../../src/helper/presentingFlowRenameMigration.ts),
is dynamically imported from `init()` only while
`PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME` is unset, and claims that marker
BEFORE doing the work so two windows opening together cannot both run it. It
**discovers** the old name rather than holding a copy: it looks for the
`select-dir-*` setting that is not in `dirSourceSettingNames` and whose folder
holds `.owp` files, then takes the token out of that key name. That token drives
the folder rename (only when the basename is the app's own `<token>s` default —
a user-chosen folder stays put), the `.owp`/`.owp.histories` renames, and the
rewrite of every setting key the token or the sanitized old path is baked into.

**Why:** a rename this wide is easy to redo wrongly — either by sweeping up the
two lookalikes, or by reintroducing the old word "just for the migration".

**How to apply:** before any future sweep for a leftover, check the two
survivors first. If the migration ever needs extending, extend the discovery,
not a hard-coded name. See [[presenting-flow-drag-and-settings-rules]] for the
setting-name sanitizing rules the key rewrite depends on.
