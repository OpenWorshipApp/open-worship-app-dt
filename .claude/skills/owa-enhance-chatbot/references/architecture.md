# Chatbot & MCP architecture

How a question becomes an answer, which parts are load bearing, and what each
piece is deliberately NOT doing.

## The path of one question

```
user types in chatbot.html
  └─ ChatbotAppComp            tab in front supplies focus + provider + model
      └─ askLlmBot()           llmBotHelpers.ts
          ├─ listTools()       mcpClient.ts ── HTTP ──▶ host.mjs ──▶ server.mjs
          │                                              (one MCP server per session)
          ├─ genSystemPrompt(focus)          built ONCE per question
          └─ loop, max 10 rounds:
                provider call (Anthropic | OpenAI) with ALL tools
                  └─ tool_use ──▶ callTool() ──▶ owaTools.mjs handler
                                     ├─ help.mjs      reads electron-build/knowledge/
                                     ├─ cdp.mjs       Runtime.evaluate in the app page
                                     ├─ domMatch.mjs  builds the find/click/type expression
                                     ├─ guide.mjs     draws the walkthrough card
                                     └─ notify.mjs    banner, if the tool ACTS
                last round drops the tools: answer with what you have
  └─ on any throw ▶ askHelpBot()  helpBotHelpers.ts — offline manual search
```

The failure path matters as much as the happy one: a provider outage, a bad key
or an MCP host that is gone all land in the same place — the offline bot answers
from the manual and the window notes which provider failed. That is what a
volunteer gets when the building's wifi dies mid-service.

## Two doors, one server

`electron/aiHelpers.ts` opens both, and only when the master switch allows it.

| Door | Opened by | Used by |
| --- | --- | --- |
| CDP (`--remote-debugging-port=0`) | `enableRemoteDebugging()` — synchronous, before `ready`, after the single-instance lock | every tool that touches a page, via `cdp.mjs` |
| MCP over streamable HTTP | `startMcpHost()` → `host.mjs`, `OWA_MCP_PORT` (default 39223, next free if taken) | the in-app chatbot |
| MCP over stdio | `bin.mjs`, registered in `./.mcp.json` as `owa-devtools` | an outside agent (Claude Code, robot-test) |

`enableRemoteDebugging()` **must stay synchronous**: Chromium reads the switch
when it starts the DevTools handler, so an awaited free-port lookup loses the race
and the app silently gets no endpoint at all.

Both MCP doors build the same server through `createOwaMcpServer()`, so a tool
added for one is shipped to the other.

`server.mjs` also does two things that look optional and are not:

- `args.usageStatistics = false` — chrome-devtools-mcp's telemetry is a
  process-wide singleton that THROWS on the second `createMcpServer` (the app
  makes one per MCP session), and it would report from a church's machine.
- `browserUrl` is a live **getter**, not a string — the app's debugging port
  changes every launch, so one long-lived server follows the app across restarts.
  It must never be falsy, or chrome-devtools-mcp launches its own Chrome.

## Discovery — nothing has a fixed port

`publishAiEndpoints()` writes `<temp>/open-worship-app-cdp/<pid>.json`:

```json
{ "pid": 3824, "port": 65138, "url": "http://127.0.0.1:65138",
  "mcpUrl": "http://127.0.0.1:39223/mcp", "isDev": true,
  "version": "…", "userDataPath": "…", "startedAt": "…" }
```

One file per live instance, swept when a pid is gone, removed on `will-quit`.
Chromium reports its chosen port through `<userData>/DevToolsActivePort`, polled
after `ready`. `discovery.mjs` reads these files for the stdio side.

**Read `mcpUrl` from here.** 39223 is where the host usually lands, not a promise.

## The master switch

Settings → Others → *Enable AI features* writes `ai-enabled` into `clientSetting`
in `<userData>/setting.json`.

- `checkIsAiEnabled()` (`electron/aiHelpers.ts`) reads that file directly, before
  `ready` and before the setting manager exists.
- `getIsAIEnabled()` (`src/helper/ai/aiHelpers.ts`) is the renderer twin and
  **must agree**, or the toggle, the 🤖 button and the provider clients contradict
  a process that opened no door.
- **Unset = OFF packaged, ON in dev.**
- Off means: no CDP endpoint, no MCP host, no Help menu item, no 🤖 button, and
  the renderer's AI providers refuse to hand out a client.
- It takes effect on the next launch only. That is the point — the doors are
  opened before anything can ask.

## Knowledge

`extra-work/build-knowledge.mjs` runs as part of `npm run electron:build` and
bundles two corpora into `electron-build/knowledge/` with a search index:

| kind | source | weight |
| --- | --- | ---: |
| `manual` | `docs/manual-sources/**` (generated from `user-workflows.md`) | 1.5 |
| `internal` | `.claude/CLAUDE.md`, `.claude/memory/`, `.claude/skills/` | 1.0 |

The main process passes the location in through `OWA_KNOWLEDGE_DIR`.

`internal` is an **allowlist gating the top level only** — below an allowed
directory, every `.md` comes along. It is copied verbatim into the installer and
lands in plaintext on every operator's disk, which is why it is a named list and
not a denylist, and why anything you write under `.claude/skills/` ships.

A query reads ONE index file rather than opening ~140 markdown files, and reads a
document in full only when it is actually opened. Nothing is held between
questions: this runs inside the app, on machines where a cached corpus would be
felt.

## The window

`html/chatbot.html` → `src/chatbot/ChatbotAppComp.tsx`, opened by the 🤖 toolbar
button (`ChatbotButtonComp`, left of Help on both presenter and reader) or
Help → *App Help (Chatbot)*.

- A **tab strip** above the head row holds several conversations, persisted whole
  to `local-storage/chatbot-sessions` (`chatSessionHelpers.ts`, capped at 12 tabs
  × 60 messages, debounced save + `beforeunload` flush).
- The **entire head row belongs to the tab in front**, not the window: the
  Presenter/Reader switch (which follows the opener window until the user presses
  one), the Claude/ChatGPT switch, and the model picker. The stored settings
  (`chatbot-llm-provider`, `chatbot-llm-model-<provider>`) are only what a NEW tab
  starts on.
- The model picker lists three models per provider with speed and list price on
  hover, plus *More models…* which asks the account's own `models.list`. A
  non-reasoning OpenAI model is sent no `reasoning_effort`.
- Every answer has **Copy**; every question **Ask again**.
- With no key at all the window says so and offers a button into
  Settings → Others.
- English-only by design — no `tran()` anywhere in `src/chatbot/*`.

## The guide cards

`guide.mjs` injects a numbered card into the app window's own DOM, inside a shadow
root (`#owa-guide-host`), with the current step's control ringed in red. Clicking
the real control advances the card (`lastAction: "user-did-it"`).

- Steps come from a `manualId` recipe or from steps the model writes. A recipe
  only marks controls by **bolding**, and it bolds keystrokes and stressed words
  too — so a demo built from one often cannot press anything, and
  `owa_guide_start` answers `canDemo: false` and quietly degrades to a plain
  walkthrough.
- `mode: "demo"` performs each step on a press of **Do it**.
- Leading steps for a place the user is already in are dropped.
- Like `notify.mjs`, it is a dependency-free string evaluated in the page: it
  never imports an app module (that re-runs `document.onkeydown` and kills every
  shortcut) and it is confined to its own shadow root so no app style reaches it
  and it touches no app state.

## The banner

Every tool call that TOUCHES the interface puts a small banner in the window
saying something else is driving the app. Reading tools (a snapshot, a screenshot,
`owa_app_state`) stay quiet — a banner per read would both cry wolf and photograph
itself during a QA run.

The list is `ACTING_TOOLS` in `notify.mjs`; `watchToolCalls(transport)` is wired
in `server.mjs` **after** `server.connect`, because the SDK chains whatever handler
it finds. `OWA_MCP_NOTICE=0` runs without it.

## Host limits

| Limit | Value | Why it matters |
| --- | --- | --- |
| Session idle sweep | 15 minutes | A help window left open through a service loses its session; `mcpClient.ts` re-opens on the 404 and retries once (never for `initialize` — that loop was a real bug). |
| Max sessions | 8, oldest evicted | A leak shows up as an app that answers a few questions then stops. |
| Max body | 4 MB | |
| Origin check | localhost only | `checkIsAllowedOrigin` |

## Tests that exist

| Runs in `npm test` | File |
| --- | --- |
| ✔ | `tools/owa-devtools-mcp/domMatch.test.mjs` |
| ✔ | `tools/owa-devtools-mcp/guide.test.mjs` |
| ✔ | `tools/owa-devtools-mcp/notify.test.mjs` |
| ✔ | `src/chatbot/chatSessionHelpers.test.ts` |
| ✔ | `src/chatbot/llmBotHelpers.test.ts` |

`tools/**/*.test.mjs` is in the `include` list of `vitest.config.ts`, so MCP
package tests are part of the gate. Untested today: `help.mjs` ranking,
`discovery.mjs`, `host.mjs` session lifecycle, `mcpClient.ts` retry, and
`helpBotHelpers.ts`.
