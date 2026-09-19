---
name: renderer-has-no-clipboard-module
description: "Electron exposes `clipboard` to MAIN only, so every Copy in the app threw and popped \"Reload is needed\" until it went through an IPC"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2737fefb-cef8-4e5b-8a56-d67843a091ca
  modified: 2026-09-17T20:07:39.551Z
---

Electron 44 exports only `contextBridge`, `ipcRenderer`, `webFrame` and
`webUtils` to a renderer, so `import { clipboard } from 'electron'` in
`electron/client/systemUtils.ts` resolved to `undefined` and
`appProvider.systemUtils.copyToClipboard` threw
`Cannot read properties of undefined (reading 'writeText')` — an uncaught
error, which this app answers with the **Reload is needed** dialog. That broke
EVERY text copy in the app (bible items, notes, the graph, the web-url card —
12+ call sites), found 2026-09-17 while verifying the connection graph's
**Copy as Markdown**. It now sends `main:app:copy-to-clipboard` and main writes
the clipboard.

**Why:** the typings hide it. `declare module 'electron'` exports everything,
so `tsc` is happy in a file compiled for the preload; only running it shows the
module is absent. `shell` is still fine there — it is in the `Common` namespace
of `node_modules/electron/electron.d.ts`, `clipboard` is in `Main` only.

**How to apply:** before using an `electron` module from `electron/client/*`
(the preload side), check which namespace it sits in — read
`electron.d.ts`'s `namespace Common` / `namespace Renderer` blocks, not the
`declare module 'electron'` list at the bottom. Anything main-only needs an
`ipcMain.on` handler in `electron/electronEventListener.ts` and a
`ipcRenderer.send` beside it. Images take the other route — the chatbot's
`copyImageToClipboard` uses the web `navigator.clipboard.write`, which does
work in these renderers. See [[agent-access-mcp-chatbot]] for the preload's
other constraints and [[chatbot-attachments]] for the image path.
