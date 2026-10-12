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
`.claude/`, so it brings the Codex mirror copy and
`node extra-work/build-knowledge.mjs` with it.

This file ships in plaintext inside the installer. Write transcript findings as
classes, and never quote a session.

Status: `open` · `doing` · `done` · `wontfix` (with the reason). Lens: L1
blind spots · L2 context cost · L3 prose → machinery · L4 friction · L5
verification reach · L6 skill routing · L7 Codex parity · L8 the 🤖's corpus ·
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
Found and applied in run `20261008-2315`.

## AD-03 · Quoting breaks a third of sessions; the cure is in the index — `done` · S3 · L4

**Signal.** `unexpected EOF while looking for matching` quote in 13/40
sessions (14/60 at calibration). The same run lost a backslash through a
heredoc while applying AD-01. **Change.** The always-loaded index line for
`bash-heredoc-halves-backslashes` now carries the cure (write the script to
the scratchpad, run the file), and the note covers the quote half. **Cost.**
+75 always-loaded bytes. **Proof on apply.** The mechanism. Re-run
`session-friction.mjs` after a week against 13/40. **Route.** This skill.
Found and applied in run `20261008-2315`.

## AD-04 · `owa_click` loses its target when a press opens or closes a window — `open` · S3 · L4

**Signal.** "Inspected target navigated or closed" in 7/40 sessions (×21);
`owa_screenshot` "UnknownVizError" in 4/40. Neither is in the MC or EC
backlog. **Change.** File both as `MC-xx` with the masked signatures. **Cost.**
0. **Proof on apply.** The MC items exist. **Route.** `owa-enhance-mcp`. Found
in run `20261008-2315`.

## AD-05 · `user-workflows.md` is re-read whole — `open` · S3 · L4 · L2

**Signal.** 463 KB / 5 457 lines, read in 10/40 sessions (×14). Its version
line alone is 1 420 characters. **Change.** A `W-xx` → line index at the top,
or a SKILL.md line: `grep -n '^### W-'`, then Read with an offset. **Cost.**
0. **Proof on apply.** The hot-read count at the next friction run. **Route.**
`owa-robot-test`. Found in run `20261008-2315`.

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

## AD-07 · Skill triggers sit past the listing cut — `open` · S3 · L6

**Signal.** Past the ~1 530-character cut: `owa-robot-test` by 2 402
characters, `owa-enhance-chatbot` 1 503, `owa-enhance-mcp` 705, `owa-enhance`
637. `owa-upgrade-unit-test` states "~45%" against its own baseline of 54.91%
(2026-09-29). **Change.** Put trigger phrases before the cut, fix the number,
and keep each Codex preserved description in step (`sync-agent-mirror.mjs`
does this now). **Cost.** ~0. **Proof on apply.** `--check=skills`. **Route.**
Each owning skill, on ask. Found in run `20261008-2315`.

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

## AD-09 · Four guards the notes say are missing — `open` · S3 · L5

**Signal.** The notes name four untested invariants: `applyEnabledState` in
`ScreenPreviewerFooterComp`, the `HandleAlertComp` popup chain,
`presentingFlowRenameMigration.ts`, and the `ModalLayerContext` route.
**Change.** Behavioural tests, with no shared appProvider mock. **Cost.** Gate
time. **Proof on apply.** Each test fails on a broken invariant, and the notes
then name it. **Route.** `owa-upgrade-unit-test`. Found in run `20261008-2315`.

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
