---
name: discovery-file-holds-the-token
description: never print <temp>/open-worship-app-cdp/<pid>.json — it carries the per-launch MCP bearer token; list the directory or print one field
metadata:
  type: feedback
---

The discovery file a running app publishes
(`<temp>/open-worship-app-cdp/<pid>.json`) holds `mcpToken`, the per-launch
bearer token of the MCP door, beside `pid`, `port` and `startedAt`. Printing
the whole file — `cat`, `Get-Content`, a file read — puts the token in a tool
result and so in model context, the one place `.claude/CLAUDE.md` says it
never goes.

**Why:** 2026-10-12, a session checking whether the dev app had been
relaunched printed the file to read `startedAt`. The token went nowhere else
and dies with that launch, but nothing in the file's name says what it
carries. (The session's own reading of the slip: the habit of printing a
small JSON file to look at one field.)

**How to apply:** to see whether an app was relaunched, list the directory —
the file NAME is the pid — or print single fields:
`node -e "const f=require(process.argv[1]);console.log(f.pid,f.startedAt)" <file>`.
A script that needs the token reads it itself and logs nothing of it. See
[[agent-access-mcp-chatbot]] and [[corpus-run-in-a-shared-dev-app]].
