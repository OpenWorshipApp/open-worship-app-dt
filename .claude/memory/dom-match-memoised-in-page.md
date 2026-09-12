---
name: dom-match-memoised-in-page
description: "The owa-devtools DOM matcher and guide cache themselves on the page, so a window driven once keeps the OLD runtime after you edit domMatch.mjs/guide.mjs"
metadata:
  type: project
---

`DOM_MATCH_RUNTIME` and the guide runtime both open with
`if (window.__owaDomMatch !== undefined) return window.__owaDomMatch;`
(same for `window.__owaGuide`). They are strings evaluated in the app page and
they memoise themselves there, so **a window that has been driven once keeps the
runtime it was first given** — for the life of that page, across any number of
tool calls.

Nothing a user can ever hit (the string never changes at runtime). Everything a
verification run hits: after editing `tools/owa-devtools-mcp/domMatch.mjs` or
`guide.mjs`, a fresh MCP host serves the new string and the page ignores it,
which reads exactly like "my fix did not work". Clear them first:

```js
delete window.__owaDomMatch; delete window.__owaGuide;
```

then restart any running guide — a live guide closed over the OLD `dm` when it
started, so clearing the cache alone does not re-target it.

Two more traps in the same files:

- **The runtime is one big template literal.** A backtick anywhere inside it —
  including in a comment, e.g. `` // `atWordStart` is … `` — closes the string
  and the file fails to PARSE. The header warns about this for the generator
  functions; it applies to the runtime body itself just as hard.
- Verify through the app's own MCP host, not your own `mcp__owa-devtools__*`
  tools — see [[mcp-tool-edit-two-processes]]. With [[evaluate-script-disposablestack]]
  killing `evaluate_script`, `evaluateInApp` from `cdp.mjs` is the way to reach
  the page.
