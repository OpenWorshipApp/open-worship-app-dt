# owa-devtools-mcp

An MCP server for the **running** Open Worship App: chrome-devtools-mcp's
browser tools, permanently aimed at the app, plus app-level tools that know
what the app is and what its manual says.

Built for two callers:

- the **in-app chatbot** (Help → App Help), which answers a user's "how do
  I …?" from the app's own manual and from what the app is doing right now;
- an **outside agent** (Claude Code, the robot-test skill), driving the app.

## Two front doors

| Door      | How                                                                      |
| --------- | ------------------------------------------------------------------------ |
| HTTP      | The app serves it while running: `http://127.0.0.1:39223/mcp` by default. |
| stdio     | `node tools/owa-devtools-mcp/bin.mjs`                                     |

The repo's `./.mcp.json` already registers the stdio door as `owa-devtools`
(its path is repo-relative, so start the client from the repo root). To register
it per-user instead:

```bash
claude mcp add owa-devtools -- node tools/owa-devtools-mcp/bin.mjs
```

or the HTTP one:

```bash
claude mcp add --transport http owa-devtools http://127.0.0.1:39223/mcp
```

The stdio forms hold no URL at all — they just spawn `bin.mjs`, which finds the
running app through the file it publishes (below). Only the HTTP form names a
port, and only the default one.

## Finding the app

The app takes no fixed debugging port. Chromium binds a free one and the main
process publishes both doors to `<temp>/open-worship-app-cdp/<pid>.json`:

```json
{
    "pid": 17752,
    "port": 56739,
    "url": "http://127.0.0.1:56739",
    "mcpUrl": "http://127.0.0.1:39223/mcp",
    "isDev": true,
    "userDataPath": "…/open-worship-app-dev",
    "startedAt": "2026-08-31T16:19:37.477Z"
}
```

One file per live instance (dev beside the packaged app, or several dev
instances on different `OWA_USER_DATA_PATH`s). `discovery.mjs` reads them,
newest first, and skips instances whose process is gone. `browserUrl` is a live
getter, so one long-lived server follows the app across restarts.

Overrides, in order: `OWA_CDP_PORT` (client side) ·
`OWA_REMOTE_DEBUGGING_PORT` / `--owa-remote-debugging-port=` (app side) ·
`OWA_MCP_PORT` / `--owa-mcp-port=` (app side).

For a client that can only be pointed at one hardcoded URL:

```bash
node tools/owa-devtools-mcp/bin.mjs --bridge --listen=9223
```

forwards that port to whatever the app is on right now, resolved per
connection.

## Tools

Everything chrome-devtools-mcp registers (click, fill, snapshot, screenshot,
`evaluate_script`, console, network, performance), plus:

| Tool               | What it answers                                                              |
| ------------------ | ---------------------------------------------------------------------------- |
| `owa_help_search`  | The app's knowledge: the user manual first, the internal `.claude` notes next |
| `owa_help_page`    | One document in full, by the id a hit carries                                 |
| `owa_app_state`    | Live instances, open windows, and the main window's page/language/theme       |
| `owa_list_screens` | Which presentation screens are showing, and the displays available            |
| `owa_hide_screens` | Hide one screen or all of them (confirm with the user first)                  |
| `owa_find_ui`      | Where a control is on screen — and `highlight` outlines it in the real window |
| `owa_guide_start`  | Walk the user through a task with a numbered card drawn in the app window     |
| `owa_guide_step`   | Move a running walkthrough on — or `do` the current step for the user         |
| `owa_guide_status` | Where the user has got to, and whether this step is one that can be done      |

A guide step acts on the control it names. When it names none but names a
keyboard shortcut instead — `press: "Ctrl+Q"`, or a **Ctrl+Q** written into a
manual recipe — the card presses that instead, so a step like "close the dialog
with the red ✕ or Ctrl+Q" is done rather than apologised for. Nothing on screen
is labelled "Ctrl+Q", so such a step still rings nothing; `canActOnStep` in
`owa_guide_status`, not `isTargetFound`, is what says whether it can be done.

The knowledge comes from `electron-build/knowledge/`, bundled by
`extra-work/build-knowledge.mjs` during `npm run electron:build` and shipped
with the app. `owa_help_search` labels every hit `manual` (user-facing,
live-verified) or `internal` (notes for whoever builds the app) — an answer
quoting the second kind should say so.

## Notes

- App-level tools never `import()` an app module in the page: a dynamic import
  re-runs module top-level code, and the app installs `document.onkeydown`
  there, which kills every keyboard shortcut in the window. They read the DOM,
  or talk to the main process over `require('electron').ipcRenderer`.
- `usageStatistics` is forced off. chrome-devtools-mcp's telemetry is a
  process-wide singleton that throws on a second `createMcpServer` (the app
  serves one per session), and it would report from the operator's machine.
- Switching **Settings → Others → Enable AI features** off means the next
  launch opens neither door.
