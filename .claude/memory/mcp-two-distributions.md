---
name: mcp-two-distributions
description: "The MCP server ships outside the checkout two ways -- npm `open-worship-app-mcp` and a Node single executable in the extra-bin pack -- and the user ruled they may not differ in what they do"
metadata:
  node_type: memory
  type: project
  modified: 2026-11-13T21:00:00.000Z
---

Since 2026-11-13 the stdio door of `tools/owa-devtools-mcp` reaches an outside
agent without this checkout, two ways:

- **npm**: `npm run build-open-worship-app-mcp` stages, checks and writes the
  package `open-worship-app-mcp` into the sibling repo `../owa-mcp-dist`
  (`--out`, `--version`, `--dry-run`, `--no-verify`, `--live[=dev|prod]`). Its
  version follows the app's (`2026.11.02` → `2026.11.2`). It carries the MCP
  tests that run without the app checkout, the `owa-robot-test` skill and the
  coverage matrix, and all 87 languages' TEXT (no fonts, no `.gz.bundle`).
  The script publishes, commits and pushes nothing.
- **Executable**: the extra-bin pack's `mcp/open-worship-app-mcp[.exe]` from
  0.0.6 (see [[extra-bin-on-demand]]), for a machine with no Node; Settings →
  Extra Binaries → **AI agents (MCP)** hands out the command or settings text
  for the AI client chosen in its picker (W-62).
- **Both carry the app version they were made from** (`mcp-version.json`
  beside the server, written by `stageMcpRuntimeTree`; `mcpVersion.mjs` falls
  back to the root `package.json` in a checkout). On the stdio door
  `owa_app_state` answers `versionCheck` and `owa_choose_app` picks among
  several running apps -- the server drives none of them until one is chosen
  (`appChoice.mjs`, `requireAppChoice`; the user: _make the mcp to remind
  agent to check mcp version and app version_, _let user pick one to work
  with_). A pack built before this has neither: its server reads the version
  as unknown and drives the newest app.

**Why these choices** (the user's, 2026-11-13):

- _"npm mcp and the single executable have to be no different
  functionalities."_ So the runtime is a Node single executable (SEA) loading
  the very same files from disk. A QuickJS proxy was proposed for size and
  dropped: it could do nothing without the app and had no `owa_drop_files`.
- _"not doing a pre-build like ffmpeg, yt-dlp … but do bundle to executable
  file include in extra-bin package (with new version of the extra-bin)"_ —
  so it is built at pack time from the tree, never committed per platform.
- _"make sure the npm package export typescript and javascript api as
  well"_ — `index.mjs` + hand-written `index.d.mts`, typed against the code
  by `src/test-setup/owaMcpPublicApi.test.ts`.
- Languages: _all 87, text files only_.

**How to apply:**

- One staging function feeds both (`stageMcpRuntimeTree`,
  `extra-work/mcp-dist/mcpRuntimeTree.mjs`); add a runtime file THERE, never
  to one output. The npm build's parity check (`checkParity`,
  `mcpHandshake.mjs`) builds an executable from the same staged tree and fails
  on any difference in `tools/list` or the offline answers -- keep it on.
- The gate refuses: git-ignored files, binaries, a credential-shaped string not
  in `secret-fixtures.json` (SHA-256 prefixes of the firewall tests' made-up
  values, never the values), the git user's email, and the builder's home
  folder in code or data (prose gets `~`). Never widen the baseline to make a
  build pass without reading the line.
- The API strips `mcpToken`; `index.test.mjs` holds it.
- **Verify against a CLEAN install, not the repo's node_modules**
  (`checkCleanInstalls`). The first real build passed all 142 test files
  with the repo's node_modules linked, and in the dist's own `npm install`
  25 could not start: `jsdom` (twenty `@vitest-environment jsdom` files;
  the repo has it only through `markdown-it-music` → `global-jsdom`) and
  `monaco-editor` (open-lyric's optional peer, imported as it loads). A
  package a shipped test needs goes into `TEST_DEV_DEPENDENCY_LIST`;
  `checkTestPackages` catches what reading the tests can see (imports, the
  environment pragma), the clean installs the rest. Installs use npm's cache
  first and no install scripts; with no registry they report NOT CHECKED.
- The executable needs an official nodejs.org Node on each release machine
  (`readNodeSeaSupport`); on macOS it is ad-hoc signed after `xattr -c`
  (a quarantined copy hung Gatekeeper at first launch).
- Seen live 2026-11-13 on a scratch dev profile: discovery, a screenshot, a
  Settings tab press, "Delete everything" and `evaluate_script` refused, and
  Claude Code reporting the executable connected.
