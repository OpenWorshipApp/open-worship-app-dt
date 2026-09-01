---
name: evaluate-script-disposablestack
description: owa-devtools `evaluate_script` dies with "DisposableStack is not defined" under Node 22; drive pages over raw CDP Runtime.evaluate instead
metadata:
  type: project
---

As of 2026-08-31 every `mcp__owa-devtools__evaluate_script` call fails with
`Error: DisposableStack is not defined`, whatever the page or the function.
`take_screenshot`, `list_pages`, `owa_app_state` and `owa_find_ui` still work,
so the server itself is fine — only the evaluate path is dead.

**Why:** `.mcp.json` spawns `node tools/owa-devtools-mcp/bin.mjs` with the
machine's own node, and that is v22.22.3. `DisposableStack` (explicit resource
management) only became available in Node 24 / V8 13.x, and the bundled
chrome-devtools-mcp evaluate path uses it. It is not transient and not
page-specific — retrying never helps.

**How to apply:** don't burn calls retrying it. Talk to the CDP endpoint
directly instead — the port comes from `owa_app_state` (there is no fixed one):
`GET http://127.0.0.1:<port>/json/list`, open the target's
`webSocketDebuggerUrl` with node's global `WebSocket`, and send
`Runtime.evaluate` with `{expression, returnByValue: true, awaitPromise: true}`.
That drives popup windows end to end — `window.moveTo`/`window.resizeTo` really
move an Electron popup, `window.close()` closes it, and
`document.querySelector('[data-react-comp-name="SettingButtonComp"]').click()`
reopens one. Electron has no `Browser.getWindowForTarget`, so read geometry off
the page instead (`screenX`/`screenY`/`outerWidth`/`outerHeight`) — note those
report the frame 2px larger than the `setBounds` rectangle on Windows.

The same rule as [[cdp-dynamic-import-hijack]] still applies to whatever you
evaluate: never `import()` an app module.
