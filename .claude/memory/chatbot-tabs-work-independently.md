---
name: chatbot-tabs-work-independently
description: "Chatbot tabs are busy one by one (busy set of tab ids, progress per tab, Stop per tab) and three points of colour say any tab is working"
metadata:
  node_type: memory
  type: project
  originSessionId: 029805b0-9f47-4d9c-b38b-fed0e2ab561c
  modified: 2026-10-09T18:06:24.328Z
---

Asked for 2026-10-09 while a slow local model (LM Studio on CPU, ~12 prompt
tokens/s — about 8 minutes for ONE round of the ~5.5k-token tool prompt)
held a question: Stop, the progress lines and "Add anything else" sat over
EVERY tab, so nothing could be asked anywhere until it came back.

- **Busy is per tab**: `busySessionIds` in `ChatbotAppComp.tsx`, rebuilt by
  `syncBusy()` from the pending asks' `sessionId` plus `busyHoldListRef`
  (the unstoppable song write). `isBusy` is the tab in front's.
  `settleSession(id)` ends an ask: re-syncs, clears that tab's progress only
  when nothing else of its own is pending. Stop/Escape cancel the tab in
  front only.
- **Progress per tab**: `progressHelpers` holds a `Map<sessionId, state>`
  (entry deleted when cleared); `genSessionProgress(id)` is the `onProgress`
  an ask reports through; `RenderChatProgressComp` takes the tab's id.
- **Three indicators while any tab works** (user's picture): a steady dot
  after the busy tab's name (`busyIds` prop on `RenderSessionTabsComp`), a
  `🟠 ` title prefix (an OS title carries colour only as an emoji), and an
  amber point on the 🤖 (`useIsChatbotBusy`, relayed by main).
- **Never `sendDataSync` from a component that mounts in every window.** The
  first version asked main for the busy state synchronously; a dev renderer
  hot-reloaded ahead of its main process had no handler and EVERY window with
  a 🤖 froze (CDP screenshots hung). It asks with `sendData` and main replies
  on the relay channel to that window alone.
- Every main-process edit restarts a nodemon-run dev app (`electron:dev`);
  the user's windows close each time.
Related: [[custom-llm-servers]], [[chatbot-stop-answer]],
[[chatbot-progress-log]], [[infinite-paint-animation-at-rest]].
