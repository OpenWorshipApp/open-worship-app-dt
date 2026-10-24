---
name: hidden-popup-not-shown-by-reopen
description: "FIXED 2026-10-20 — reopening a hidden (not minimized) popup now show()s it; diagnose window state with user32, not CDP"
metadata:
  node_type: memory
  type: project
  originSessionId: df0bef19-c3e9-4546-b80e-20bd5e94e8c8
  modified: 2026-10-20T19:58:11.844Z
---

FIXED 2026-10-20 (electron/electronHelpers.ts `handlePopupWindowOpen` +
editor-retarget path, tests in electronHelpers.coverage.test.ts). Found while
robot-testing the chatbot: an app popup can end up **hidden-not-minimized**
(`IsWindowVisible` false, `IsIconic` false, rect on-screen), and pressing its
opener (🤖 → `openChatbotPage`) did nothing visible because the dedupe loop
only `restore()`d minimised windows and `focus()`ed — a focus on a SW_HIDE
window shows nothing. Both reopen loops now `win.show()` when
`!win.isVisible()`.

**Why:** no `.hide()` exists in main — the hide came from an owned-window /
Windows interaction (Windows hides owned windows when the owner minimises; the
a70d83e8 `detachFromParentWhileMinimised` extension to Windows is the suspect
for leaving one stuck hidden). Root cause of the hide itself is NOT proven —
the fix repairs the symptom at every reopen.

**How to apply:** diagnose window state with a user32 EnumWindows script
(`visible/minimized/rect` per app OS window) — CDP cannot read window state
(no `Browser.getWindowForTarget`) and `Page.captureScreenshot` even times out
on such a hidden window. The test mock (`electron/testUtils.ts`
`createMockBrowserWindow`) gained `isVisible`, default `true`. Related:
[[fill-skips-react-state]], [[llm-tunnel-check-races-502]].
