---
name: chatbot-cdp-driver-gotchas
description: "Driving the chatbot window over CDP from Git Bash - a /command argument is rewritten to C:/Program Files/Git/..., at 12 tabs New chat silently does nothing so every ask lands in the last tab with its history, and a provider picked in the head row becomes the window DEFAULT"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 20009620-23d6-4172-90ec-96d382b1023a
  modified: 2026-09-10T17:33:25.288Z
---

Two traps when a script asks questions through the real chatbot window
(`scratchpad/ask.mjs` pattern: CDP `Runtime.evaluate` on the React-controlled
textarea, `Network.enable` to count model rounds and `tools/call` posts):

- **Git Bash rewrites a leading-slash argument.** `--q="/screen"` reaches
  node as `C:/Program Files/Git/screen` (MSYS path conversion). Set
  `MSYS_NO_PATHCONV=1` (or run from PowerShell). Three paid Claude calls
  answered "that looks like a file path" before this was noticed.
- **The window caps tabs at 12 and New chat then does nothing.** A driver that
  opens a tab per question silently starts asking in the LAST tab, with its
  history, from question 12 on — which changes the answers being graded.
  Close the tabs first (`button.chat-tab-close`, one click per React render,
  with a wait between) and read a message's author from its **Ask again**
  button's title (`Put this question back in the box`), not from its text —
  the offline where-is answer itself contains the words "Ask again".
- **Picking a provider in the head row rewrites the window's DEFAULT.** The
  `change` event the driver fires on the ASSISTANT / MODEL selects goes
  through `handleProviderChanging` / `handleModelChanging`, which also store
  what a NEW tab starts on (`chatbot-llm-provider`, `chatbot-llm-model-*`).
  Seen 2026-09-10: one `--provider=Free --model=nemotron` ask to grade the free
  tier left the user's window opening on Free, and the run's next question
  went there unasked (and hallucinated a cost). Put the default back before
  the last ask (`--provider=Claude --model=claude-sonnet-5` on a throwaway
  `/commands`) and read the provider on every answer's head row.

**Why:** both silently produce wrong measurements rather than errors.

**How to apply:** any live corpus run — `/owa-enhance-chatbot` research —
sets the env var and clears the tab strip before the first question.
Related: [[chatbot-builtin-commands]].

**Three more, from the auto-hide work (2026-09-10):**

- **With a packaged app up beside `npm run dev`, every `owa-devtools` tool
  drives the PACKAGED one** (discovery is newest-first), so a change that
  landed by HMR in the dev window is invisible to them. Drive the dev
  instance by its own port: `GET http://127.0.0.1:<port>/json` (the port is
  in `<temp>/open-worship-app-cdp/<pid>.json` for the `isDev: true` entry)
  and open the page's `webSocketDebuggerUrl` with Node's global `WebSocket`
  — and call `process.exit(0)` at the end, or the open socket keeps the
  script alive past the harness timeout.
- **A chatbot window the OS is not showing (minimised, or covered — Windows
  reports it `document.visibilityState === 'hidden'`) hands
  `Page.captureScreenshot` a STALE frame**, and its transitions and timers
  stall: a screenshot "of the tucked state" showed the rows still there
  while the class and the rects said otherwise. `Page.bringToFront`,
  `Page.setWebLifecycleState active` and `Browser.setWindowBounds` did not
  wake it. Verify such a window by CLASS and by `getBoundingClientRect`, and
  wait ~1 s after a scroll for the throttled frame that dispatches the
  `scroll` event; take the pictures once the window is in front.
- **`Input.dispatchMouseEvent mouseWheel` does not scroll that window**
  either; assign `scrollTop` — the same `scroll` event reaches every handler.

**Three more, from the /lyric run (2026-09-10):**

- **The 12-tab cap bit again.** A driver that clicks New chat per question
  gets a silent no-op from the 12th tab on, and every later ask lands in the
  LAST tab with its history — the run's re-asks and song-link asks were
  measured that way before it was noticed (a `tabCount` of 12 in the answer
  record is the tell). Close tabs from the END down to one (the FIRST tab is
  the user's own conversation) before the corpus, and again before a second
  batch.
- **A locked desktop is an intensively-throttled page.** With Windows'
  LogonUI up, every app window reports `document.visibilityState ===
  'hidden'` and, after five minutes, Chromium fires in-page timers about
  once a MINUTE: three ordinary rounds read 95 s, and an evaluate that
  awaits an in-page `setTimeout(600)` hangs past the harness timeout. Time
  columns measured while locked are not the chatbot's; wait node-side, and
  say in the row that the desktop was locked.
- **On macOS, another app in front stalls the app's renderers outright**
  (2026-09-12, `EC-180`). With Terminal frontmost over a partly visible
  app, a 50 ms `setTimeout` and a `requestAnimationFrame` were unsettled
  after 20 s in the presenter AND the chatbot window, while a synchronous
  `Runtime.evaluate` still answered and `visibilityState` still read
  `visible` — so the page looks alive. Every `owa_*` call then times out
  (`Timed out evaluating in …presenter.html`, `owa_guide_start` included),
  and a CDP-dispatched `owa-guide-running` never reached the main process
  while `require('electron').ipcRenderer.send` from the same page did.
  Bring the app to the front before a tool-driven or timed measurement. Read
  window state off the OS, not the page: `visibilityState` does not change
  for a minimised window either. `CGWindowListCopyWindowInfo` through
  `osascript -l JavaScript` needs no permission (`kCGWindowIsOnscreen` per
  window); System Events needs Accessibility and answers -1743.
- **A focus pick straight after New chat can fail to stick** — the Reader
  questions went out as Presenter (`owa_help_search focus:"presenter"`).
  Read the picker back after the change event and retry until it says what
  was asked.

**Three more, from the foreground-door run (2026-09-11):**

- **Under `npm run electron:dev` the app restarts on EVERY edit under
  `tools/owa-devtools-mcp/`** (nodemon watches it and `electron-build/`).
  The new module is served without the stale-host workaround, but the help
  window closes and an ask in flight is lost: batch the `tools/` edits, then
  verify. Read `owa_app_state.instances[0].pid` on every answer — the pid
  changed three times in one hour here, twice from a sibling session's
  rebuild.
- **The chatbot window's tabs come back after a restart** (they are
  persisted), so the 12-tab cap is reached by the SAVED tabs, not the ones
  this run opened. Close down to one before the first ask of every batch.
- **A shape's "yes" can turn the user's only monitor into the projector.**
  *Put Blessed Assurance on the screen* → *Yes, put it up* pressed the show
  toggle, and with one display the screen window is that display. Read
  `owa_list_screens` straight after any acting follow-through and hide what
  the driver turned on before doing anything else.
