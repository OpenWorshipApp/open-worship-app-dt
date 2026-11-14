---
name: owa-gi
description: "Git interval for THIS session: every N minutes commit the session's own changed files that pass the scoped lint gate (/owa-lt), pull, and push -- a detached process, no model turn per tick, never holding the session open or waking it. `/owa-gi 10` starts it every 10 minutes; it stops after one last tick when the session will change nothing more (`/owa-gi finish`, run by the session at its final hand-off) or when the session ends. `/owa-gi stop` ends it at once, `/owa-gi status` shows the last ticks, `/owa-gi now` runs one tick. Pushes, so only when the user invokes it."
argument-hint: '<minutes> | finish | stop | status | now'
disable-model-invocation: true
---

# Git interval (`/owa-gi`)

Script: `node .claude/skills/owa-gi/scripts/git-interval.mjs`. Its header
says exactly what a tick does; in short:

1. **Commit** the files on this session's touched list (the `/owa-lt` hook's
   list) that git sees changed -- never another session's files in the same
   worktree -- and only when the scoped lint gate passes on them, all or
   nothing. `git commit --only -- <files>`, so another session's staged
   files stay out; hooks run, never `--no-verify`.
2. **Pull**: fetch, fast-forward; a diverged branch merges, and a merge that
   conflicts or would overwrite a dirty file is aborted. Nothing is stashed.
3. **Push** to the upstream, never forced.

It refuses `main` / `master`, a detached HEAD and a merge or rebase in
progress, and a lock keeps two sessions' ticks from running git at once.

**It never holds the session** (2026-11-13, the user: _when nothing will be
changed by the session then stop the interval_; _make sure the interval [is]
not preventing the session to stop [or] pause the session too long_). The
loop is a detached process, not a Bash background task: every command below
returns in well under a second, nothing waits on the loop, keeps the session
open at its end or wakes it when the loop exits, and the last tick runs in
the loop, not in the session. It follows the session's Claude Code process
(`CLAUDE_PID`) and will not start without one, so it never outlives the
session. Three intervals had ticked "nothing of this session changed" all
night before this.

## `/owa-gi <minutes>` -- start

1. `git-interval.mjs --status`. Already running at the same period: say so
   and stop here. At another period: `--stop` it first.
2. Start it with a plain Bash call -- NOT `run_in_background`; it detaches
   itself and returns at once:

   ```sh
   node .claude/skills/owa-gi/scripts/git-interval.mjs --every=<minutes> --trailer="<name> <<email>>"
   ```

   `--trailer` is the name and email of the `Co-Authored-By:` line the
   session's commit attribution asks for (the system reminder); leave it out
   when none is asked. Never add `--allow-main` unless the user asked for
   that in so many words.

3. Tell the user in two lines what it printed: the branch, the period, how
   many of this session's files the first tick (running now, in the
   background) has to commit; and that it stops after a last tick when the
   session is done, or at `/owa-gi stop`. Do not wait for the first tick.

## While it runs

- Keep working as before. A tick may commit your files mid-task when they
  pass the scoped gate: that is the point (work in progress, saved and
  pushed). Your own commits with real messages are still welcome; the
  interval commits only what is left.
- A file changed through Bash is not on the list until
  `node .claude/skills/owa-lt/scripts/touched-files.mjs add <file>...`, and
  the interval never commits a file that is not on it.
- A tick that HELD BACK files shows the failing stage in `--status`. Look
  when you finish a step; a failure that is yours gets fixed, and the next
  tick commits.
- Nothing notifies you about the loop: it stops by itself on a protected
  branch or a detached HEAD, and `--status` says so. Read it when you finish
  a step, never in a polling loop.

## When the session will change nothing more -- `/owa-gi finish`

Run `git-interval.mjs --finish` as the LAST call before the final message
once this session will change nothing more: the task the user asked for is
done and handed off (gate, paper trail), and the turn does not end on a
question whose answer brings edits -- an `owa-enhance` report waiting for
`apply` keeps the interval; the closed `apply` finishes it. The user typing
`/owa-gi finish` does the same.

- It returns at once. Within 5 s the loop runs one last tick in the
  background -- commits what is left when the scoped gate passes, pulls,
  pushes, waiting its turn behind another session's tick rather than skipping
  -- and stops. Say so in one line (what it printed: how many files the last
  tick has to commit) and end the turn; do not wait for the tick or poll
  `--status` for it.
- Nothing running for this session: it says so and changes nothing.
- More work asked later: the interval is not restarted by you -- it pushes,
  so only the user starts it. Say in one line that `/owa-gi <minutes>` starts
  it again.

The session ending does the same by itself: the loop looks for the session's
process every 5 s and, once it is gone, runs the same last tick and stops.

## `/owa-gi stop`, `status`, `now`

- `stop` -- `git-interval.mjs --stop`: at once, no last tick.
- `status` -- `git-interval.mjs --status`: running or not, finishing or not,
  the last ticks.
- `now` -- `git-interval.mjs --once --trailer="..."` in the foreground: one
  tick, the same rules. The one command that waits, for the gate and the
  push -- only when the user asks for it.

State and log: `node_modules/.cache/owa-git-interval/<session>.{json,log}`
(and `<session>.finish` while a finish is pending), pruned after two days.
