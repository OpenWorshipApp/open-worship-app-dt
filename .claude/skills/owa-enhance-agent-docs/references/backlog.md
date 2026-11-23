# Agent-docs backlog — `AD-xx`

Findings from `/owa-enhance-agent-docs` runs, under stable ids, so a later run
starts from the truth instead of rediscovering it. Drift fixed in a run is
recorded here as `done` only when it was a decision (an *ask*). Routine drift
fixes live in the run's report and the diff. Leverage proposals are always
filed. A finding owned by another skill is filed there: `EN-xx`
(`owa-enhance`), `EC-xx` (`owa-enhance-chatbot`), `MC-xx` (`owa-enhance-mcp`),
`AC-xx` (`owa-enhance-aichat`), `UT-xx` (`owa-upgrade-unit-test`).

**Nothing is written here until the user decides.** An applied proposal is
filed as `done`, with before → after and the proof. Every other proposal of
that report is filed `open`, and every one on `file`. Filing is an edit under
`.claude/`, so it brings `node extra-work/build-knowledge.mjs` with it.

This file ships in plaintext inside the installer. Write transcript findings as
classes, and never quote a session.

Status: `open` · `doing` · `done` · `wontfix` (with the reason). Lens: L1
blind spots · L2 context cost · L3 prose → machinery · L4 friction · L5
verification reach · L6 skill routing · L7 Codex parity (retired 2026-10-24
with Codex support) · L8 the 🤖's corpus ·
`drift` for a decided drift item.

Entry shape. The status stays the last status word on the heading line,
because `owa-enhance/scripts/triage.mjs` reads it from there:

```markdown
## AD-01 · <the claim, in one line> — `open` · S3 · L2

**Signal.** … **Change.** … **Cost.** … **Proof on apply.** … **Route.** …
Found in run `<runid>`.
```

---

## AD-01 · The scanner reads the typings whole and remembers killed leads — `done` · S3 · L3

**Signal.** 11 of 69 symbol leads were scanner false positives. `lib.dom.d.ts`
(2.3 MB) sat over `MAX_READ_BYTES` (2 MB) and was skipped silently. File names
were cut into code names (`managerHelpers.extra.test.tsx`). Every run
re-confirmed the same ~80 history leads. **Change.** The typings are read
whole, with `lib.es5` and `lib.esnext.disposable` added. A token ending in a
file extension is the paths check's to judge. `references/killed-leads.json`
(check + doc + name + why) sets confirmed leads aside, and an entry whose doc
no longer names it is reported. **Cost.** 0 always-loaded bytes. **Proof on
apply.** `--check=symbols` 69 → 0, gone paths 11 → 0, unknown file names
31 → 0, with 81 leads set aside. A planted stale entry was reported (1), then
removed (0). **Route.** This skill. Found and applied in run `20261008-2315`.

## AD-02 · The Codex mirror is copied by a script and held by the gate — `done` · S2 · L3 · L7

**Signal.** Run `20261008-2315` copied 36 mirror files by a throwaway script.
`rules/project-skills.md` records a mirror that fell several revisions and
seven notes behind. **Change.** `extra-work/sync-agent-mirror.mjs [--check |
--prune]`: exact copies, a SKILL.md keeps its Codex preamble, and a new
skill's preamble is never invented. `src/test-setup/agentDocsMirror.test.ts`
(6 tests) runs `--check` on the tree and on fixtures. CLAUDE.md's mirror
paragraph went from 7 lines to 4, naming the script. **Cost.** Gate +~4 s
(it spawns node 10 times). **Proof on apply.** The script reproduced all 9
mirrored SKILL.md files (0 drift before any edit of theirs). The tree test
FAILED with `.codex/memory/cast-to-tv.md` drifted ("1 out of step"); the sync
restored it byte-identical, and the test passed. **Route.** This skill.
Found and applied in run `20261008-2315`. **Superseded 2026-10-24:** Codex
support was dropped; `AGENTS.md`, `.codex/`, `.agents/skills/`, the script
and the test are deleted.

## AD-03 · Quoting breaks a third of sessions; the cure is in the index — `done` · S3 · L4

**Signal.** `unexpected EOF while looking for matching` quote in 13/40
sessions (14/60 at calibration). The same run lost a backslash through a
heredoc while applying AD-01. **Change.** The always-loaded index line for
`bash-heredoc-halves-backslashes` now carries the cure (write the script to
the scratchpad, run the file), and the note covers the quote half. **Cost.**
+75 always-loaded bytes. **Proof on apply.** The mechanism. Re-run
`session-friction.mjs` after a week against 13/40. **Route.** This skill.
Found and applied in run `20261008-2315`. **Re-measured** in run
`20261011-2249`: 9 of the 29 sessions since 2026-10-09 (31%, against 32%),
once each. The index line has not moved it; a hook for one retry a session
was judged not worth every session's cost.

## AD-04 · `owa_click` loses its target when a press opens or closes a window — `done` 2026-11-20 · S3 · L4

**Signal.** "Inspected target navigated or closed" in 7/40 sessions (×21);
`owa_screenshot` "UnknownVizError" in 4/40. Neither is in the MC or EC
backlog. **Change.** File both as `MC-xx` with the masked signatures. **Cost.**
0. **Proof on apply.** The MC items exist. **Route.** `owa-enhance-mcp`. Found
in run `20261008-2315`. **Re-measured** in run `20261011-2249`: the click
signature in 5/40 (×11), the screenshot one in 3/40 (×4). One more wall for
the same filing: `owa_screenshot` aimed at the chatbot window is refused in 4
of the 29 sessions since 2026-10-09, and the refusal's way out (leave the page
argument unset) pictures a different window, where `select_page` +
`take_screenshot` is what works. **Re-measured** in run `20261028-1700`: the
chatbot-window refusal in 7/40 sessions (its words unchanged), the click
signature in 3/40 (×5); and `take_screenshot` now needs the `pageId` from
`list_pages` too (chrome-devtools-mcp 1.8 `pageIdRouting`), refused for its
lack in 2/40.
**Applied 2026-11-20** as `MC-67` (the click signature 3/40 ×9 that day, all
`owa_click`): a press whose window reloads or closes under it answers
`isWindowGone` with an `unverified` sentence instead of the CDP error, in
`owa_click`, `owa_type`, `owa_press_key` and `owa_menu`; seen live on a scratch
instance (**Apply Settings**). The screenshot signature: 0 in 40 sessions,
1 error in 177 calls; `pageId` optional again since `MC-65`. Nothing left.

