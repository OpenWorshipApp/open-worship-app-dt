---
name: keyboard-layer-stack-leak
description: "An unbalanced widget `open` used to leave a layer on KeyboardEventListener._layers and kill EVERY app shortcut for the session; addLayer re-asserts now, and a second context menu replaces the first"
metadata:
  node_type: memory
  type: project
  originSessionId: b235b5dc-e5b5-4b4c-8e7b-9404b6966677
  modified: 2026-09-28T23:55:20.653Z
---

`KeyboardEventListener` dispatches a key as `<topLayer>>Ctrl+B` and there is **no
fall-through**: whoever is on top of `_layers` owns every key. `addLayer` used to
`push` blind while `removeLayer` takes ONE occurrence off, so any `open` that no
`close` answered left a layer nobody owned — and from that moment `Ctrl+B`,
`F5`–`F10`, the slide arrows and `Ctrl+Shift+P` were all dead for the rest of the
session, with nothing left to release it. A restart was the only cure.

Measured live on 2026-09-28 on the user's own dev app:
`['root', 'context-menu', 'context-menu', 'context-menu']`, reported as "next
slide by keyboard occasionally not working" **and** "Ctrl+B also stopped working"
— two symptoms, one cause.

**Why it leaked:** a context menu's items are often built asynchronously
(`AppDocument.showContextMenu` awaits the clipboard and the copied slides), so a
second right-click reaches `showAppContextMenu` before the first menu — and
therefore its full-window backdrop, the thing that normally swallows the second
press — exists. Reproduced exactly: two quick right-clicks on the slides
previewer's empty area leaked one layer, three leaked two.

**How to apply:** three rules now hold it, and anything new that claims a layer
must keep them.
- `addLayer` RE-ASSERTS rather than stacks (`src/event/KeyboardEventListener.ts`):
  a widget is either up or not, so a duplicate `open` moves it to the top and one
  `close` is enough. There is no legitimate "two context menus".
- `showAppContextMenu` closes whatever is open first, through
  `contextControl.closeCurrent` — which also unhooks the replaced menu's Escape
  listener and resolves its promise.
- `useAppContextMenuData` fires a `close` on UNMOUNT, so a host that goes away
  with a menu open (a route change inside the window, a dev HMR update) takes its
  layer with it.

**Reading the stack live** (nothing exposes it): pull `KeyboardEventListener` out
of `document.onkeydown`'s closure over raw CDP —
`Runtime.getProperties` on the function → `[[Scopes]]` → the scope holding it →
`Runtime.callFunctionOn` returning `this._layers`. An `import()` of the module
hands back a DIFFERENT instance with an empty stack (see
[[dev-hmr-stale-state-qa]]), which reads as false evidence.

**A modal or popup now CLAIMS a layer, and its own keys have to go with it**
(2026-09-28). `'bible-lookup'`, `'slide-edit'` and `'setting'` were declared in
`AppWidgetType` and **never fired by anything** — `git log -S` says never, in
the whole history — so every `root` shortcut stayed live UNDER an open modal:
measured, `F6` pressed with the Bible Lookup open cleared a live screen, and
the slide arrows stepped the projector from behind it. `ModalComp` claims
`'bible-lookup'` and `PrimitiveModalComp` (confirm / alert / input) claims a
new `'popup'`, both through `useKeyboardLayerClaim` in
`src/event/keyboardLayerHelpers.ts`, which REFCOUNTS per layer — the lookup's
Info popup is a modal inside a modal, so the inner one closing must not hand
the keyboard back.

The claiming subtree's OWN keys are the hard half, and there are two rules:
- **Inside the wrapper**: `KeyboardLayerContext` (exported from
  `KeyboardEventListener`) carries the layer down. Read during RENDER, parent
  first, which is what makes it work where the stack cannot — the claim goes up
  in an EFFECT, and effects run child-first, so a child reading the stack at
  mount pins `root` and goes dead the instant the layer rises. That is the same
  trap `miniScreenOverlayControlComps` documents.
- **The component that RENDERS the wrapper** sits ABOVE its own provider, so
  context does not reach it: `ConfirmPopupComp`, `AlertPopupComp`,
  `InputPopupComp` and `BibleInfoPopupComp` pass the layer to
  `useKeyboardRegistering` by hand. Miss this and the popup's own Escape is
  silenced by the popup itself — which is exactly what happened first.

Related: [[slide-arrows-need-panel-focus]], [[synthetic-keys-drive-app-shortcuts]].
