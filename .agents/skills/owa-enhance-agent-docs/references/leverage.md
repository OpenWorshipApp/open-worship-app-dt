# Leverage — where an agent could help more, or waste less

Job 2 of the skill. The drift checks ask *is this note true?* The lenses here
ask something else: *does what an agent is told, and the tooling it has, make it
good at this repo?* Each lens says what to measure, what a proposal looks like,
how to prove it on apply, and where it routes. Measured examples come from the
calibration run of 2026-10-08 (HEAD `8a3a1e3f`, 60 sessions back to
2026-09-30). Treat them as a baseline, not as findings: a run re-measures before
proposing.

**The preference order for any proposal: test > script > lint > hook > note.**
A test or script runs in the gate and holds for every agent and every human. A
hook holds only for Claude Code sessions, and needs the user's yes, because a
hook in the tracked project `settings.json` runs for everyone. A note holds only
for a reader who loads it and remembers it.

## L1 · Blind spots: busy code no note covers

- **Signal.** `audit-agent-docs.mjs --check=coverage`, the areas with the most
  churn and fix commits and the fewest notes. Calibration: `src/bible-lookup`
  (32 commits, 8 fixes, named in 3 docs, no rule), `src/bible-find`,
  `src/location-name-lookup`, `src/lang` (70 commits, 16 fixes, no rule),
  `src/bible-cross-refs` and `src/virtual-list` (named nowhere).