## AD-05 · `user-workflows.md` is re-read whole — `done` 2026-11-20 · S3 · L4 · L2

**Signal.** 463 KB / 5 457 lines, read in 10/40 sessions (×14). Its version
line alone is 1 420 characters. **Change.** A `W-xx` → line index at the top,
or a SKILL.md line: `grep -n '^### W-'`, then Read with an offset. **Cost.**
0. **Proof on apply.** The hot-read count at the next friction run. **Route.**
`owa-robot-test`. Found in run `20261008-2315`. **Re-measured** in run
`20261011-2249`: 542 KB, read in 12/40 sessions (×27). The dated head — the
1 410 lines before the first recipe — is 220 659 B, 40% of the file, and
`docs:gen` reads one line of it (`workflowsVersion:`). The sharper change:
move all but the newest entry to a history file beside it. **Re-measured** in
run `20261028-1700`: 740 KB; the dated head 331 KB, 45% of the file.
**Applied 2026-11-20.** The history had already moved to
`user-workflows-history.md` (the head is 28 KB of 556 KB); `owa-robot-test`'s
SKILL.md now says to read one recipe -- `grep -n '^### W-'`, then Read with
`offset` / `limit`, or its page under `docs/manual-sources/`. Proof: the
hot-read count at the next friction run.

## AD-06 · Screen Mirror area gets a scoped rule; its index lines become hooks — `done` · S3 · L1 · L2

**Signal.** `electron/screenMirrorService.ts` read in 8/40 sessions (×36).
`src/screen-mirror` and `src/virtual-display` had no rule. The three longest
index lines (477 + 366 + 276 characters) were summaries, not hooks.
**Change.** `rules/screen-mirror.md` (`paths:` over the area's electron, src
and html files) carries those facts and points to the six notes. The three
index lines are now hooks. CLAUDE.md names the rule. **Cost.** MEMORY.md
18 988 → 18 318 bytes; the rule is 2.6 KB, loaded only on its paths. **Proof on
apply.** `--check=rules` 0/0/0, index lines over 220 characters 11 → 8, both
coverage rows now show `rules: screen-mirror.md`. The other eight long lines
carry 3–4 links each and were left alone. **Route.** This skill. Found and
applied in run `20261008-2315`.

## AD-07 · Skill triggers sit past the listing cut — `done` 2026-11-20 · S3 · L6

