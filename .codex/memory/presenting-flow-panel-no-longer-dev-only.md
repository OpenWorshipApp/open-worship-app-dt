---
name: presenting-flow-panel-no-longer-dev-only
description: The Presenting Flows panel lost its isDev gate in commit 203d35cc and took the removed Lyric List's slot — every doc saying "dev builds only" is stale
metadata:
  type: project
---

Commit `203d35cc` (2026-08-04) deleted the `appProvider.systemUtils.isDev` gate in
`src/presenter/AppPresenterLeftComp.tsx`. The presenter's left column now holds exactly
two widgets — **Documents** (`v1`) and **Presenting Flows** (`v2`) — because the separate
**Lyric List** widget was removed at the same time (see [[lyric-in-documents-list]]).
The Presenting Flows panel therefore ships in packaged builds.

**Why it matters:** a large amount of documentation was written while it WAS dev-only and
says so. Fixed on 2026-08-04 in `docs/test-paths/coverage-matrix.md` (PL-10, PL-29,
PL-32..PL-48 lost their "dev only / else BLOCKED" note, new row PL-49 pins the placement),
`user-workflows.md` W-22, `references/ui-map.md`, `references/components-path.md` and
knowledge-base §14. The `coverage-expansion/` scratch files still say it — those are
historical discovery notes, don't bother.

**How to apply:** never mark a PL presenting flow row BLOCKED "because it's dev-only", and don't
re-add that caveat to a tutorial. If a run on a packaged build can't find the panel, that
is a real finding, not the expected gate.

See also [[presenting-flow-references-vs-presets]] for what the panel stores.
