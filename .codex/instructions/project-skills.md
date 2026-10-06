---
paths:
  - ".claude/skills/**"
  - ".agents/skills/**"
  - "docs/test-paths/**"
  - "test-results/**"
  - "src/helper/extra-bin/**"
  - "electron/client/ytUtils.ts"
  - "extra-work/build-extra-bin.mjs"
  - "vitest*.config.ts"
---

# Project skills in detail

The long form of the skill index in `.claude/CLAUDE.md`. Each skill's own
`SKILL.md` is authoritative for how to run it.

## owa-robot-test skill

`.claude/skills/owa-robot-test` serves two roles: (1) QA robot testing with
honest coverage accounting (`docs/test-paths/coverage-matrix.md`, resumable via
`test-results/robot-test/coverage-<runid>.json`), and (2) the **source of truth
for user-facing documentation** (`references/user-workflows.md`, stable `W-xx`
recipes). When app UI behavior changes, update `user-workflows.md` +
`coverage-matrix.md` in the same change and bump their version dates; never
publish a tutorial step not observed working live.

**`prod` is a TARGET, not a focus** (2026-09-09, SKILL §2b, KB §18,
`scripts/prod-app.mjs`). `/owa-robot-test prod [focus]` builds the release
(`npm run pack:win|mac|linux` → `release/<os>-unpacked/`) and drives the
PACKAGED app instead of `npm run dev`, over the same procedure. What only that
run can see: the asar/`asarUnpack` layout, pages on `owa://local/<page>.html`
(not `https://localhost:3000`), and every `isDev` branch flipped — AI features
**OFF unless `ai-enabled` is `"true"`** in the un-suffixed
`%APPDATA%\open-worship-app\setting.json` (no CDP door at all otherwise;
`prod-app.mjs ai-status` / `enable-ai`, restored afterwards), `tran()`
returning English instead of throwing (the locale block asserts visually and
says the throw class is dev-only), no `data-react-comp-*` stamps, the Extra
Binaries pack downloaded from the real CDN, no main-process stdout (`SC-05`
BLOCKED). Three traps, all in the script: the pack's `npm run build` kills a
running dev app (or EPERMs and the BUILD dies) and an `electron:watch` chain
restarts it when `electron-build/` returns, after which it is the NEWEST
published instance and every `owa-devtools` call drives it — `owa_app_state`
must show `isDev: false` and an `owa://local` URL before anything counts; the
release-dir exe shares userData and the single-instance lock with the
installed app, so the second one quits silently; and
`ELECTRON_RUN_AS_NODE` makes the packaged exe run as Node exactly as it does
`npm run dev`. `launch` records the pid and `stop` kills that pid only.

`.agents/skills/owa-robot-test`, `.codex/memory/` and
`.codex/project-instructions.md` are the Codex MIRROR of this skill, of
`.claude/memory/` and of `.claude/CLAUDE.md` (with `.claude/rules/` →
`.codex/instructions/`); `AGENTS.md` at the
repo root says how each is copied (a mirrored `SKILL.md` keeps its Codex
frontmatter and usage notes, everything else is copied exactly). `.claude/` is
the source of truth: edit here first, then copy across in the SAME change.
Mirrors have drifted before (one fell several revisions and seven memory files
behind), so a mirror file that disagrees with its `.claude/` twin is stale by
definition — re-copy it rather than reconciling the two by hand.

**Screen controlling & presenting testing is mandatory in every run**, whatever
the focus area — presenting to a screen is the app's core purpose and screen-only
bugs never reproduce in the mini-preview. Each run must present a real item,
verify clear-button states, show the screen, drive the `screen.html?screenId=N`
CDP target, then clear/hide/restore. The only exclusion is _leaving_ a screen
taken over or touching a display the user says is in live use.

