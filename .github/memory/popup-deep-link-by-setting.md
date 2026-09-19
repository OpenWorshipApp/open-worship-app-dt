---
name: popup-deep-link-by-setting
description: "Deep-linking into a popup (Settings at one field) must ride a short-lived setting read on mount AND on window focus: a URL param opens a DUPLICATE window, and a plain getSetting misses the other window's write"
metadata: 
  node_type: memory
  type: project
  originSessionId: f8a52294-0cea-4c91-9a84-bcc7c5b3cee3
  modified: 2026-09-14T17:36:25.865Z
---

Popups open through `handlePopupWindowOpen` → `getPopupWindowData`
(`electron/electronHelpers.ts`): a window whose URL matches is FOCUSED
(restored if minimised) and the open is denied. So a query parameter meant to
point an open Settings window at one field makes a URL no open window has — it
opens a SECOND Settings window, and the one already open never hears of it.

What works (2026-09-14, `src/helper/ai/aiKeyFocusHelpers.ts` — picking a
provider with no key in the help window opens Settings with the cursor in that
provider's key box): write a one-shot setting (`setting-ai-key-focus`, JSON
with `requestedAt`, ignored after 30 s) BEFORE `openPopupWindow`; the target
reads it on MOUNT (a new window) and on `window` `focus` (an open one the dedupe
raised). Read with `getSettingForce`, never `getSetting`: `appLocalStorage`
caches values AND absence per renderer for 10 s, so another window's write is
invisible to a plain read. The component that owns the target TAKES (removes)
the request; a parent that only picks the tab looks without taking.

Verified live on the dev app: a new Settings window had the cursor in the Kimi
box ~0.9 s after the pick; with Settings open on General and the help window in
front, the SAME window came forward, switched to Others and focused the box in
~0.2 s, with no second Settings window.

Driving it over CDP: a `Runtime.evaluate` pick moves no OS focus, so bring the
picking window forward first (`Page.bringToFront`). A Settings window that
still has focus gets no `focus` event from the raise, and the already-open path
looks broken when it is not.

**Why:** the URL parameter silently opens duplicates and the cached read
silently misses the request — both look like the feature not working.

**How to apply:** any "open window X at thing Y" asked from another window.
Related: [[chatbot-provider-issue-door]], [[glassy-popup-windows]],
[[app-window-tools-everywhere]].
