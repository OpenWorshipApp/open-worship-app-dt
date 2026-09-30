---
name: crlf-checkout-line-regex
description: "This Windows checkout's text files are CRLF (core.autocrlf=true) — split repo text on /\\r?\\n/, or an anchored (.*)$ silently matches nothing; Git Bash sed hides the \\r; and the lint gate's prettier stage then fails on the WHOLE tree, blocking lint:es and lint:build"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3cbdef67-392b-41e4-ada9-0a522825785a
  modified: 2026-09-14T22:04:15.557Z
---

Text files in this working tree are **CRLF** — `git config core.autocrlf` is
`true` — while a file a tool or script writes fresh is usually LF. Measured
2026-09-14: the three `owa-enhance-*` backlogs were CRLF throughout.

A Node script that reads repo markdown with `text.split('\n')` keeps a `\r` on
every line, and `.` does not match `\r`, so an anchored `(.*)$` fails without
an error. `/owa-enhance`'s `scripts/triage.mjs` first counted **zero** items in
every backlog that way; its `LINE_BREAK_PATTERN = /\r?\n/` is the pattern to
copy.

**Why:** the failure is silent — a count of 0 reads as "nothing open", not as
"the parser is broken".

**How to apply:** split tracked text on `/\r?\n/` in any script. Check line
endings on the FILE (`tail -c 4 file | od -c`, or Node) — not through Git Bash
`sed -n Np`, which strips the `\r` and made a CRLF line look LF. Git normalises
endings on `git add`, so mixed endings from an edit are cosmetic, never a diff.
Related: [[bash-heredoc-halves-backslashes]], another Git Bash rewrite that
hides what a file really holds.

**It also breaks the lint gate, repo-wide** (2026-09-26). `lint:pre` is
`prettier --check`, which expects LF, so in this checkout it reports **1299
files** with "code style issues" — every tracked file, including ones the
session never touched (`electron/index.ts` fails identically). Because `lint`
is `&&`-chained, that stage stops `lint:es` and `lint:build` from running at
all, so the gate LOOKS failed by your change when nothing of yours is wrong.

**Never answer it with `npm run format`** — that rewrites all 1299 files to LF
and buries a real diff. Instead: check your own files with
`npx prettier --end-of-line crlf --check <files>` (and `--write` the ones that
need it, which keeps the tree's CRLF), then run the blocked stages directly —
`npm run lint:es` and `npm run lint:build`. Confirm the failure is
environmental first by `--check`ing a file you did not touch.
