---
name: bash-heredoc-halves-backslashes
description: "In this harness any Bash-tool command text delivers `\\\\` as `\\` — a heredoc (even a quoted <<'EOF') and a single-quoted argument such as node -e '...' alike; `\\\\r?\\\\n` lands as a real CR/LF and `\\\\b` as a backspace, while a single backslash passes intact. Write files with backslashes through Write/Edit, never through a shell command"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7e78f17c-0c5c-4a56-b18a-3a7634da32e6
  modified: 2026-09-14T22:06:51.994Z
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
