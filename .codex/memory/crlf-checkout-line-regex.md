---
name: crlf-checkout-line-regex
description: "This Windows checkout's text files are CRLF (core.autocrlf=true) — split repo text on /\\r?\\n/, or an anchored (.*)$ silently matches nothing; Git Bash sed hides the \\r"
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
