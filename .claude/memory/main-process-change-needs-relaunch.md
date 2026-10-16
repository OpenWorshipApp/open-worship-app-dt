---
name: main-process-change-needs-relaunch
description: "The user's running dev app hot-reloads renderer changes but NOT main-process ones — a feature split across both shows half of itself until View → Relaunch; check the app's start time against the electron file's mtime before calling it broken"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 79e28173-4654-4613-8012-99576e420b79
  modified: 2026-10-15T23:53:43.981Z
---

A feature that adds a main-process IPC handler AND renderer code that asks it
looks broken in the user's own dev app after the edit: the renderer half
arrives by Vite HMR, `electron-build/` is recompiled by the watcher, but the
running main process is the one it started with — the new channel has no
handler, the renderer's ask gets nothing back, and whatever it was to draw is
not drawn. Seen 2026-10-15: the chatbot's window picker
(`main:app:list-app-windows`) was absent from the user's screenshot with a
Bible Reader window open; the app had started at 22:19 UTC and the handler
was compiled at 22:49 UTC. Same for a changed main handler
(`main:app:capture-window`'s `isOwnWindow`) and for the in-app MCP host's
cached `.mjs` modules ([[mcp-tool-edit-two-processes]]).

**Why:** a "missing" feature that is only a stale main process sends the work
off rewriting UI that was fine — and a user told "it works" with no word
about a relaunch sees it still missing.

**How to apply:** before treating a main-backed feature as broken in the
user's app, compare `startedAt` (`owa_app_state`'s instances) with the
`electron/*.ts` mtime; verify on a scratch instance started after the change
([[scratch-dev-instance-beside-user-app]]); and tell the user to relaunch
(View → **Relaunch**) when the change touches `electron/` or
`tools/owa-devtools-mcp/`.
