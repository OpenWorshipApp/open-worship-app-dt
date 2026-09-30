---
name: preload-must-not-eval-at-load
description: "Anything a preload require()s must not run new Function/eval at module load - a page CSP without 'unsafe-eval' (chatbot.html in dev, EVERY page packaged) throws inside the preload and the window never mounts"
metadata: 
  node_type: memory
  type: project
  originSessionId: cfb3b6e1-d50b-416c-90f6-32ac8c6f9510
  modified: 2026-09-18T13:50:08.311Z
---

Every renderer's preload requires `electron/electronHelpers.ts`, so the whole
graph behind it runs inside the PAGE's context -- and the page's CSP applies
to it. `chatbot.html` (dev) and every page in a packaged build (the
`<!-- prod ... prod -->` CSP blocks) have `script-src 'self' 'unsafe-inline'`
and no `'unsafe-eval'`. A `new Function(...)` or `eval` at module load anywhere
in that graph throws `EvalError`, the preload fails ("Unable to load preload
script"), `appProvider` is undefined ("reading 'isPageReader'"), and the window
sits on its loading placeholder for good -- the chatbot's reads **Standing
by**. A reload can happen to survive, which makes it look intermittent.

Hit 2026-09-18 (`MC-32`): the staged MC-16 work made `electronHelpers` import
`webCaptureHelpers`, which imports `aiHelpers`, whose top level built
`importEsm` with `new Function`. Fixed by building it on the first call (only
the main process calls it); `aiHelpers.test.ts` loads the module under a
refusing `Function` with a positive control.

**Why:** the failure is invisible in dev for every window except the three
locked-down pages, so a new import edge passes review and ships a packaged app
that opens no window.

**How to apply:** before adding an import from a main-process module into
`electronHelpers` (or anything a `client/*` preload reaches), check the new
graph's top levels for `new Function` / `eval` / a library that does it at
load; make such code lazy. To see it live, open the chatbot window FRESH (not a
reload) and read its console. Related: [[agent-access-mcp-chatbot]],
[[slide-website-loads-in-a-box]].
