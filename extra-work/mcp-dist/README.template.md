# open-worship-app-mcp

The MCP server of the [Open Worship App](https://www.openworship.app), for
any AI agent that speaks the Model Context Protocol (Claude Code, Claude
Desktop, Cursor, VS Code, ...). Start the app, add this server to your
client, and the agent can see and drive the app the way its own built-in
help assistant does: find a control by its words, press it, read what is on
the projector, put a verse up, look up the manual, edit a song or a slide
document with every change backed up for undo.

It is the same server the app runs inside itself for its 🤖 help window --
{{TOOL_COUNT}} tools: Chrome DevTools' browser tools aimed at the running app
plus the app's own `owa_*` tools -- with the same firewall in front.

Version {{VERSION}} follows the app's {{APP_VERSION}} (npm writes no leading
zero).

## Quick start

1. Install and open the Open Worship App. **Settings -> AI Providers ->
   Enable AI features** must be on (it is unless someone turned it off); with
   it off the app opens no door for an agent.
2. Add the server to your client:

   ```sh
   claude mcp add owa-devtools -- npx -y open-worship-app-mcp
   ```

   or, for a client configured with JSON:

   ```json
   {
     "mcpServers": {
       "owa-devtools": {
         "command": "npx",
         "args": ["-y", "open-worship-app-mcp"]
       }
     }
   }
   ```

3. Ask your agent something like _"What is on the projector right now?"_ or
   _"Open the Bible Reader at John 3:16"_.

Nothing to configure: the server finds the running app by itself. Every app
publishes how to reach it in `<temp folder>/open-worship-app-cdp/<pid>.json`;
the server reads the newest one on every call, so it can start before the
app and follows a restart. Requires Node.js {{NODE_RANGE}}.

### No Node.js on that computer?

The app carries the SAME server as a single executable: **Settings -> Others
-> Extra Binaries**, install (or update) the pack, and the **AI agents (MCP)**
picker shows, for the AI program you choose in it, the command or settings
text to paste into it, with a **Copy** button. The executable runs the very
files this package runs; the build holds the two to the same answers, tool
for tool.

### Choosing an app

| Setting                 | What it does                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| (none)                  | One app running: drives it. Several: lists them and drives none until the agent asks you and calls `owa_choose_app` with the pid you pick. |
| `OWA_CDP_TARGET=dev`    | Only a development app (`npm run dev`), following its restarts.            |
| `OWA_CDP_TARGET=prod`   | Only an installed (packaged) app.                                          |
| `OWA_CDP_PORT=<port>`   | That debugging port or nothing -- a pin, never a preference.               |

The server is made from one app version and the tools follow that version's
words and panels: `owa_app_state` carries `versionCheck`, and when the two
differ it says which to update. The server's `initialize` instructions tell the
agent both things.

For a client that can only be pointed at one fixed URL,
`npx open-worship-app-mcp --bridge --listen=9223` forwards that port to
wherever the app is.

## What an agent may do

**The assistant may point, the human presses.** Every window of the app runs
with Node.js integration, so the server's firewall refuses and hides
`evaluate_script`, `take_heapsnapshot` and `upload_file`; allows navigation
only to the app's own pages; refuses a press on anything that cannot be
undone (delete, discard, clear all, sign out ... in every language the app is
shown in, read on the control itself as well as on the words); leaves the
app's own questions (confirm, alert) to the person; rations acting calls to 25
a minute, web reads and removals to 10 every five minutes each; and scrubs
provider keys and tokens out of every result. Every change to a document is
backed up first and carries an `undoId`; `owa_undo` takes it back.

`OWA_MCP_FIREWALL=off` turns the firewall off. It is an environment variable
only, so nothing an agent sends can reach it; do not set it to make a task
easier.

## Tools

{{TOOL_TABLE}}

## JavaScript / TypeScript API

The package exports the same server as functions (ESM, typed by
`index.d.mts`; on Node 22.12 and later `require()` works too):

```ts
import {
  createOwaMcpServer,
  findDrivenInstance,
  listOwaAppInstances,
  runOwaMcpStdioServer,
  type OwaAppInstance,
} from 'open-worship-app-mcp';

// Which apps are running? (newest first; the app's own door token is never
// handed out)
const apps: OwaAppInstance[] = listOwaAppInstances();
console.log(apps.map((app) => `${app.version} on port ${app.port}`));
console.log(findDrivenInstance()); // the one a server started now would drive

// Serve it over this process's stdin/stdout, exactly as the command does:
await runOwaMcpStdioServer();

// ... or put it behind a transport of your own (any MCP SDK transport):
const { server } = await createOwaMcpServer();
await server.connect(myTransport);
```

| Export                              | What it is                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| `listOwaAppInstances()`             | Every running app, newest first.                                   |
| `findDrivenInstance()`              | The app a server started now would drive, or `null`.               |
| `resolveAppBrowserUrl()`            | Its debugging address (`http://127.0.0.1:1` when none runs).       |
| `createOwaMcpServer(options?)`      | The MCP server, not yet connected: `{ server }`.                   |
| `runOwaMcpStdioServer(options?)`    | The command's own body: serves on stdin/stdout.                    |
| `runOwaMcpBridge({ listenPort })`   | The `--bridge` forwarder: `{ port, close }`.                       |
| `redactSecrets(text)`               | The firewall's scrubber for keys and tokens.                       |
| `OWA_CDP_INFO_DIR_PATH`             | Where the running apps publish themselves.                         |

Finding an app reads a few small files; the server itself (Chrome DevTools
MCP and puppeteer) loads only when one is asked for.

## What is in the package

| Folder                       | What                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| `tools/owa-devtools-mcp/`    | The server, its tests and the question corpus it answers from.     |
| `electron-build/knowledge/`  | The knowledge bundle: the user manual and the developers' notes.   |
| `docs/manual-sources/`       | The manual's pages.                                                |
| `src/lang/data/`             | English's tables and every language package's text (dictionary, assistant facts, questions, translated manual). |
| `.claude/skills/owa-robot-test/` | The app's robot end-to-end test, a Claude Code skill: QA of the live app through this server. |
| `docs/test-paths/coverage-matrix.md` | What that robot test covers.                               |

The folders mirror the app's own repository, because every module finds its
files from there. No credential, no binary, no file git ignores; a home
folder in a note is written `~`.

## Tests

```sh
npm install
npm test
```

The server's unit tests ({{TEST_COUNT}} files), run as the app runs them. For
live testing, open this folder in Claude Code (its `.mcp.json` names the
server `owa-devtools`, as the skill expects), start the app, and ask for
`/owa-robot-test`.

## Source and license

Built from [OpenWorshipApp/open-worship-app-dt](https://github.com/OpenWorshipApp/open-worship-app-dt)
at commit `{{COMMIT}}` by `npm run build-open-worship-app-mcp`; change it
there, not here. GPL-2.0, see `LICENSE.txt`.
