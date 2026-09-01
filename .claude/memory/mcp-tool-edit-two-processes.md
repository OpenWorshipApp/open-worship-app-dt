---
name: mcp-tool-edit-two-processes
description: "After editing tools/owa-devtools-mcp, the agent's own mcp__owa-devtools__* tools keep serving the OLD code while the app serves the new code"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e541ebe-bc3b-4c9b-9390-88ff0a61c2c9
  modified: 2026-09-01T01:19:56.240Z
---

Editing anything under `tools/owa-devtools-mcp/` puts TWO long-lived processes
out of step, and they disagree in a way that reads exactly like "my fix did not
work":

- **The app's in-process MCP host** (`startMcpHost`, HTTP on 39223) restarts with
  the app — and `npm run electron:watch` watches `tools/owa-devtools-mcp` as well
  as `electron-build`, so saving the file already restarted it. This one is FRESH.
- **The agent's own `mcp__owa-devtools__*` tools** come from a separate stdio
  process that `./.mcp.json` spawned once (`node tools/owa-devtools-mcp/bin.mjs`).
  It imported the module at startup and nothing reloads it. This one is STALE
  until that MCP server is restarted, which a Claude Code session does not do on
  its own.

So on 2026-08-31 `owa_help_search` through the agent's tools returned the
pre-change ranking while the identical call into the app's own host returned the
fixed one. The agent's answer is the misleading one, and it is the one you reach
for first.

**Verify a tool change against the app's HTTP host, not through your own MCP
tools.** Read `mcpUrl` from `<temp>/open-worship-app-cdp/<pid>.json` and speak
JSON-RPC to it directly (initialize → `notifications/initialized` → `tools/call`);
`scripts/audit-mcp-tools.mjs` already resolves that URL. That is also the exact
door the in-app chatbot uses, so it is the more honest test anyway.

Unrelated but adjacent: killing the Electron main process alone does NOT make
nodemon relaunch it — touch a watched file to get the app back. See
[[dont-taskkill-all-electron]] for which process is safe to kill in the first
place, and [[agent-access-mcp-chatbot]] for the two doors.