- **Research.** Read the area's fix commits (`git log --format='%h %s' -- <area>
  | grep -i fix`). Each fix is a trap someone fell into. When the same kind of
  trap appears twice, a note or rule would have prevented the second.
- **Proposal.** A `paths:`-scoped rule for the area, which loads only when its
  files are read, so it costs nothing elsewhere. Or one memory note per
  non-obvious trap. Write the *why* and the trap, never a tour of the files.
- **Proof.** The area's coverage row moves, and the rule's glob matches its
  files (`--check=rules`).

## L2 · Context cost: what every session pays for

- **Signal.** `--check=budget` and `--check=skills`. Calibration: CLAUDE.md
  27.3 KB (≈ 6.8k tokens) and MEMORY.md 19 KB (≈ 4.7k tokens), loaded into
  every session. The largest CLAUDE.md sections are *Agent access* (4.7 KB),
  *owa-devtools / CDP driving notes* (4.2 KB) and *Verifying code changes*
  (4.0 KB). Eleven index lines run past 220 characters (one is 477).
  Skill descriptions run to 3 932 characters, against a listing that cuts
  them at ~1 530.
- **Research.** For each big always-loaded section, ask who needs it. A section
  that matters only when touching `tools/owa-devtools-mcp` or driving the app
  belongs in a `paths:`-scoped rule. CLAUDE.md keeps a one-line pointer and
  whatever holds everywhere. CLAUDE.md already does this for *Agent access*:
  extend the pattern rather than invent one.
- **Proposal.** *Move section S (N bytes) to `rules/<x>.md` with `paths: [...]`,
  and leave a pointer of M bytes.* Give the bytes saved per session. For a
  skill description: put the trigger phrases first and cut repetition, while
  keeping the Codex mirror's preserved full description in step.
- **Proof.** Bytes before → after (`--check=budget`), and the moved text loads
  when its paths are read.
- **Ask always.** Moving text out of always-loaded context is a judgement
  about who needs it.

## L3 · Prose → machinery: rules held only by a reader's memory

- **Signal.** `--check=prose-rules` lists the *must / never / always / same
  change* paragraphs in CLAUDE.md and the rules that name no test, script,
  gate or hook (48 at calibration).
- **Research.** For each, ask whether a machine can tell when the rule is
  broken. If it can, it is a candidate. Some already have precedents:
  - Every `*Comp` name → an eslint rule or a test over the component files.
  - Mirror copied in the same change → a `--check` script the gate runs, or a
    test like `lintGateScripts.test.ts` that fails on drift (a sync script
    with a check mode removes a manual step from every `.claude/` edit).
  - Knowledge rebuilt after `.claude/` edits → a test comparing
    `index.json`'s inputs, or a hook (ask).
  - `tran()` keys with km and fr → already `tranKeyCoverage.test.ts`. This is
    the pattern to copy.
  - Quoted `**` globs → already `lintGateScripts.test.ts`.
- **Proposal.** The enforcing artifact, where it runs (the gate, a hook, the
  script), and what it costs per run.
- **Proof.** It fails on a deliberately broken input and passes on the tree.
  Then the prose shortens to one line that names the enforcer.
- **Route.** Tests → `owa-upgrade-unit-test` idioms; gate scripts → `npm run
  lint` stages (`EN-16` keeps the gate check-only).

## L4 · Friction: walls sessions keep walking into

- **Signal.** `session-friction.mjs`, which reads the local Claude Code
  transcripts for this repo. Calibration (60 sessions):
  - Bash `unexpected EOF while looking for matching` in **14/60** sessions:
    quoting in inline `node -e` / heredocs. Memory
    `bash-heredoc-halves-backslashes` covers one half. The cure is a habit,
    *write the script to the scratchpad and run the file*, stated where every
    session sees it.
  - `owa_click` → *Inspected target navigated or closed* in **12/60** sessions
    (×38): a click that opens or closes a window loses its target. This is a
    tool robustness lead → `owa-enhance-mcp`.
  - chrome-devtools `click`: *did not become interactive* / *uid not found* /
    *no longer exists* in 4–8 sessions each: stale snapshot uids.
  - `owa_screenshot` → an unknown-viz error in 6 sessions.
  - `python` run in 25/60 sessions, with Tracebacks and *Python was not found*
    on this machine. If it is not reliably present, a note saying *use node*
    saves the round trip.
  - The files read in the most sessions: `owa-robot-test/references/
    knowledge-base.md` (127 KB, 12 sessions) and `user-workflows.md` (463 KB,
    12 sessions). A big file re-read whole is a candidate for an index at its
    top, or for splitting.
- **Research.** Group each signature by cause, not by text. Check
  whether a note already covers it. If one does and sessions still hit it, the
  note is in the wrong place or too long to be read: an L2/L6 problem, not a
  missing note.
- **Proposal.** In order: fix the tool (route), add a script that does the
  fragile thing correctly, or put a one-line note where the session will read
  it at the moment it matters (a rule scoped to the files involved, not
  CLAUDE.md).
- **Proof.** The mechanism. A tool that survives the navigation, verified live.
  A script whose output replaces the fragile command. Re-run the miner after a
  week of sessions to confirm the signature is falling.
- **Privacy.** Report signatures as classes. Never paste a prompt, an answer or
  an output into a note, because the notes ship.

## L5 · Verification reach: what an agent cannot check yet

- **Signal.** Read the docs for *cannot*, *can't*, *not possible*, *ask the
  user*, *needs the user*, *genuine OS focus*, *synthetic … can't*. Examples
  in CLAUDE.md today: Monaco model edits need real foreground focus, and
  synthetic drops cannot exercise `readDroppedFiles`.
- **Research.** For each limit, ask what would let an agent verify the
  behaviour: a test seam, a dev-only hook, an MCP tool (behind the firewall's
  rules), or a unit test of the logic beneath the UI.
- **Proposal.** The seam or tool, its safety story (every renderer has
  `nodeIntegration: true`, so nothing that evaluates strings), and who owns it.
- **Route.** MCP tools → `owa-enhance-mcp`, and never weaken the firewall to
  make this easier. Test seams → `owa-upgrade-unit-test`.

## L6 · Skill routing: every request reaches one skill

- **Signal.** `--check=skills` (descriptions, indexes, mirrors) and the
  listing as a session sees it.
- **Research.**
  - For each kind of request this repo gets (QA, a docs fix, a perf issue, a
    chatbot answer, an MCP tool, a test gap, a review), which skill fires? Two
    skills claiming the same request make routing a coin toss. A request no
    skill claims gets the default behaviour.
  - Do trigger words sit before the ~1 530-character cut? `owa-robot-test`'s
    description is 3 932 characters, and everything after *"Full-coverage
    runs are"* is never seen when a skill is picked.
  - Does each skill's `argument-hint` match the arguments its body handles?
  - Is every skill in CLAUDE.md "Project skills" and `rules/project-skills.md`?
- **Proposal.** A reordered or shortened description, a routing line in the
  overlapping skill ("X goes to Y"), or an index entry.
- **Ask always** for another skill's description: it changes when that skill
  fires.

## L7 · Codex parity: the same project in the other agent

- **Signal.** `--check=mirror`, `--check=skills` (mirror body), and
  `AGENTS.md`'s size. Codex does not auto-load `paths:` rules. `AGENTS.md`
  tells it to read them, so a rule whose `paths:` is wrong fails silently for
  Codex as well.
- **Research.** Is the mirror copied by hand on every change? Then a
  sync-and-check script (L3) pays for itself the first time a mirror is
  missed. Does `.codex/config.toml` register what `.mcp.json` registers? Does
  `AGENTS.md` stay small enough to load untruncated?
- **Proposal.** A script, a test, or a one-line `AGENTS.md` change.

## L8 · The 🤖's corpus: can the in-app assistant find it?

- **Signal.** `extra-work/build-knowledge.mjs` indexes each internal note to
  its first 3 000 characters of body and 1 500 of headings. A fact deeper in
  than that cannot be found by `owa_help_search`.
- **Research.** For a note that answers a question a volunteer or the
  assistant would ask, put that question to `owa_help_search` (read-only) and
  see whether the note comes up. Look for key facts sitting after long
  preambles.
- **Proposal.** Move the key fact up, or give the note a clearer title and
  description. Answer quality itself goes to `owa-enhance-chatbot`.
- **Proof.** The search hit before → after.

## Writing a proposal

```markdown
## AD-07 · <the change, in one line> — `open` · S3 · L2

**Signal.** <the number, how it was taken> **Change.** <exactly what, where>
**Cost.** <bytes added to always-loaded context; time added to the gate>
**Proof on apply.** <the measure that must move> **Route.** <this skill | owner>
Found in run `<runid>`.
```
