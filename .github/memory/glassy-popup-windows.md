---
name: glassy-popup-windows
description: "The chatbot popup is frosted by the OS (`appGlassy` -> backgroundMaterial/vibrancy), not by CSS -- and DWM's blur never shows up in a BitBlt screenshot"
metadata:
  type: project
---

A popup is its own OS window, so `backdrop-filter` inside it has nothing of the
app to blur. The frosted look comes from the compositor instead:
`appGlassy: true` in `openChatbotPage` (`src/helper/domHelpers.ts`) →
`genGlassOptions` in `electron/electronHelpers.ts` → `backgroundMaterial:
'acrylic'` on Windows, `vibrancy: 'under-window'` on macOS, with
`backgroundColor: '#00000000'` so the backdrop can show through. It costs the
app no frames, which is why it was the only acceptable way to do it here.

- **Opt-in, and capability-gated.** `isGlassCapable` (macOS, or Windows build
  ≥ 22621) decides; anywhere else the popup keeps `getAppThemeBackgroundColor()`
  and stays opaque. `appProvider.systemUtils.isGlassCapable` is the renderer's
  copy of the same answer and is what puts `data-glassy` on `.chatbot-app`. The
  two MUST agree: a translucent stylesheet over a window the OS did not frost is
  unreadable text on the desktop.
- **One tinted ground, films above it.** Under `[data-glassy]` the sheet gives
  `--chat-ink` the alpha and turns `--chat-panel`/`--chat-panel-soft` into
  low-alpha white films. Two translucent slabs stacked add up to an opaque one.
  `--chat-solid`/`--chat-solid-soft` are the opaque twins kept for the surfaces
  that cannot be see-through: `select.chat-engine` (Chromium paints the OS list
  from its computed background) and `.chat-menu`.
- **A desktop screenshot will not show the blur.** `CopyFromScreen`/BitBlt (and
  anything built on it — PrintScreen, `ffmpeg -f gdigrab`) captures window
  content *without* DWM's backdrop, so the app behind comes out razor-sharp
  through the glass and it looks like the material was never applied. It was:
  the tell is the **title bar** going translucent too, since `backgroundMaterial`
  covers the non-client area and plain transparency does not. Check
  `HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`
  `EnableTransparency` — 0 there means Windows really is drawing it solid.

The guide card ([[dom-match-memoised-in-page]]) is the opposite case: it is
drawn INSIDE the app window, so there it is a real CSS `backdrop-filter` with an
`@supports not` fallback to an opaque tint.