**`presentingFlow` is a tracked MODE, not a focus area.** `/owa-robot-test presentingFlow` runs the
11-phase deep pass (SKILL.md §6f, recipe test-plan §S20, model knowledge-base §14) over
the 69 run-sheet rows `PL-10, PL-29, PL-32..76, PL-81..102` with coverage accounting on
(`coverage-<runid>.json`, `"focus": "presentingFlow"`), a scratch `zz-robot-<runid>` fixture that
is torn down at the end, and the mandatory blocks ridden from the presenting flow itself. The
other PL rows are the Documents/Lyrics lists — same prefix, different subsystem — including
the newer `PL-103..104` (Import From SongSelect) and `PL-105` (Import From Public Domain Songs).

**Media download (video AND audio) is mandatory in every run too** (matrix rows
`MD-01..06`, SKILL.md §6e). `downloadVideoOrAudio` is the only **product** code
path that runs the `yt-dlp`/`ffmpeg`/`qjs` binaries (the dev-only experiments
page `src/experiments/html-in-canvas/youtubeDemo.tsx` also runs yt-dlp via
`resolveMediaStreamUrl` in `src/server/appHelpers.ts`), so a missing or broken
binary passes typecheck, tests, build and every other matrix row —
`checkIsExtraBinInstalled` only checks file existence, never executes. The video half proves the
ffmpeg merge, the audio half proves its mp3 encoder; both use the canonical link
recorded in the matrix. (The matrix lives at
`docs/test-paths/coverage-matrix.md`, not under the skill's `references/`.)

**Those three binaries are NOT bundled with the app** (refactor27). They ship as
a separate `bin-<ver>.tar.gz` the user installs from **Settings → Others → Extra
Binaries** into `<data parent dir>/extra-bin/<platform>/` (`yt/`, `ffmpeg/bin/`,
`qjs/`, plus `info.json` and the archive itself, which is kept on purpose so a
corrupted binary can be re-extracted offline). `<platform>` is the build's own
name for the pack (`win`, `mac`, `mac-int`, `linux-arm64` …): the data folder
travels between OSes on a stick, and one shared folder mixed their packs
(`EN-29`, memory `extra-bin-on-demand`). Consequences:

- A run on a fresh machine must **install the pack first** (`MD-05`) — a media
  download with it absent raises a confirm dialog that jumps to that panel
  (`MD-06`), which is correct behaviour, not a bug.
- In **dev the download is mocked**: it copies
  `extra-work/experiment-building/release/bin-<ver>.tar.gz`, which
  `extra-work/build-extra-bin.mjs` produces on `npm i` (the `install` npm
  lifecycle → `extra-work/build.sh`). No local pack means nothing to install.
- `electron/client/ytUtils.ts` no longer resolves any path; the renderer passes
  the yt-dlp path in (`src/helper/extra-bin/`). `extra-work/copy-build.mjs`
  still copies `eot2ttf` and `db-exts` — only the three media binaries moved.
- `extra-bin` is deliberately absent from
  `src/setting/directory-setting/dataDirectories.ts`, so it stays out of the
  `.owadata` whole-data archive.

**The media block deletes what it downloaded (`MD-04`).** It is the only part of
a run that writes ~100 MB into the user's data dir, and the app de-duplicates by
suffixing rather than overwriting, so an uncleaned run adds a copy every time —
17 stale copies (≈635 MB) had piled up in
`Desktop\open-worship-data-dev` by 2026-08-07. Sweep the videos/audios dirs
before downloading, and trash both files (row → **Move to Trash**, hidden while
the item is on a screen) as soon as the on-disk evidence is captured. A failed
download also leaves a `temp-*.part` behind. Deleting on disk needs piped
objects, not a glob — the names start with `[MV]` and `[` is a PowerShell
wildcard — and must match the **canonical video's title**, never `*YouTube*`:
the user's own library holds real downloads whose names also end in `- YouTube`.

## owa-enhance-chatbot skill

`.claude/skills/owa-enhance-chatbot` is the counterpart to owa-robot-test for the
**AI subsystem**: robot-test QAs the chatbot (`CB-01..CB-14`), this one changes
it. Scope is everything in _Agent access_ (`.claude/CLAUDE.md` and
`.claude/rules/agent-*.md`, `chatbot-*.md`) — `src/chatbot/*`,
`tools/owa-devtools-mcp/*`, `electron/aiHelpers.ts`,
`extra-work/build-knowledge.mjs` — with the MCP tool surface as its main subject.

**The chatbot is not good enough yet, and the skill is written as a climb, not as
maintenance.** It carries a six-rung ladder (it answers → answers correctly and
usably → acts reliably → trustworthy under pressure → situational → the fastest
way to use the app; currently around rung 2) and a `references/scoreboard.md` that
takes one row per run — pass rate, leaks, median tool rounds, cost, rung. Every
run must leave the assistant measurably better and say by how much, a question
that passed before must never come back failing, and when the evidence says the
current design _caps_ a rung, the finding is that — size the structural change and
put it to the user rather than shaving another 200 tokens off a description.

- **Tool surface IS chatbot performance.** `llmBotHelpers.ts` sends every tool
  `tools/list` returns to the model on EVERY round of the loop
  (`MAX_TOOL_ROUNDS` 10). Measured 2026-08-31: **42 tools, ~8.5k tokens/round,
  ~85k worst case for one question** — 29 of those tools are chrome-devtools' and
  include `evaluate_script`. Baseline it with
  `node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs` (reads
  `mcpUrl` and `mcpToken` from the published instance file, `--json`, and warns when an acting
  tool is missing from `notify.mjs`'s `ACTING_TOOLS`).
- **Every run researches before it builds** (`references/research.md`): ask the
  live assistant a standing corpus of real volunteer questions, grade each answer
  (correct? actionable? internals leaked? rounds used? did the walkthrough ring
  land?), mine the app for gaps it cannot see or do, and only then implement —
  graded against three axes, _smarter / easier / more impressive_. The argument
  `research` runs that phase alone and ships nothing.
- Tracked work carries stable `EC-xx` ids in the skill's `references/backlog.md`;
  add what you find there even when you don't do it.
- Same mirror rule as owa-robot-test: `.agents/skills/owa-enhance-chatbot` is a
  copy, `.claude/` is the source of truth.
- **A tool change is not done until it was driven against the running app.**
  Verify live first and run `npm run lint` last (it no longer builds into
  `electron-build/`, so it no longer kills that app) — and a knowledge change
  needs `node extra-work/build-knowledge.mjs` before it exists at all.

## owa-enhance-mcp skill

`.claude/skills/owa-enhance-mcp` owns the SERVER the other two skills use.
`owa-enhance-chatbot` owns the assistant (is the answer right?); this one owns
`tools/owa-devtools-mcp` itself — what the tools ARE, what they COST, and what
they are ALLOWED to do. If the complaint is "the answer was wrong" it is the
chatbot skill; if it is "the tool did the wrong thing / cost too much / should
not exist", it is this one.

Four properties held at once, and every change says which it trades away:
**safe** (§A + `references/threat-model.md`, which carries the proven exploit
and the harness that re-proves it), **cheap** (`references/tool-budget.md` — the
surface grew 19% in a day because adding a tool is easy and nobody is billed at
the time), **good for a developer** driving QA over stdio, and **good for the
chatbot** answering a volunteer over HTTP. Preference order for any change is
**remove → deny → merge → sharpen → add**. Tracked work carries `MC-xx` ids in
`references/backlog.md`; `MC-01` (the HTTP door's per-launch bearer token),
`MC-02` (the uid-aimed acting tools) and `MC-16`
(the window a slide's website loads in) are CLOSED, the latter down to a
documented `webSecurity: false` residual. `MC-14` put a RATCHET on the token
bill: `audit-mcp-tools.mjs --ratchet` fails when the model's surface crosses
`MODEL_TOKEN_CEILING` (7 450, against 7 253 measured since `MC-07` cut the
descriptions on 2026-09-18 — two of which contradicted the chatbot's prompt),
so a tool added without a decision cannot land quietly. Tool results are
compact JSON (`MC-33`): a result rides every later round, and indentation was
~31% of it. Same mirror rule:
`.agents/skills/owa-enhance-mcp` is a copy.

## owa-enhance-aichat skill

`.claude/skills/owa-enhance-aichat` owns the **AI Chat window** —
`html/aichat.html` → `src/aichat/*`, `electron/aiChatGuestHelpers.ts`, the ✨
right of the 🤖 — the one renderer in this app where a page nobody here wrote
runs: a company's own chat site in a `<webview>` guest. `owa-enhance-chatbot`
owns the assistant and `owa-enhance-mcp` the server; if the complaint is
"ChatGPT / Claude / Gemini will not load, sign in or pass its bot check inside
the app", "is it safe to hold a stranger's site in here", or a change to the
sites list, the tabs or the guest, it is this one. Its first property is the
guest staying a stranger — forced sandbox preferences, one locked-down
persistent partition, http(s) only, popups to the system browser, no
permissions, no preload, no node, a host page with no `require` — measured
from INSIDE the guest by `scripts/probe-aichat.mjs` over raw CDP (a
`<webview>` is not a `list_pages` target; `/json/list` names it). The browser
tells the truth about itself: `references/threat-model.md` carries the four
walls and the 2026-09-11 measurements (`navigator.webdriver` `true` as
launched; a plain-Chrome user agent looping Cloudflare's box on claude.ai
for good, Electron's own passing with no box), `references/backlog.md` the
`AC-xx` items. Same mirror rule: `.agents/skills/owa-enhance-aichat` is a copy.

## owa-enhance skill

`.claude/skills/owa-enhance` is the umbrella for the WHOLE app, asked for on
2026-09-14 as _research (planning without file update), then report and wait
to apply_. `/owa-enhance [auto | security | performance | reliability | ui |
dev-flow | code-health | docs | full]` researches, writes one report and
STOPS. Research changes nothing — no edit, format, stage, setting, user data,
screen or API credit — and its one write is a gitignored
`test-results/owa-enhance/report-<runid>.md`, which is also what lets
`apply EN-xx` work after the conversation is cleared. With no area it triages
every area first — `scripts/triage.mjs` (static leads: HTML sinks, module-level
maps, empty catches, mirror drift, repo paths in notes that are gone, the
sub-skills' open ids, the newest robot run; no app, no network) and
`scripts/app-vitals.mjs` (the running app's memory per process from the
operating system and per page over raw CDP — heap, DOM nodes, listeners) — and
researches the area holding the strongest surviving finding, ties going to
performance. Only an explicit `apply` changes anything, and then under this
file's rules: live proof, the gate last, the paper trail. The AI subsystems
stay with their own skills; app-wide findings carry `EN-xx` ids in
`references/backlog.md`. Two tool defaults its research contract exists to
catch, true for any session driving the live app: `performance_start_trace`
and `lighthouse_audit` both RELOAD the window they are aimed at unless told
`reload: false` / `mode: "snapshot"`. Same mirror rule:
`.agents/skills/owa-enhance` is a copy.

## owa-upgrade-unit-test skill

`.claude/skills/owa-upgrade-unit-test` owns the UNIT TEST SUITE and the climb
to **99% line coverage**. `/owa-upgrade-unit-test [measure | plan | <path> |
next | fix-flaky | gate | report]`. Where `/owa-robot-test` drives the live
window and its `coverage-expansion/` tracks UI PATHS, this one moves vitest
line coverage over both projects — `vitest.config.ts` (`src/**`,
`tools/**/*.test.mjs`) and `vitest.electron.config.ts`.

**The reported number is not the real number.** `npm run test:coverage` prints
78.28% lines and `test:electron:coverage` 84.29%, both measured over the files
a test happened to LOAD — v8 measures nothing else unless `coverage.include`
is given, and neither committed config gives one. Over the whole surface the
honest figure is **48.17% (25 395 / 52 715 lines across 986 files), 502 files
at exactly 0%, 26 793 lines short of 99%** (measured 2026-09-26 @ `22217577`).
That denominator can only shrink: deleting a test that loads a big untested
file RAISES the reported percentage. So every number the skill states comes
from `scripts/coverage-gap.mjs`, which measures loaded and unloaded files
alike, writes only under the gitignored `test-results/unit-coverage/` (so
`apply` survives a cleared conversation) and carries `--no-run`, `--surface=`,
`--dir=`, `--uncovered=<file>` (the missing line RANGES), `--json` and
`--goal=`.

Three things that run costs if they are not known: full instrumentation is
~2.5× slower (src 124 s against 55 s, electron 33 s against 9 s) and pushes
`src/_screen/components.smoke.test.tsx` past the committed 10 s `testTimeout`,
so the script passes `--testTimeout=60000`; **a failing test means vitest
writes NO coverage report at all**, and the script says so rather than
printing a stale number; and `lint:pre` is red on a Windows checkout for line
endings alone (`core.autocrlf` true, no `endOfLine` in `.prettierrc` — ~1 270
files), so check your own new files and never `npm run format` the tree.
`lint:es` does not lint test files; prettier does.

**The gap has a shape, and it names the cause.** By kind: `module` 70%,
`helper` 57.3%, `component` **10.1%** (415 files — half the remaining gap),
entry files 0%. The two dark folders are `src/presenting-flow` (29 files,
0.4%, 28 at zero) and `src/presenter-foreground` (28 files, 0.2%) — neither is
neglect: the 2026-08-24 prune that deleted `appProvider.mock.ts` took **65 test
files** with it, including that entire presenting-flow suite and both `lang`
km-completeness suites (memory `appprovider-mock-node-env`). Rebuilding them
**without** re-adding a shared provider fake is the main job, because the
deletion was the user's explicit decision — _"remove all mock for app-provider,
I don't need mocking anymore"_ — and no shared mock, `setupFiles` injection or
test-only provider shim may come back, whatever it does for the number.

**Two rules bind every run.** The number comes from the script, never from
`test:coverage`. And **a test must be able to FAIL**: an import-and-render that
asserts nothing lights the same lines and catches nothing, so where a batched
smoke harness is the right tool — it is, for 415 components, on the
`src/_screen/components.smoke.test.tsx` pattern of one mock surface amortised
over a folder — it still asserts something true, and the run reports the
smoke-render share of its gain separately from the behavioural share. Branch
coverage is reported beside lines for the same reason: lines rise with smoke
renders while every `catch` stays unrun. A failing test is never deleted or
`.skip`ped to raise a number, and a `tran()` key that throws during a render is
a BUG FOUND, not a thing to mock around.

Work is planned as `UT-xx` batches in `references/plan.md`, ranked by uncovered
lines per hour rather than by file size; `references/baseline.md` carries the
measured baseline, every exclusion **with its reason** (an exclusion moves the
goalposts, so it is a decision, not a cleanup — the 19 renderer entry files are
left undecided on purpose) and a six-rung ladder whose rung 6 is 99% locked
behind a committed `coverage.thresholds`; `references/recipes.md` carries the
repo's real idioms — the `// @vitest-environment jsdom` first line, `vi.hoisted`
mock bundles, `createRoot` + `act` or `renderToStaticMarkup` (there is no
`@testing-library/react` here), the `vi.mock`-factory-survives-`resetModules`
fork, and a table of this app's recurring defect classes as ready-made test
targets. Same mirror rule: `.agents/skills/owa-upgrade-unit-test` is a copy.
