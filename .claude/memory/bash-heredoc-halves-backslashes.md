---
name: bash-heredoc-halves-backslashes
description: "In this harness any Bash-tool command text delivers `\\\\` as `\\` — a heredoc (even a quoted <<'EOF') and a single-quoted argument such as node -e '...' alike; `\\\\r?\\\\n` lands as a real CR/LF and `\\\\b` as a backspace, while a single backslash passes intact. Write files with backslashes through Write/Edit, never through a shell command; an apostrophe inside a single-quoted node -e ends the quote (unexpected EOF) — a script file cures both; and Edit writes a u-escape of an invisible or combining character (u200B) as the character itself"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7e78f17c-0c5c-4a56-b18a-3a7634da32e6
  modified: 2026-10-23T19:48:09.741Z
---

On 2026-09-08 a python edit script fed through the Bash tool as a quoted
heredoc wrote `.split(/` + CR + `?` + LF + `/)` into a TypeScript file where
the script said `.split(/\\r?\\n/)`, and a 0x08 byte where it said `\\b`. The
heredoc reached python with every `\\` already halved to `\`, so python then
processed `\r`, `\n` and `\b` as escapes. Three rewrites "succeeded" and left
the same broken bytes, because the fix went through the same door.

On 2026-09-14 it was not a heredoc at all: a `node -e '…'` argument in single
quotes — which bash itself passes on verbatim — still reached Node with
`\\r?\\n` halved, and an index line appended to `MEMORY.md` came out split by a
raw CR and LF, while `"\r\n"` written with single backslashes in the same
command arrived intact. So the rewrite belongs to the Bash tool's command
text, not to heredocs; the repair went through a script file written with the
Write tool.

The same door breaks QUOTING, loudly this time: an apostrophe inside a
single-quoted `node -e '…'` or `python -c '…'` (a `don't` in a string, a `'`
in a selector) ends the quote early and bash stops with `unexpected EOF while
looking for matching` — about a third of sessions hit it in the week to
2026-10-08, each paying a retry. Same cure as below.

**The Edit tool has its own rewrite, for `\uXXXX`** (2026-10-23): a
`new_string` holding `/[\s\u200B\u05BE]+/` landed in the file as the literal
zero-width space and maqaf, and test strings written `'\u179A'`,
`'\u0F71'`, `'\u0301'` landed as the Khmer ro, the Tibetan sign and the
combining acute themselves (the tool matches escapes and characters as one).
Code still ran and every test passed; `npm run lint`'s eslint stage stopped
on `no-irregular-whitespace`, and nothing caught the rest — a reader just
cannot see which letter it is. Cure: a script file written with Write that
sets the line (`'\\u200B'` in its source), then `grep -c 'u200B'` to prove
the escape is in the file.

**Why:** the failure is silent — the file is written, the typecheck error
points at an "unterminated regular expression", and nothing says the bytes
are not what was typed. Half an hour went on it.

**How to apply:** any file content that carries a backslash — a regex, a
Windows path, an escaped quote — goes through the Write or Edit tool, through
a script FILE written by the Write tool and then run, or through python built
from `chr(92)` / `chr(13)` / `chr(10)`. A shell command, heredoc or quoted
argument, is safe only for text that needs no doubled backslash. Related:
[[chatbot-cdp-driver-gotchas]] (the other shell rewriting trap, `/screen` → a
Program Files path), [[crlf-checkout-line-regex]].
