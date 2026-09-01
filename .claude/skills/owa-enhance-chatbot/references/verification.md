# Verifying a chatbot change in the live app

A change here is done when it was seen working in the running app — not when it
typechecks. This file is the how.

## Ground rules

- **Verify first, build last.** `npm run build` / `electron:build` deletes
  `electron-build/`, the running app's own main entry, and kills it. The `npm run
  lint` gate ends in a build, so it goes last.
- **Except knowledge work**, which needs a build to be visible at all. Plan for
  the restart: build, relaunch, then verify.
- **`mcp__owa-devtools__evaluate_script` is dead under Node 22**
  ("DisposableStack is not defined"). Drive pages over raw CDP `Runtime.evaluate`
  instead. Everything else in the MCP works.
- **Never `import()` an app module** in an evaluated expression — it re-runs
  `document.onkeydown` and kills every keyboard shortcut in the app.
- **Reload before calling something a regression.** Dev HMR leaves stale state,
  unmounts overlays and drops keyboard layers.
- **Never touch a screen the user says is live.**

## Reaching the app

```bash
node .claude/skills/owa-enhance-chatbot/scripts/audit-mcp-tools.mjs
```

Both endpoints come from the same published file — one per live instance:

```bash
cat "$(node -p "require('path').join(require('os').tmpdir(),'open-worship-app-cdp')")"/*.json
# { "port": <cdp>, "url": "http://127.0.0.1:<cdp>", "mcpUrl": "http://127.0.0.1:<mcp>/mcp", ... }
```

Not running? `env -u ELECTRON_RUN_AS_NODE npm run dev` (the harness exports
`ELECTRON_RUN_AS_NODE=1`, which makes Electron run as plain Node and crash in
`registerSchemesAsPrivileged`).

## Targets you will be driving

| Window | `list_pages` url |
| --- | --- |
| Main | `…/presenter.html` or `…/reader.html` |
| Chatbot | `…/chatbot.html?uuid=chatbot` |
| Settings | `…/setting.html` |
| A SHOWING projector screen | `…/screen.html?screenId=N` — the target vanishes when it hides |

`mcp__owa-devtools__select_page` + `take_screenshot` is the quickest look at the
chatbot window. Screenshot before and after any UI change.

## Driving the chatbot window over raw CDP

The pattern both `extra-work/verify-chatbot-*.mjs` scripts use: find the target,
open a websocket, `Runtime.evaluate`. In a scratch `.mjs`:

```js
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const chatbot = targets.find((one) => one.url.includes('chatbot.html'));
// then Runtime.evaluate over one.webSocketDebuggerUrl
```

Useful expressions inside that window (plain DOM, no app imports):

```js
// ask a question
const input = document.querySelector('textarea, input[type="text"]');
// set value through the native setter so React sees it, then dispatch 'input'

// read the answers back
[...document.querySelectorAll('[data-react-comp-name="RenderMessageComp"]')]
    .map((one) => one.innerText.slice(0, 400));

// which tab / provider / model the head row is on
document.querySelector('[data-react-comp-name="RenderProviderSwitchComp"]')?.innerText;
```

`data-react-comp-name` / `data-react-comp-fp` are stamped on every `*Comp` root
**in dev only**, and carry the INNERMOST component's name. They are the fastest
way from a pixel to a source file.

## Calling a tool the way the chatbot does

`extra-work/verify-chatbot-tools.mjs` already speaks MCP over the HTTP host with
one session (`initialize` → `notifications/initialized` → `tools/list` →
`tools/call`). Copy its plumbing for a one-off check, or run it whole:

```bash
node extra-work/verify-chatbot-tools.mjs     # read-only + 1 harmless click + 1 type
```

For a full conversational pass — the presenter|reader × claude|chatgpt matrix,
plus a guide card per provider:

```bash
node extra-work/verify-chatbot-e2e.mjs       # spends REAL API credit — ask first
```

> Both still hardcode `http://127.0.0.1:39223/mcp` (backlog `EC-05`). If they say
> the app is down and the audit script says otherwise, that is why.

## The checks that are easy to forget

| Check | How |
| --- | --- |
| An acting tool ANNOUNCES itself | Call it; the banner appears in the app window. `describeToolCall(name, args)` from `notify.mjs` must return a phrase. |
| A guide lands on the real control | `owa_guide_start`, then look: the red ring must be on the control the step names. `owa_guide_status` reports `isTargetFound` and `nearMisses`. |
| The answer contains no internals | No file path, id, setting key or component name in what the user sees — including when the model read an `internal` page. |
| The offline path still works | Ask with the provider deliberately broken (wrong key). The manual answer must come back with a note naming the provider that failed. |
| The empty state | Clear the keys in Settings → Others and reopen: the window must say so and offer the button that opens Settings. |
| Tabs survive a reopen | Open two tabs, ask in both, close and reopen the window: both come back (`local-storage/chatbot-sessions`). |
| The other window | An answer for the presenter must not describe reader controls, and vice versa. The Bible Reader has one reference box and a version button — no Book/Chapter/Verse buttons. |
| Cost | Re-run the audit script and quote before/after. |

## Where the logs are

- The `npm run dev` terminal carries the electron main process, the MCP host, and
  anything a hidden or early-mount screen window logs (`all:app:log`).
- The chatbot window's own console: `list_console_messages` after
  `select_page` on the `chatbot.html` target.
- A tool that failed inside the loop is handed back to the model as
  `Tool error: …` text rather than thrown — so a bad answer with no visible error
  often has one in the tool result. Call the tool by hand and read it.

## Restoring

Leave the app the way you found it: stop any guide
(`owa_guide_step {action: 'stop'}`, or the card's ✕), put the main window back on
the page it was on (`owa_goto_page`), close scratch tabs in the chatbot, and never
leave a screen hidden that was showing when you started.
