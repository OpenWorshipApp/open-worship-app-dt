---
name: bash-heredoc-halves-backslashes
description: "In this harness a Bash-tool heredoc (even a quoted <<'EOF') delivers `\\\\` as `\\` - a python edit script's `\\\\r?\\\\n` lands as a real CR/LF and `\\\\b` as a backspace; write files with backslashes through Write/Edit, never through a heredoc"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7e78f17c-0c5c-4a56-b18a-3a7634da32e6
  modified: 2026-09-08T20:05:18.355Z
---

On 2026-09-08 a python edit script fed through the Bash tool as a quoted
heredoc wrote `.split(/` + CR + `?` + LF + `/)` into a TypeScript file where
the script said `.split(/\\r?\\n/)`, and a 0x08 byte where it said `\\b`. The
heredoc reached python with every `\\` already halved to `\`, so python then
processed `\r`, `\n` and `\b` as escapes. Three rewrites "succeeded" and left
the same broken bytes, because the fix went through the same door.

**Why:** the failure is silent — the file is written, the typecheck error
points at an "unterminated regular expression", and nothing says the bytes
are not what was typed. Half an hour went on it.

**How to apply:** any file content that carries a backslash — a regex, a
Windows path, an escaped quote — goes through the Write or Edit tool, or
through python built from `chr(92)` / `chr(13)` / `chr(10)`. A heredoc is fine
for text with no backslashes at all. Related: [[chatbot-cdp-driver-gotchas]]
(the other shell rewriting trap, `/screen` → a Program Files path).
