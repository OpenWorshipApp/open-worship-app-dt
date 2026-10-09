# Checks — what each lead means, how to kill it, how to fix it

`scripts/audit-agent-docs.mjs` turns the agent documents into claims and tests
each one against the repo. A hit is a lead. This file lists, per check, the
false positives seen when the checks were calibrated on 2026-10-08, the move
that confirms or kills a lead, and the fix class. **fix** means safe to apply
in a `drift` run. **ask** means a decision for the user. **route** means it
belongs to another skill. Then come the reading checks no script can do.

Calibration run (HEAD `8a3a1e3f`, 245 docs, 16 265 code spans and links, 1.2 s):
19 gone paths, 32 unknown file names, 145 unknown code names, 7 tools CLAUDE.md
omits, 1 note with no front matter, 2 skills missing from both skill indexes,
and 148 notes whose named code moved since their last edit.

## Drift checks

### `paths` — repo paths, links and anchors

- **Reads.** Backticked tokens under a known root (`src/`, `electron/`,
  `tools/`, `extra-work/`, `docs/`, `html/`, `e2e/`, `public/`, `resources/`,
  `.claude/`, `.codex/`, `.agents/`). It also reads `scripts/…` and
  `references/…` relative to the skill a doc sits in, and markdown links
  relative to the doc. `file:120`, `file:12-20` and `#L12` anchors are checked
  against the file's length. A bare **code** file name (`boot.ts`) must be
  carried by some file.
- **Never checked.** Generated or ignored roots (`electron-build/`, `dist/`,
  `release/`, `test-results/`, `node_modules/`), placeholders (`<os>`, `*`,
  `…`), absolute paths, and runtime data names (`setting.json`, `.bg.json`,
  `index.json`).
- **False positives.** A folder named without its trailing slash that is
  ignored on disk (`public/modules`). A note *about* deleting something, such
  as the deleted shared appProvider mock in memory
  `appprovider-mock-node-env`, which records the prune.
- **Confirm.** `git log --diff-filter=D --oneline -- <path>` shows when it
  went. `git log --all --format=%h --name-status -- '*<name>*' | head` shows
  where it went.
- **Fix.** If it moved: re-point it, which is **fix**. If it was deleted and
  the note is present tense, say so in the note's own voice, which is **fix**.
  If it was **a test cited as a guard** (the presenting-flow notes still cite
  their auto-next and media-control tests): mark the guard gone (**fix**), then
  propose a rebuild through `owa-upgrade-unit-test` as an AD item (**ask**).
  The 2026-08-24 prune deleted 65 test files, and several notes still cite
  them as protection.

### `symbols` — code names the code does not hold

- **Reads.** Backticked camelCase with a hump, PascalCase with two humps, and
  SCREAMING_SNAKE, at least 6 characters. These are matched against every
  identifier in the code, the skills' own scripts,
  `node_modules/electron/electron.d.ts` and TypeScript's DOM typings.
- **False positives (~a third at calibration).** Chrome DevTools Protocol
  methods, Win32 and macOS window APIs, React fiber internals, Prettier
  options and Claude Code's own tool names. The ones a run proved external
  are in the script's `EXTERNAL_NAME_SET`; add to it only with that proof.
  Illustrative names, such as the example in CLAUDE.md's naming rule, are
  another source.
- **Confirm.** `git log -S'<name>' --oneline -- src electron tools | head -3`.
  The newest commit that removed it says what it became. Then grep the
  likely successor.
- **Fix.** A rename is **fix**. If the thing was removed and the note still
  relies on it, rewrite the sentence around what holds now (**fix**), or
  **ask** when the removal looks accidental. An illustrative name that does not
  exist can stay, but a real example is better, because an agent may try to
  open it.

### `tools` — the `owa_*` surface

- **Reads.** Tools registered by `server.registerTool('owa_…'` or by
  `name: 'owa_…'` in `tools/owa-devtools-mcp/*.mjs`. Every `owa_*` a doc
  names must be registered or appear in the code. Three listings are held to
  completeness: CLAUDE.md, `rules/agent-tools.md`, and the MCP README. A
  family written `owa_guide_start` / `_step` counts as listing `_step`.
- **Confirm.** Read the listing's own framing. CLAUDE.md says *"PLUS app-level
  ones —"* followed by a list, so it claims completeness, and the 7 missing at
  calibration (`owa_bible_*`, `owa_foreground`, `owa_list_questions`,
  `owa_present_bible`, `owa_undo`) are drift. `agent-tools.md` documents
  behaviour per subsystem and may not intend to list every tool, so read it
  before calling it incomplete.
- **Fix.** Add the missing names in the listing's style (**fix**). Mind
  CLAUDE.md's bytes: one short clause per family, not a sentence per tool. A
  doc naming an unregistered tool means it was removed or renamed:
  `git log -S"'owa_x'"` (**fix**).

### `scripts` — `npm run` and script flags

- **Reads.** `npm run <name>` against `package.json`. A name followed by `<`,
  `{`, `*` or `|` is a family (`pack:<os>`) and is skipped. `node
  <script>.mjs --flag` in a code span: the script's source must contain the
  flag.
- **Fix.** Rename the script or flag (**fix**). A documented flag the script
  lost may be a regression in the script: **ask**.

### `env` — `OWA_*` variables

- Every `OWA_*` a doc names must appear in the code. A missing one is a removed
  override. Agents set these, so a dead one silently does nothing. Usually
  **fix**.

