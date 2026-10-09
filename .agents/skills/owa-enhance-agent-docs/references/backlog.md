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

_No entries yet. The first run files here._
