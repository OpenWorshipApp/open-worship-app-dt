---
name: owa-lt
description: 'Switch THIS session from the full `npm run lint` gate (~8 min) to the lint gate scoped to the files the session touched -- prettier, eslint, the typecheck, the vitest tests related to those files; the build skipped unless a build-shaping file changed -- for the rest of the session. Use when the user says "/owa-lt", "lint touched files only", "skip the whole lint gate", "no full lint", "scoped lint", "lint only what you changed", or asks mid-task to stop waiting on the full gate. `/owa-lt list` shows the touched files, `/owa-lt final` runs the scoped gate then the full one, `/owa-lt off` goes back to the full gate.'
argument-hint: '[list | final | off]'
---

# Scoped lint gate (`/owa-lt`)

From this moment until the user says otherwise (or `/owa-lt off`), in THIS
session:

1. **Do not run `npm run lint` after a change.** This replaces CLAUDE.md's
   "after any code change, also run `npm run lint`" for this session only
   (memory `lint-gate-only-at-final-validation`).
2. **After each change, run the scoped gate:**

   ```sh
   node .claude/skills/owa-lt/scripts/lint-touched.mjs
   ```

   It reads the files this session touched -- logged by the PostToolUse hook
   in `.claude/settings.json` after every Edit / Write / NotebookEdit since
   the session started, keyed by `CLAUDE_CODE_SESSION_ID` -- and runs the
   gate's own tools and flags on those files only. Seconds, not minutes
   (measured 2026-11-12: one component, 7 s).

3. **A file changed through Bash** (`sed`, a heredoc, a script, `git mv`) is
   invisible to the hook. Put it on the list:
   `node .claude/skills/owa-lt/scripts/touched-files.mjs add <file>...`
   (or pass it as an argument to `lint-touched.mjs` for one run).

## Reading the result

| Stage       | What it checks                                                                 | On FAIL / WARN                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prettier`  | `lint:pre`'s patterns among the touched files                                  | Yours. Fix the file (never `npm run format` the tree).                                                                                                                                                                       |
| `eslint`    | `lint:es`'s patterns, `--max-warnings 0`                                       | Yours.                                                                                                                                                                                                                       |
| `typecheck` | BOTH tsconfigs, whole project (~2 s)                                           | FAIL = an error in a touched file: yours. WARN = errors elsewhere: read them. One in a file that imports what you changed is a caller you broke -- yours. Otherwise another session's work in progress: report it, leave it. |
| `tests`     | `vitest related` on the touched files + the tests that read files off the disk | Yours to look at. A test that was already red before your change is still reported: say so with the output, never call the run green.                                                                                        |
| `build`     | `extra-work/check-build.mjs`                                                   | SKIP is normal. It runs by itself when a build-shaping file changed (`vite.config.ts`, `vite-plugin-*.ts`, `html/`, `package.json`, `src/boot.ts`); `--build` forces it, `--no-build` holds it off.                          |

`NOTE:` lines are CLAUDE.md rules the gate cannot do for you -- the knowledge
rebuild after a `.claude/` edit, a language package's version bump and pack.
Do them in the same change.

## Arguments

- _(none)_ -- switch the session to the scoped gate and run it once now.
- `list` -- `lint-touched.mjs --list`: the files the session touched.
- `final` -- the scoped gate, then the full `npm run lint` once: the final
  validation before the work is called done.
- `off` -- back to the full gate after every change, for the rest of the
  session.

## The final hand-off

Unless the user said to skip that too, the full `npm run lint` still runs
ONCE before the work is called done, and its failures that are not this
session's are reported as such, not fixed and not hidden.

## Limits

- The list starts with the hook. Edits made before `.claude/settings.json`
  carried it (before 2026-11-12), or by a session whose settings predate it,
  are not on it -- `touched-files.mjs add` them.
- A sub-agent's edits are logged under whatever session id its hook event
  carries. If `list` misses files a sub-agent changed, add them.
- `vitest related` follows imports. A test that READS its subject off the
  disk is added by `pickDiskReadingTests` in `lint-touched.mjs` (agent docs,
  the manual, the question corpus, language packages, the language
  confinement and tran-key tests); a new test of that kind belongs in that
  table.
- Lists live in `node_modules/.cache/owa-touched/<session>.txt` and are
  pruned after two days.