### `ids` — `EN/EC/MC/AC/AD/UT-xx`, `W-xx`, matrix ids

- **Reads.** Each id must appear in its owning ledger. `W-xx` must be a `###`
  heading in `user-workflows.md`, and matrix prefixes (`CB`, `PL`, `MD`, `SC`
  …) must appear in `docs/test-paths/coverage-matrix.md`.
- **Fix.** A typo is **fix**. An id renumbered in the matrix
  (`coverage-expansion/README.md` records such moves) is **fix** in live docs
  and **history** in ledgers.

### `memory` — the index and the notes

- **Reads.** Each MEMORY.md link has a note, and each note has an index line.
  Front matter must have `name` equal to the file name, a `description`, and
  `metadata.type` from `user | feedback | project | reference`. Every memory
  reference (*memory* followed by a backticked slug) and every `[[…]]` link
  must resolve to a note.
- **Fix.** All of these are **fix**, except deleting a note (**ask**). A note
  the index never names is invisible to every session: add its line, short.
- **Watch.** The index is loaded into every session (first 200 lines, as
  Claude Code loaded it when this was written). Lines over ~220 characters are
  an L2 lead. A line is a hook, and the detail belongs in the note.

### `rules` — `paths:` front matter

- **Reads.** Each `paths:` glob must match a file. A glob over an ignored
  folder counts as matching if its fixed prefix exists on disk. A rule must
  have `paths:`, and CLAUDE.md must name each rule file.
- **Fix.** If the folder moved, re-point the glob (**fix**). A rule with no
  `paths:` never loads by itself: **ask** what should trigger it.

### `skills` — wiring and the mirror

- **Reads.** `SKILL.md` exists with `name` equal to the folder. The skill is
  listed in CLAUDE.md "Project skills" and has a `## <name> skill` section in
  `rules/project-skills.md`. A Codex mirror exists, with the same body after
  `### Full workflow scope (preserved from Claude)`, the same preserved
  description, and `Arguments:` matching `argument-hint`. YAML `''` is
  unescaped before comparing.
- **Description length.** The listing a session picks skills from cuts each
  description at ~1 530 characters (measured 2026-10-08). Text past the cut is
  never read when a skill is chosen, so trigger phrases must sit early. This
  is an L6 lead. Change another skill's description only on **ask**.
- **Fix.** Index and mirror omissions are **fix**. Whether
  `review-stagged-change` / `review-unstagged-change` belong in the "Project
  skills" index is an **ask**: they may be left out on purpose as generic.

### `mirror` — `.claude` → `.codex` / `.agents`

- Exact-copy drift with direction. A **mirror newer** than its source means an
  edit landed on the wrong side: port it to `.claude/`, then copy again.
  `.mcp.json` servers must also be registered in `.codex/config.toml`.
- **Fix.** Re-copy (**fix**). For a mirrored `SKILL.md`, rebuild the Codex
  preamble from `AGENTS.md`'s rules: a short discovery description,
  `## Codex usage`, `Arguments:`, the full description under
  `### Full workflow scope (preserved from Claude)`, then the exact body.

### `knowledge` — the 🤖's copy

- `electron-build/knowledge/index.json` older than a doc means the in-app
  assistant answers from the old text. Rebuild after the run's edits
  (Non-negotiable 4). If a dev app may be in use, defer the rebuild and say so.

## Leverage signals (see leverage.md)

- `budget`: always-loaded bytes (≈ tokens), CLAUDE.md sections by size,
  MEMORY.md long lines, rule sizes.
- `coverage`: code areas ranked by *(commits + 2 × fix commits + files ÷ 5) ÷
  (1 + docs naming them + 3 × rules covering them)* over 60 days.
- `staleness`: per note, the commits since its last edit that touched the
  files it names. Hot data files (`src/lang/data/**`, `package*.json`) are
  ignored.
- `prose-rules`: paragraphs in CLAUDE.md and the rules that say *must /
  never / always / same change* and name no test, script, gate or hook.

## Reading checks: what no script sees

Do these by hand. In `auto`, cover CLAUDE.md fully, plus the top of the
`staleness` list.

1. **Numbers.** Ceilings, limits, counts and ports (`MODEL_TOKEN_CEILING`,
   `MAX_TOOL_ROUNDS`, the MCP port, rate limits): read the constant. A
   present-tense number that differs is drift. A dated one is history.
2. **Commands.** Every command CLAUDE.md tells an agent to run must still run
   as described. Check it against `package.json` and the script's argument
   parsing. A command named *safe beside the running app* must really be safe:
   S1 if not.
3. **"Only", "every", "never", "always".** Universal claims break first. `rg`
   for a counter-example: a second call site, a new window, a new tool.
4. **Behaviour.** *"X returns Y"* and *"the window shows Z"*: read the code
   path. If it is cheap and read-only, confirm it live (`owa_app_state`,
   `owa_find_ui`, `owa_list_ui`).
5. **Contradictions between docs.** The same fact in two places drifts apart.
   Common pairs: CLAUDE.md against a rule, a rule against a memory note, a
   SKILL.md against its references, `project-skills.md` against a skill. Keep
   the fact in one place and point to it from the other. Which place is
   **ask** if it moves text between always-loaded and on-demand.
6. **Pointers to nothing.** *"see the X section"*, *"§4.6"*, *"the table
   below"*: does the target exist?
7. **Restating the code.** A note that only describes what the code plainly
   says costs bytes and rots. Propose trimming it (**ask**). Keep what the
   code cannot say: the *why*, the trap, and the decision.
