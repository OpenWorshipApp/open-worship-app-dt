---
name: synthetic-keys-drive-app-shortcuts
description: A synthetic KeyboardEvent at document really does fire the app's shortcuts — but only the renderer-registered ones, and only with `code` set
metadata:
  type: project
---

The app hears every keyboard shortcut through ONE `document.onkeydown`
(`src/event/KeyboardEventListener.ts`), which calls
`KeyboardEventListener.fireEvent(event)`. So a **synthetic**
`new KeyboardEvent('keydown', …)` dispatched at `document` drives the real
shortcut — no OS focus needed, unlike Monaco typing
(see [[cdp-dynamic-import-hijack]] for what you still must not do in an
injected expression).

Verified live 2026-08-31 over CDP: `Ctrl+B` opened the Bible Lookup popup and
`Ctrl+Q` closed it. This is what lets the chatbot's walkthrough card *press* a
step like "close the dialog with **Ctrl+Q**" instead of apologising
(`toKeystroke` / `pressKeys` in `tools/owa-devtools-mcp/guide.mjs`).

Three things decide whether it works:

- **Renderer binding vs Electron menu accelerator.** Only shortcuts registered
  in the renderer through `useKeyboardRegistering` are reachable. `F7/F8/F9`
  (`MiniScreenClearControlComp`), `Ctrl+Q` (`ModalComp`) and `Ctrl+B`
  (`others/commonButtons.tsx`) all are. An `accelerator:` in
  `electron/electronMenu.ts` (print, find) is handled by the main process and a
  page event will never reach it — check which kind before assuming.
- **Send `code`, not just `key`.** `toEnUsKey` forces single-character keys back
  to an en-US layout *through* `event.code`, so `{key: 'q'}` with no `code`
  matches nothing on a German or Khmer keyboard — exactly this app's users.
  Use `KeyQ` / `Digit3`; named keys (`F9`, `Escape`, `ArrowUp`) are their own
  code.
- **Modifiers are per-shortcut, not per-platform.** Some maps are
  `allControlKey: ['Ctrl']` (Ctrl on Mac too), others are Ctrl-on-Windows /
  `mControlKey: ['Meta']` on Mac. There is no single rule that rewrites a
  written "Ctrl" correctly for both, so send what the text says.

**Why:** it is not obvious that a page-generated event drives real app
shortcuts, and the natural assumption (that it needs genuine OS foreground
focus, like Monaco) is wrong here — which would have ruled out a working
feature.

**How to apply:** to drive a shortcut from an injected expression or a tool,
dispatch at `document` with `key` + `code` + the modifier flags. If nothing
happens, check whether that shortcut is a main-process menu accelerator before
debugging the event.
