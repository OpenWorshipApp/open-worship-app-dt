* PDF Lib: https://github.com/mozilla/pdf.js

# User manual (VitePress) — and the single source of truth for test paths

A Blender-style user manual for Open Worship App, built with
[VitePress](https://vitepress.dev). The manual and the owa-robot-test skill's
test paths are **generated from one file**, so they can never drift apart.

## The single source of truth

```
.claude/skills/owa-robot-test/references/user-workflows.md   ← canonical, live-verified
        │
        │  node docs/scripts/build-manual.mjs   (pure Node, no deps)
        ▼
docs/manual-sources/**            ← the rendered manual (per-workflow pages, W-xx)
docs/.vitepress/sidebar.generated.json  ← nav tree
docs/test-manifest.json           ← machine-readable BRIDGE for the QA robot
```

- **Humans** read `docs/manual-sources/**` rendered by VitePress.
- **The robot** reads `docs/test-manifest.json`: for each `W-xx` it gets the
  ordered `steps` to drive and the `verify` coverage-matrix rows the path proves
  (e.g. `PL-01`, `PM-05`…). Verifying a manual page == running its matrix rows.

Test metadata lives in each page's YAML **frontmatter** (`id`, `verify`,
`screenshots`), so it is invisible in the published manual but fully parseable.

## Commands

```bash
npm run docs:gen      # regenerate manual-sources/, sidebar, and test-manifest.json
npm run docs:dev      # gen + live dev server (http://localhost:5173)
npm run docs:build    # gen + static build into docs/.vitepress/dist/
npm run docs:preview  # serve the built site
```

> VitePress is a dev dependency installed with `--ignore-scripts` so it does not
> trigger this repo's `install` hook (`extra-work/bin-helper/build.sh`, which
> runs a .NET build + downloads yt-dlp). If you ever reinstall it, keep that flag.

## Editing content

`docs/manual-sources/**` is **generated** — do not hand-edit it (a re-gen wipes
it). Edit `user-workflows.md` (the canonical source), then run `npm run docs:gen`.
Only `docs/.vitepress/config.mts` (theme/nav) and `docs/scripts/build-manual.mjs`
(the generator) are hand-maintained.

To later flip canonicity — make the manual pages canonical and hand-author them —
keep the manifest+sidebar pass of the generator (it reads page frontmatter) and
drop the split-from-`user-workflows.md` pass. The manifest schema is unchanged.

## Auto-refreshing screenshots (the payoff)

Each page's frontmatter carries a `screenshots` count and the source marks `📸`
checkpoints. Because the robot already walks every `W-xx` path on a run, the same
run can drop fresh screenshots into the manual's assets at each `📸` — so the
manual's images are produced by the run that verifies the manual, and never go
stale.
