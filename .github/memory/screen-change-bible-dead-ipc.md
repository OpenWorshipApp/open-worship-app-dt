---
name: screen-change-bible-dead-ipc
description: Ctrl/Alt+Arrow verse-stepping on the screen output was dead — FIXED on refactor22, don't re-file it
metadata: 
  node_type: memory
  type: project
  originSessionId: c56a2c6e-966a-423b-8bff-4b856646eb12
  modified: 2026-07-29T00:00:00.000Z
---

**FIXED 2026-07-29 on `refactor22`** (uncommitted). `Ctrl/Alt+ArrowLeft/Right` on the
`screen.html` output window (matrix row `SC-03`) used to do nothing: the IPC round-trip fired
but `ipcRenderer.listenerCount('app:main:change-bible')` was **0** — nothing in `src/`
subscribed. The receiver now lives in `src/_screen/screenBibleSteppingHelpers.ts`, registered
from `ScreenManager.initReceiveScreenMessage()`. The payload also carries the `screenId` now
(it used to be a bare `isNext` boolean), so only the output whose window got the key steps.
The dead sibling pair `screen:app:ctrl-scrolling` / `app:main:ctrl-scrolling` was deleted.

**Why:** the stepping runs in the MAIN window, not the screen window — only the presenter
holds the authoritative screen managers. `MiniScreenComp` is the only non-screen caller of
`initReceiveScreenMessage`, so a bible presented from the **reader** still cannot be stepped;
that is a pre-existing architectural limit, not a regression.

**How to apply:** verify live, not by unit test — `electronEventListener.coverage.test.ts`
only asserts the main-process hop. Present a verse, `F5`, `select_page` the
`screen.html?screenId=N` target, `press_key Control+ArrowRight`, then read the new target out
of `<data-dir>/local-storage/screen-ft-manager`. Stepping keeps the verse-window size and
rolls over chapters via `getJumpingChapter`. Related: [[apply-settings-skips-popups]].