**Signal.** Past the ~1 530-character cut: `owa-robot-test` by 2 402
characters, `owa-enhance-chatbot` 1 503, `owa-enhance-mcp` 705, `owa-enhance`
637. `owa-upgrade-unit-test` states "~45%" against its own baseline of 54.91%
(2026-09-29). **Change.** Put trigger phrases before the cut and fix the
number. **Cost.** ~0. **Proof on apply.** `--check=skills`. **Route.**
Each owning skill, on ask. Found in run `20261008-2315`. **Re-measured** in run
`20261028-1700`: past the cut by robot-test 2 627, chatbot 1 505, mcp 687,
enhance 619, aichat 156, unit-test 82 characters.
**Done** in run `20261120` (the user's yes): the six rewritten triggers
first, each under the cut — robot-test 4 166 → 1 349 characters, chatbot
3 035 → 1 390, mcp 2 634 → 1 441, enhance 2 168 → 1 510, aichat 1 686 →
1 347, unit-test 1 634 → 1 279; `--check=skills` past the cut 6 → 0, wiring
0. Nothing re-routed: each keeps its own triggers. What left a description
was already in its body, except `owa-enhance-mcp`'s file map, moved into the
body under the doors table, and robot-test's list of newer matrix areas
(`RD-81..90` …), which the matrix itself holds. The unit-test "~45%" is gone
with the number (the body states the measured baseline).

## AD-08 · The review skills are in neither skill index — `done` 2026-10-11 · S4 · L6

**Signal.** `--check=skills`: `review-stagged-change` and
`review-unstagged-change` were never in CLAUDE.md "Project skills" or
`rules/project-skills.md`. **Change.** A short section in
`rules/project-skills.md` (on demand), not CLAUDE.md (the listing already
shows them), or an audit exemption for generic skills. **Cost.** 0
always-loaded. **Proof on apply.** `--check=skills` 4 → 0. **Route.** This
skill. Found in run `20261008-2315`. **Done** in run `20261011-2330`: a section
each in `rules/project-skills.md` and one line for the pair in CLAUDE.md
(+150 B always-loaded, the user's ask being every document current);
`--check=skills` wiring 4 → 0.

## AD-09 · Four guards the notes say are missing — `done` 2026-11-20 · S3 · L5

**Signal.** The notes name four untested invariants: `applyEnabledState` in
`ScreenPreviewerFooterComp`, the `HandleAlertComp` popup chain,
`presentingFlowRenameMigration.ts`, and the `ModalLayerContext` route.
**Change.** Behavioural tests, with no shared appProvider mock. **Cost.** Gate
time. **Proof on apply.** Each test fails on a broken invariant, and the notes
then name it. **Route.** `owa-upgrade-unit-test`. Found in run `20261008-2315`.
**Applied 2026-11-20.** The rename migration's test was already back
(2026-10-15). New: `ScreenPreviewerFooterComp.test.tsx` "turning off while
Focusing shows…" (the only test a Focusing-only break of `applyEnabledState`
fails), `FloatingWidgetComp.modalLayer.test.tsx` (the real
`useIsInModalLayer`, the widget portaled out of a fake modal) and
`HandleAlertComp.test.tsx` (Alert → Alert, Confirm → Confirm, Input → Input:
`components.coverage.test.tsx` walked the chain through the real host but no
same-type step past Alert). Each fails with its invariant broken and passes
restored. Notes `screen-focus-spotlight`, `modal-layer-above-modal` and the
robot-test knowledge base now name them. Left: a SYNCHRONOUS same-type open
inside a close callback would still lose its popup (untested, unreported).

## AD-10 · The scan never read the manual — `done` 2026-10-11 · S2 · L3

**Signal.** A user asked the 🤖 how to change the Bible text colour and was
told to open an **Appearance** card: W-07 still described a panel that became
a floating one in August. `user-workflows.md` is in `LEDGER_NAME_SET`, so every
check skipped it, and the coverage matrix was outside the audited surface.
**Change.** A `manual` check (recipes, not the dated head; the matrix's
`src:` anchors), §3's manual class, the routing paragraph in `SKILL.md`.
**Cost.** 0 always-loaded; +0.3 s per scan. **Proof.** On the tree before the
doc fix: 6 dead labels (W-07's **Appearance** among them), 43 gone files
(PM-14's), 29 recipes behind their code; after W-07, PM-13 and PM-14 were
rewritten: 2 / 42 / 29, W-07 on none of the lists. **Left open.** The 42
coverage rows whose source file moved, W-14's `[en:tran:Notes]`, and reading
the 29 recipes in order — the next runs' leads. Run `20261011-1900`.

## AD-11 · The coverage rows whose source file was gone — `done` 2026-10-11 · S3 · L3

**Signal.** `--check=manual`: 42 rows of `docs/test-paths/coverage-matrix.md`
cited a file that no longer exists, 17 paths in all. **Change.** 24 rows
re-aimed where the history says the file went (`Presenting-Flow.ts` →
`PresentingFlow.ts`, the previewer files into `items/`, `editingHelpers.tsx`
into `src/editing-manager/`, four colour components renamed `…Comp`), line
numbers dropped; 18 rows whose component was deleted read against today's code
and rewritten, ids kept. **Proof.** The signal at 0, held by the gate
(AD-13). Asked for by the user: _do all 3_.

## AD-12 · Every recipe is read against the code, and the read is recorded — `done` 2026-10-11 · S2 · L3

**Signal.** 29 recipes "behind" and 46 naming controls in plain English, the
same lists run after run: the signal was commits since the recipe's last edit,
which a recipe found correct could never clear, and plain names were converted
only "while fixing a recipe for another reason". The user: _I made
`/owa-enhance-agent-docs` to fix error like this, but after run several time
it still have out-dated documents_. **Change.** `references/manual-reviewed.json`
— per recipe a hash of its words and one of the files its Verify rows cite —
written by `audit-agent-docs.mjs --stamp-manual=<ids>`; the check lists a
recipe as due a read when it has no entry or either hash moved, and plain
names only for those. §3 makes reading EVERY due recipe a safe class, §3b says
a run is done when the audit says so, `scripts/apply-manual-edits.mjs` is the
single writer behind several readers and `scripts/find-label.mjs` answers "is
this a `tran()` key". The first full pass read all 53 recipes. **Cost.** 0
always-loaded; the ledger is ~5 KB. **Proof.** _recipes due a read_ 53 → 0.

## AD-13 · The gate holds the manual's two hard signals — `done` 2026-10-11 · S2 · L3

**Signal.** Nothing failed when a recipe named a control that was deleted.
**Change.** `src/test-setup/manualRecipes.test.ts` runs the `manual` check and
fails on a label no code draws and on a coverage row citing a file that is
gone; a false positive is filed in `killed-leads.json` with `where: "<recipe>"`
so the same word elsewhere is still caught. **Proof.** The test failed on the
tree before the fixes (W-14's `[en:tran:Notes]`, the 42 rows) and passes after.

## AD-14 · The notes get the recipes' ledger, and the READMEs are read too — `done` 2026-10-11 · S2 · L3

**Signal.** `staleness`: 139 notes "whose code moved since they were last
edited", ranked, the top ten read each run — the recipes' fault again (AD-12).
And no check read a document outside `.claude/`: `README.md` documented
`npm run pack:mac:uni` after the script was removed, `RELEASE.md` said a dry
run does the git steps it skips. **Change.** `references/notes-reviewed.json`
and `--stamp-notes` (a hash of the note, of the list of files it names and of
what is in them — a reworded note stays tied to its code, a folder it mentions
is not hashed); every tracked `.md` outside the agent docs, generated pages and
third-party folders is audited as a `project` document. **Proof.** First full
pass, run `20261011-2330`: 152 notes, rules, skill files and READMEs read by
readers that only proposed; the ledger at 0 due afterwards. The same reading
found six places where the CODE had left a recorded decision — five fixed with
tests (`EC-221`, `EN-52`), the rest filed (`EN-50`, `EN-51`).

## AD-15 · A big run ends with a second read, and one real run — `done` 2026-10-11 · S2 · L5

**Signal.** The first full pass applied 559 corrections, each checked by its
own evidence quote, and left 80 statements "for the running app"; the audit
printed 0. Nothing had checked a correction against anything but the line its
own reader chose, and nothing had run what the notes said worked.
**Change.** `SKILL.md` §3c, `references/second-read.md`,
`scripts/second-read.mjs` (`inputs` turns the readers' edit files into work
with no reason attached; `check` refuses an answer that skips an item or
proves it with a line the file does not hold). **Proof.** Run the same day:
nine readers told to refute — 555 of 559 held, 4 were wrong and are fixed;
three readers on the 80 statements — 45 settled from stylesheets, bundled
libraries, data and arithmetic, 18 of them wrong and fixed, 4 more settled on
a scratch instance or from the handler, 31 left in `live-checks.md` with
exactly what to watch (12 of them need a second device, a TV, an account,
PowerPoint, a person or a model). And the read of a guide page's newest copy,
held by 33 unit tests, failed on every real page and would have handed an
older page over as the newest (`EC-222`, `MC-58`).

## AD-16 · A knowledge rebuild no longer relaunches the dev app — `done` 2026-10-11 · S3 · L4 · L3

**Signal.** `build-knowledge.mjs` ran in 23 of 40 sessions (×37). Under
`electron:dev`, nodemon's `--watch electron-build` relaunched the app on every
one, for a bundle `help.mjs` and `tran.mjs` read per call. "The browser was
restarted… page ids have changed" hit 6 of 40 sessions (×8), and run
`20261011-2249` could not rebuild beside another session. **Change.**
`--ignore electron-build/knowledge` on `electron:watch`. The relaunch caveat
left CLAUDE.md, `rules/agent-knowledge.md`, memory
`claude-dir-edits-need-knowledge-rebuild` and this skill's Non-negotiable 4.
**Cost.** 0 on the gate. **Proof.** The repo's own nodemon in a scratch folder
shaped like the repo, given each script's arguments: the old script restarted
its program on a write to `electron-build/knowledge` (1 → 2 launches), the new
one did not (1 → 1) and still did for `electron-build/main.js` and for the MCP
package (→ 2 → 3). **Not seen.** The running `electron:dev` was another
session's and was not restarted, so the same-pid check on the real app is
still owed; that instance keeps the old watch until it is restarted.

## AD-17 · The four dead `debuggerHelpers` mocks are gone, and so is the paragraph — `done` 2026-10-11 · S3 · L2 · L3

**Signal.** CLAUDE.md "Test-suite mock gotcha": 783 B in every session for a
fix nobody had made; four test files still mocked the dead path. **Change.**
The four mocks DELETED, not repointed as the paragraph asked: each of those
suites has `isDev` false or unset, so `useAppEffect` was already plain
`useEffect` there, and a repointed stub would have been one no test could
fail on. The stale `describe` label reads `appHooks`. The paragraph left
CLAUDE.md; `owa-upgrade-unit-test/references/recipes.md` §7 keeps what
lasts (how to stub the hook, and that the mock needs `systemUtils`).
**Proof.** The five suites ran 43 tests before and 43 after; the grep finds 0.
With AD-16's clause and this run's drift fix, CLAUDE.md went 28 129 → 27 440 B.
**Route.** `owa-upgrade-unit-test`.

## AD-18 · A note due only because of an uncommitted file is listed apart — `done` 2026-10-11 · S3 · L3

**Signal.** Run `20261011-2249`: eight notes went due mid-run, all from one
file another session had not committed. §3b could not print 0 while anyone
was mid-work on a file the notes name, and a stamp taken then would not have
outlived that session's next save. **Change.** `audit-agent-docs.mjs` reads
the note's code again with every uncommitted file as the last commit has it;
when that is the hash in the ledger, the lead goes on a line of its own
(*due only because of an uncommitted file*), for notes and for recipes. A
stamp against uncommitted CODE is refused unless `--allow-dirty` says the
changes are the stamper's own; documents a note names do not count, or every
docs run would pass the flag. **Cost.** 0 always-loaded; one `git show` per
uncommitted named file. **Proof.** On the live tree the eight moved to the new
line and *due* read 0; a stamp of one of them exited 2 and left the ledger
byte for byte. With two ledger hashes set wrong, both were listed as DUE —
the one naming the uncommitted file included — and the other seven stayed
apart; the ledger was then restored. **Limit.** The script cannot tell whose
the work is: the line says what to do for each case.

## AD-19 · A comment that miscounted the Add Action menu — `done` 2026-10-11 · S4 · drift

`presentingFlowActionHelpers.ts` said seventeen of the menu's *nineteen*
entries clear something. The menu holds twenty-four (17 clears, Show and Hide,
5 run actions); nineteen is its screen actions. It came in with the rewrite of
"thirteen of the menu's twenty" in the first full pass. Asked, then fixed in
run `20261011-2249`.

## AD-20 · Front matter is parsed as YAML, in the audit and the gate — `done` 2026-10-29 · S2 · L3

**Signal.** Run `20261028-1700` found three front matters a YAML parser
refuses, while the `memory` and `skills` checks printed 0 (their reader is
lenient): this skill's own description, unreadable since 2026-10-24 — every
session's skill listing showed its title, never its triggers; a memory note's
since 2026-08-08 (`description: Screen: Show / …`); and the chatbot skill's,
broken by a reader of that very run and caught only because the listing fell
back to the title. **Change.** `findFrontMatterYamlProblem` in
`audit-agent-docs.mjs` (no dependency — `js-yaml` is only electron-builder's):
the memory and skills checks report it, the rules check has a signal of its
own, and `src/test-setup/agentDocsAudit.test.ts` (AD-21) fails on it.
**Cost.** 0 always-loaded. **Proof.** 0 disagreements with `js-yaml` on the
252 files of that day; all three broken versions caught (`git show HEAD:` and
the reader's text), each with what to write instead.

## AD-21 · The gate holds the audit's hard drift checks — `done` 2026-10-29 · S2 · L3

**Signal.** Only the manual's two signals were in the gate. At the start of
run `20261028-1700` the hard checks printed paths 2, symbols 12, tools 1,
memory 1: a rule had named `stepHelpHelpers.ts`, a file that never existed, for
ten days; CLAUDE.md left out four registered tools; a function renamed on
2026-10-19 was still cited. **Change.** `src/test-setup/agentDocsAudit.test.ts`
runs `paths`, `symbols`, `tools`, `scripts`, `env`, `ids`, `memory`, `rules`
and `skills` once and fails on any lead (the description lengths are advice,
not drift). **Cost.** Gate +~3 s. **Proof.** On its first run it failed on a
`killed-leads.json` entry the run's own fixes had made stale
(`LazyMountVideoComp`) and on the ids `AD-20`…`AD-24` cited before this ledger
held them; passes once both were put right.

## AD-22 · `rules/chatbot-window.md` is split by topic — `done` 2026-10-29 · S3 · L2

**Signal.** 155 683 B (≈ 39k tokens) loaded by ANY read under `src/chatbot/`,
tripled since 2026-10-11 (51 871 B); `ChatbotAppComp.tsx` was read in 7 of the
last 40 sessions (×39), `llmBotHelpers.ts` in 5, `lookupChatHelpers.ts` in 4.
**Change.** Asked for by the user (`apply AD-22`): the window stays in
`chatbot-window.md` (`src/chatbot/**`), with an index, and five parts load by
their own files only — `chatbot-files-report.md`, `chatbot-commands.md`,
`chatbot-bible-import.md`, `chatbot-verse-find.md`, `chatbot-lookup.md`. Every
section moved verbatim; a script checked each appears exactly once.
**Cost.** CLAUDE.md +~150 B (it must name each rule). **Proof.** The core
67 476 B (≈ 17k tokens): a read of `ChatbotAppComp.tsx` pays ~22k tokens less,
a topic helper 8–25 KB more than the core instead of the whole 154 KB;
`--check=rules` 0 (every glob matches, CLAUDE.md names each).

## AD-23 · The staleness check counts markdown links as named files — `done` 2026-10-29 · S3 · L3

**Signal.** `components-path.md` names ~111 files only as markdown links; 35 of
them changed since its stamp and the check listed 3, so a reader left ~13
linked files unchecked row by row until the orchestrator read them.
**Change.** `collectDocReferences` reads a relative markdown link to a code
file as a named file (`resolveLinkTarget`, the same resolution the `paths`
check uses). Applied in the same run, under the user's stated goal
(_documents are 100%_) rather than an `apply`: the rows it missed stood
between the run and that goal. **Cost.** 0. **Proof.** Its first run put 9
documents due that the old check had passed, every one through a link alone.
Read against the code: 6 were wrong — `components-path.md` 18 of the 32 rows
whose linked file had changed (a camera row still said "select camera
device"; the Audios row put `.app-on-screen` on the row, not the tab), the
Connection Graph section of `knowledge-base.md`, a toast constant in
`ui-map.md`, two links in `html-in-canvas/README.md` that resolved only from
the repo root, and two anchors each in `presenting-flow-expansion-follows-position.md`
and the robot-test `SKILL.md`. 3 held. Found in run `20261028-1700`.

## AD-24 · A manual correction brings its translations — `done` 2026-10-29 · S2 · L3

**Signal.** Run `20261028-1700` corrected 46 recipes, and 46 of the 65 pages
in Khmer and in French were left behind — the old words still in them, the
help showing English instead; this skill's paper trail named no translation
step. **Change.** §3 now carries the translated manual (block for block,
`--check` ✓, `questionHelpers.test.ts` green), and the `manual` check has a
`stale-translation` signal (`readTranslationLagList`), out of the gate on
purpose: `manual-i18n-status.mjs` decided a manual edit never waits for a
translation. The run's four translators brought both languages to 65 of 65.
**Proof.** Against the translations as committed, the signal counts 92 (46 per
language); 0 now. One French page had to be given the English's line break
before a bold label so its blocks lined up (the test's own comment records the
same trap: French W-50, 2026-10-18).

## AD-25 · Readers get a check-only door to the edit checker — `done` 2026-11-11 · S3 · L4

**Signal.** In run `20261110-2250` the auto-mode permission check refused
`apply-manual-edits.mjs` to 7 of 22 first readers, with `--apply` or without —
the name says it writes — and each wrote its own copy of the three checks,
which proves nothing about the real ones. **Change.**
`scripts/check-manual-edits.mjs` sets a flag and loads the applier: one set of
checks, two doors, and only the applier writes; the brief and §3 name it.
**Cost.** 0 always-loaded bytes. **Proof.** A valid proposal run through it
with `--apply` printed `0 problem(s)`, exit 0, and the target's hash was the
same before and after. Applied at the user's word (`apply AD-25`).

## AD-26 · A stamp can record a read made against the last commit — `done` 2026-11-11 · S2 · L3

**Signal.** In run `20261110-2250`, 33 notes and 11 recipes read and corrected
stayed "due a read" because other sessions had uncommitted work in what they
name: a stamp is refused there, and the read had nowhere to go. **Change.**
`--stamp-notes` / `--stamp-manual` take `--at-head`: every uncommitted file is
hashed as the last commit has it — the code the reader judged — which is how
the staleness and manual checks read a document listed apart, so it stays
apart until that work lands and is due again once it has. Non-negotiable 7
says when. **Cost.** 0. **Proof.** After the stamps: recipes due a read
11 → 0 (11 listed apart), notes 33 → 0 of those (each listed apart, naming its
file); two commits that landed mid-run were read against each stamped
document before it was stamped again. Applied at the user's word.

## AD-27 · The `tools` check reads tools registered by a constant — `done` 2026-11-11 · S2 · L3

**Signal.** The check counted 40 registered `owa_*` tools of 45: the five
one-document editors are registered as `registerTool(NOTE_EDIT_TOOL_NAME, …)`,
so CLAUDE.md's list could leave four of them out with nothing printed (fixed
by hand the same run). **Change.** `readRegisteredTools` adds the value of a
`const NAME = 'owa_…'` that some `registerTool(NAME` passes, and
`checkMentionsTool` reads `` `owa_foreground` / `_edit` `` as naming
`owa_foreground_edit`. A new test in `agentDocsAudit.test.ts` registers the
real tools on a stand-in server and holds the check's count to that number.
**Cost.** 0. **Proof.** The test fails on the old script (40) and passes now
(45); the new count found the MCP README's table lacking `owa_slide_edit`,
added. Applied at the user's word.

## AD-28 · The staleness check never diffs an empty path list — `done` 2026-11-11 · S3 · L3

**Signal.** `RELEASE.md` was listed against 3 835 changed files: every file it
names is git-ignored and on disk, so its tracked list was empty, and
`git diff <sha> --` with no path lists the whole repository. **Change.** A
stamped document whose named files are all outside what git tracks has no code
to fall behind, and is skipped. **Cost.** 0. **Proof.** With a deliberately
stale stamp, the committed script listed `RELEASE.md` due against 3 845 files;
the fixed one does not list it. Applied at the user's word.

## AD-29 · The `ids` check holds `BN-xx` to its ledger — `done` 2026-11-11 · S3 · L3

**Signal.** 63 distinct `BN-` ids were cited across the docs, outside the
bible-note skill's own references, with nothing checking them against its
90-id ledger. **Change.** `BN` joins `ID_PATTERN` and `ID_OWNER_MAP`
(`owa-enhance-bible-note-chatbot/references/backlog.md`). **Cost.** 0.
**Proof.** The check prints 0 against the real ledger; pointed at the wrong
ledger it flags 139 citations, so every one is now read. Applied under the
user's stated goal (_documents are 100% coverage code base_).

## AD-30 · Picturing the help window is written down — `done` 2026-11-11 (note) · S4 · L4

**Signal.** 4 of 40 sessions since 2026-11-07 aimed `owa_screenshot` at the
help window and were refused (_This window has node integration switched
off_); the refusal says to ask the app window, which pictures the wrong one.
**Change.** A bullet in memory `chatbot-cdp-driver-gotchas`: picture the
help and AI Chat windows with chrome-devtools' `take_screenshot` by the
page's id. The stronger fix -- the refusal itself naming that tool -- is
code in `tools/owa-devtools-mcp/owaTools.mjs`, left to `owa-enhance-mcp`.
**Cost.** 0 always-loaded bytes (an on-demand note). **Proof.** The mechanism
only: a friction signature cannot be re-measured in one session.

## AD-31 · One recipe id, one recipe — `done` 2026-11-14 · S2 · L3

**Signal.** Two `### W-62 —` headings: the song from a PowerPoint
(2026-11-11c) and connecting an AI agent (2026-11-13e). `owa_help_page W-62`
read one page for both, the MCP known questions rode the song's id, the
review ledger held one key twice and could stamp neither, and each language's
MCP page was judged against the song's English: 4 audit leads no read could
clear. **Change.** The later recipe is W-64 (heading, the two
`questions/settings.json` rows, the fr and km pages renamed with their id,
five notes and READMEs, a dated-head pointer; the history kept as written,
an exception to the file's "never renumber" that the user approved), and the
id is guarded twice: `docs:gen` throws on a repeated id, and
`manualRecipes.test.ts` holds every `### W-` id once. **Cost.** 0
always-loaded bytes. **Proof.** The test failed on the doubled heading
(`expected [ 'W-62' ] to deeply equal []`) and passes now; `docs:gen` refused
it by name; `readHelpPage` returns each page by its own id; the `manual`
check's 4 W-62 leads went to 0 and both languages read 75 of 75 current.

## AD-32 · The memory index a session loads is measured — `done` 2026-11-14 · S3 · L2

**Signal.** The surface table and `--check=budget` billed
`.claude/memory/MEMORY.md` (115 lines, ≈ 4 763 tokens) to every session, but
Claude Code loads its per-user index (`~/.claude/projects/<repo>/memory/`),
which held one line on the machine measured; the repo's index was in no
session's context there, so its 261 notes were reached only by a
`memory <name>` mention, a rule or a link. **Change.** The budget check reads
and reports the per-user index beside the repo's, and says when the repo's is
loaded; the surface table and Non-negotiable 6 say the same; one reference
note in that machine's per-user memory points at the repo's notes. **Cost.**
1 line (≈ 30 tokens) in that machine's per-user index; 0 in the repo.
**Proof.** `--check=budget` now prints `192 B ≈ 48 tokens, 1 lines` for the
index a session loads, where it printed 4 763 tokens for one it does not.

## AD-33 · The dated heads are archived past their newest twenty — `done` 2026-11-14 · S3 · L2

**Signal.** `user-workflows.md` was 981 KB, 470 KB of it 400 dated entries
above the first recipe, and was read whole in 3 of 27 sessions; the matrix
head was 447 KB of 3.6 MB. **Change.** All but the newest 20 entries of each
moved unchanged, in order, to `user-workflows-history.md` and
`docs/test-paths/coverage-matrix-history.md`, with a pointer and the rule
(when the head passes about twenty, the oldest move to the top of the
history). The audit lists both as ledgers, and its `ids` check reads a
ledger's `-history.md` with it -- and reads the matrix at all: at 3.2 MB it
was past `MAX_READ_BYTES` (2 MB), so every matrix-owned id had been skipped
as unreadable. **Cost.** 0 always-loaded bytes. **Proof.** 981 411 → 531 658 B
and 3 648 162 → 3 218 535 B; `docs:gen` output byte-identical (pages,
manifest, sidebar); the `ids` check, now reading the whole matrix and its
history, finds no citation it lacks. **Again on 2026-11-19**, at 41 and 48
entries: 21 and 28 moved the same way, every entry of each file and its
history still there in order and byte for byte, `docs:gen` byte-identical.

## AD-34 · zsh's flag glob is refused before it runs — `done` 2026-11-14 · S4 · L4

**Signal.** `(eval):N: no matches found: --include=*.ts` in 3 of 27
sessions (×4), and twice in the run that filed this: zsh aborts the line on
an unquoted glob in a `--flag=value` word that matches no file, bash passes
it through. **Change.** `scripts/zsh-glob-guard.mjs hook`, a PreToolUse guard
for Bash under zsh: it refuses exactly that shape (quotes, backslashes,
comments and here-documents followed) and names the quoted form.
`src/test-setup/zshGlobGuard.test.ts` holds both outcomes. Wired as a
`PreToolUse` `Bash` hook in `.claude/settings.json` with the user's own yes
(it runs in everyone's sessions). **Cost.** 0 always-loaded bytes; ≈ 29 ms
per Bash call. **Proof.** 4 tests; `zsh -c` shows the unquoted line dying with
`no matches found` before grep runs; live, the hook refused
`grep --include=*.zzz` with the quoted form and let `--include='*.zzz'` run.

## AD-35 · zsh's flag glob is escaped, not refused — `done` 2026-11-19 · S4 · L4

**Signal.** AD-34's refusal, the cost moved rather than gone: its message in
14, 8 and 4 of the last 40 sessions (three signatures), each a round trip
and the command sent again. **Change.** `scripts/zsh-glob-guard.mjs hook`
answers `hookSpecificOutput.updatedInput` -- the whole input, the command
with a backslash before each unquoted `*`, `?`, `[` of a `--flag=value` word
(a brace list, a `$VAR` or a `~` in the word keeps its meaning, which quotes
around it would not) -- and NO `permissionDecision`. The hooks page:
permission rules are evaluated against the input the hook returns, and with
no decision auto mode can still deny the call; `"allow"` would skip the
person's prompts for every rewritten command and is never added. A rewrite
that would not come out clean is refused as before. Same hook entry in
`.claude/settings.json`, behaviour changed with the user's own yes.
**Cost.** 0 always-loaded bytes. **Proof.** `zshGlobGuard.test.ts` 6 tests,
4 failing on the AD-34 guard (the rewrite, no decision, the brace list, a
here-document); `zsh -c` expands `--include=\*.{ts,tsx}` to `--include=*.ts`
`--include=*.tsx` and dies on the bare form; live, an unquoted
`grep -rln --include=*.mjs …` ran and found its file in this session.

## AD-36 · "no infinite paint animation at rest" held app-wide — `done` 2026-11-19 · S3 · L3

**Signal.** An always-loaded CLAUDE.md rule paid for by three traces (EN-09,
EN-10, EN-19) and held only for the boot spinner (`bootLoading.test.ts`).
**Change.** `src/test-setup/infinitePaintAnimation.test.ts` reads every
`src/**/*.{css,scss}` and `html/*.html`, resolves each `infinite` use to its
`@keyframes` (a shorthand's own names, commas inside `calc()` / `var()`
followed; an `animation-iteration-count: infinite` through the names its file
sets) and fails on any property but `opacity`, `transform`, `rotate`,
`scale`, `translate`, or on a name it cannot resolve. The exemption map is
empty: all 13 uses move `transform` or `opacity`. The CSS TypeScript writes
for a screen's content is left to its own checks (`cssCodeCheckHelpers`, the
effects' keyframes test). **Cost.** 0 always-loaded bytes. **Proof.** 5 tests,
four on planted stylesheets; a `border-color` keyframes planted in
`AiChatAppComp.scss` failed the tree test, the file restored byte for byte.

## AD-37 · `src/background` gets a scoped rule — `done` 2026-11-19 · S3 · L1

**Signal.** `--check=coverage`: 91 files, 25 commits (8 fixes) in 60 days,
named in 6 docs, no rule; the hidden animation-capture window
(`electron/animationCaptureHelpers.ts`) in no note. **Change.**
`.claude/rules/background.md` (`paths:` the folder, the screen's background
components and shader runtime, the foreground's Fill / Animation Show, the
capture window, `agentAnimation*.mjs`): the tabs, the one-string `src` and
its compare, what is built and what is read (a person's own CSS and GLSL
through their checks), the legacy `color` names, live only where presented,
infinite on the compositor, the capture window as a stranger's page, the
export, a show's row, the per-instance debounce, the assistant's tool; the
full story stays in memory `background-animation-runtime`. Named in
CLAUDE.md's Printing, Screen Mirror section. **Cost.** CLAUDE.md +94 B; the
rule ~5 KB, loaded only beside those files. **Proof.** `rules` 0 (globs all
match, CLAUDE.md names it); `src/background` reads `rules: background.md`.

## AD-38 · CLAUDE.md stops enumerating the `owa_*` tools — `done` 2026-11-19 · S3 · L2

**Signal.** 1 463 B of CLAUDE.md, in every session, listing tools the MCP
listing already hands each session, and held complete by the `tools` check,
so every new tool grew it. **Change.** CLAUDE.md names the chrome-devtools
tools, says the `owa_*` ones are described in `rules/agent-tools.md` and
tabled in the README, and keeps the warnings: the developer-only tools, and
the two stdio-only ones with `owa_choose_app`'s ask-the-user. The `tools`
check holds those two listings complete, no longer CLAUDE.md
(`audit-agent-docs.mjs`'s `listingDocList`). **Cost.** CLAUDE.md
34 358 → 33 525 B (−833 B, ≈ −210 tokens a session); with AD-37's line,
33 619 B. **Proof.** `tools` 0 with 48 tools registered; the byte counts.

## AD-39 · The stdio door's two page-tool walls come down — `done` 2026-11-19 · S3 · L4

**Signal.** Transcripts, 40 sessions: a page tool refused for a missing
`pageId` (chrome-devtools-mcp 1.12 made it required), 9 calls in 3 sessions;
a `filePath` in the session's scratch folder refused by the roots check, 9
calls in 7 -- mostly ordinary code sessions verifying live, which never load
`rules/agent-access.md` where the roots rule lives. **Change.**
`makePageIdOptional` (`server.mjs`) makes `pageId` optional again on every
page tool: left out, the page `select_page` chose. `explainRootsRefusal`
(`firewall.mjs`) adds `ROOTS_REFUSAL_HINT` to a roots refusal: where the
server may write (the client's working directory, e.g. `test-results/`, or
the OS temp folder). `owa-robot-test`'s step 2 and `rules/agent-access.md`
say both; `MC-65`. **Cost.** 0 always-loaded bytes. **Proof.**
`chromeDevtoolsContract.test.mjs` and `firewall.test.mjs`; live on a fresh
stdio server, read-only: `take_snapshot {}` answered the selected page's
snapshot (830 lines), a scratch-folder `filePath` was refused with the hint.

## AD-40 · `owa_inspect`: a read by selector instead of raw CDP — `done` 2026-11-19 · S3 · L5

**Signal.** 10 of 40 sessions went to raw CDP `Runtime.evaluate` for what a
snapshot does not say (a count, a box, a class, a computed style), ~27
calls, 3 stopped by the permission classifier. **Change.** `owa_inspect
{selector, page?, styles?, limit?}` (`inspect.mjs`): how many elements a
selector names, open shadow roots included, and for the first few tag,
class, box, shown / hidden / gone, words, role, aria states,
`data-widget-name`, the dev stamps and the computed styles named. It runs no
expression of the caller's, reads no field's value, and is withheld from the
model (`modelTools.mjs`). Proposed for the stdio door alone; registered on
both, because a tool added for one caller ships to the other unless it needs
the disk (`owa-enhance-mcp`'s first rule). The two skills' raw-CDP wording
stays as it is (the user, 2026-11-19). `MC-66`. **Cost.** 0 always-loaded
bytes; the model's bill unchanged (≈ 8 464 of 8 480 tokens a round), stdio
lists 78 tools. **Proof.** `inspect.test.mjs` (7, jsdom: no value read, a
selector carried as data, a bad selector answered in words) and the
`owaTools.coverage.test.mjs` case; live, read-only, on the packaged app: 13
`[data-widget-name]` panes with their boxes, inputs listed with no value, a
style named `color;x` refused by the schema.

## AD-41 · CLAUDE.md's file-drop paragraph becomes a pointer — `done` 2026-11-19 · S3 · L2

**Signal.** 1 246 B in every session prescribing fiber walking and a
fabricated `dataTransfer` -- in-page evaluation the firewall refuses --
written before `owa_drop_files` (2026-10-24) made a real drop drivable.
**Change.** Four lines: `owa_drop_files` first, why a page-built
`DragEvent` cannot carry a file, and memory
`drag-payload-written-in-dragstart`, which now holds the by-hand recipe.
**Cost.** CLAUDE.md 33 619 → 32 626 B (−993 B, ≈ −250 tokens a session).
**Proof.** The byte counts; `paths`, `symbols` and `memory` 0.

## AD-42 · A note is counted from its read, never from its last edit — `done` 2026-11-19 · S3 · L3

**Signal.** Memory `background-animation-runtime` kept a "never" a commit
broke, through two later edits of the note: a note the hashes cannot clear
(never read, or edited since its read to name other files) was counted from
its last EDIT, and an edit about anything at all cleared it. **Change.**
`scripts/noteStaleness.mjs`: with a ledger entry, commits are counted from
the stamp's commit (`review.at`); with none, from the last edit as before. A
row says which (`N commits since its check on <date>`), and `--json` gives
its whole file list (`changed`) and the stamp (`since`) for readers.
**Cost.** 0. **Proof.** `src/test-setup/agentDocsStaleness.test.ts` (a
planted ledger; the old rule's miss held as its own case); notes due
2 → 12 at `3c706a186`, all twelve read in the same run.

## AD-43 · A home path naming an account fails the gate — `done` 2026-11-20 · S3 · L3

**Signal.** Two notes in the knowledge every installer ships carried a home
path with an account name: `office-converter-fixes-go-upstream` from
`16bf45295` (2026-11-20) and `dont-taskkill-all-electron` from `a0c3ef929`
(2026-08-30, 82 days). The rule lived only in memory
`no-user-specific-references-in-notes`. **Change.**
`scripts/homePathPrivacy.mjs` (+ `.d.mts`) finds `/Users/<name>/`,
`/home/<name>/`, `C:\Users\<name>\` (any slashes) and `/c/Users/<name>/`
with a real account, a placeholder (`<you>`, `$USER`, `~`, `…`, `x`) skipped;
the audit's new `privacy` check runs it over every markdown file in the
listing and everything under `.claude/`, ledgers included, and
`agentDocsAudit.test.ts` holds it as a hard check. Both notes rewritten to a
sibling checkout (`../open-lyric`, `…/pptx-in-html-out`). **Cost.** 0
always-loaded bytes; the check reads ~680 files in ~0.15 s. **Proof.**
`agentDocsPrivacy.test.ts` (9: six shapes found, placeholders, a word ending
in `users`, CRLF); with HEAD's two notes put back, `agentDocsAudit.test.ts`
fails on exactly those two lines; a planted `.claude/` and `docs/` probe
gave 3 hits, its placeholder none.

## AD-44 · The PPTX converter note describes the uncommitted tree — `done` 2026-11-20 · S3 · drift

**Signal.** Memory `pptx-converter-file-dependency` (from `16bf45295`) says
the repo's `.npmrc` sets `install-links=true` and `pptx-to-html-conv` is
`file:../pptx-to-html-conv-dist`. At HEAD `.npmrc` is untracked and
`package.json` / the lockfile pin 1.1.0 from npm (published up to 1.1.0 on
2026-11-20), while HEAD's `electron/msHelpers.ts` already passes 1.2.0's
`defaultFontFamily`: a clean checkout gets a converter without the face, or a
typecheck error. **Change.** None in the docs: it settles when 1.2.0 is
published or the two files are committed (a committed `file:../…-dist`
breaks `npm install` wherever that sibling folder is missing). Read again
then and stamp. **Route.** The user.
**Settled 2026-11-20.** `7ee8297c2` committed `.npmrc` and the `file:` range
(npm still stops at 1.1.0); the note read against it holds and is stamped.
The same commit made memory `npm-12-install-gotchas`' "every one is an npm
registry range now" untrue: corrected. Neither note was listed due, since
`package.json` is a hot file and `.npmrc` no path root. Asked the same day
whether to change the committed `file:` range, which fails `npm install` on a
checkout without the sibling folder: the user said leave it. Both blind spots
became `AD-45`.

## AD-45 · Notes no commit could ever list due — `done` 2026-11-20 · S2 · drift

**Signal.** AD-44's two notes were wrong for a day and never listed: a note is
due when a commit touches a file it names, and the staleness check followed
only paths under a root folder (`src/`, `.claude/`, …) and code basenames --
never a root file (`.npmrc`, `.mcp.json`), never `package.json` (a hot file,
dropped), so a note about an install, a script or a dependency range had no
file at all. And 51 documents -- 38 memory notes, skill references, project
`*.md` -- had NEVER been read: naming nothing followable, no commit could ever
list them. **Change.** (1) A tracked root file whose name no other folder's
file carries is a path (`.npmrc` is not: a language package has its own).
(2) A note naming `npm run <script>`, `"<dep>": …`, or a key beside
`package.json`, follows `package.json#<key>`: that key's own lines, so a
version bump elsewhere moves nothing (`noteStaleness.mjs`
`listPackageKeysNamed`, `readPackageKeyLines`, `readPackageKeyLog` over one
`git log -p` of `package.json`). (3) A note stamped before it followed more
is not due for that alone: due only when the newly followed files differ
from the stamp's commit. (4) A third list, notes never read that name no
file to follow. (5) A stamp at a commit gone from the history says so
instead of an empty diff (README, two stamps of 2026-10-29). **Cost.** 0
always-loaded; the scan +~0.3 s. **Proof.** The ledger as it was before the
fixes: the old script listed neither note (4 due), the new one both (12 due,
51 never read); `agentDocsStaleness.test.ts` 9/9, two of its four new tests
failing with the key filter and the `package.json` guard broken. The 10 due
read and fixed (README's per-language `index.ts`, gone since 2026-11-06, and
its `--allow-git=all`; the PPTX face read from `en/fonts.json`;
`owa_goto_page`'s Screen Mirror; the popup chain's coverage), and the 51 read
by three readers (16 edits through `apply-manual-edits.mjs`, one date
corrected first; 2 regressions routed), all stamped.

