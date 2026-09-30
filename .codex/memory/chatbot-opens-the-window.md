---
name: chatbot-opens-the-window
description: A walkthrough of a window that is not up OPENS it; a tool's own error text may never reach a volunteer
metadata:
  type: project
---

Asking the chatbot for a walkthrough of a window nobody has opened used to end
in the tool's own words — *"That did not work: The app has no open page matching
`setting.html`. The open pages are: chatbot.html?uuid=chatbot, presenter.html."*
It now OPENS the window and starts the walkthrough in it.

**Why:** two hard-codings of the same shape, in two files, both sitting beside
`tools/owa-devtools-mcp/botFocus.mjs`, which declares all eight windows and how
each is reached. `PAGE_SWITCH_HINTS` (chatbot) and `dropStepsAlreadyDone`
(`guide.mjs`) each knew the presenter and the reader only, so the other six
windows fell through — to a raw error in one case, and to a card whose step 1
tells you to open the window you are looking at in the other. Neither is
findable by reading either file alone: each looks complete.

**How to apply:**

- Anything that asks "how does a user get to window X" reads the descriptor:
  `isMainWindow` (navigate with `owa_goto_page`, whose enum is DERIVED as
  `BOT_MAIN_WINDOW_PAGES` — it used to refuse the Document Editor its own system
  prompt promised), `openFind` (press that control; only Settings has one, since
  three windows need something selected first and one lives in the native menu
  bar), `howToOpen` (say it in words). Never write a second map beside it.
- `runBotAction` takes `canOpenPage`, false on the retry: one attempt to open,
  then the words. A window that refuses to appear must not become a loop.
- **A tool's error text may never reach the user.** `describeActionError` in
  `helpBotHelpers.ts` is the one place a failed button press is put into words,
  and the reason goes to `appError`. It replaced `That did not work:
  ${error.message}`, which was the generic path for EVERY failed press.
- Importing `loggerHelpers` into a `src/chatbot/*` module drags in `appProvider`,
  which touches `document` at module scope — a node-env suite dies before its
  first test. Mock it. See [[appprovider-mock-node-env]].

A recipe also says WHICH window it is about, and that beats the page a caller
passes: `detectRecipeWindow` reads the same opening step `dropStepsAlreadyDone`
throws away. Without it a Settings recipe ran in the Presenter and, because its
step names nine bold words and seven of them exist only in Settings, the ring
fell through to `English` — out of "Language: click **English**" — which is an
exact whole word of the Bible key button `KJV English KJV`. Three identical
rows matched. **A ring on the wrong control is usually a card in the wrong
window**: check the window before touching the matcher.

Related: [[agent-access-mcp-chatbot]], [[app-window-tools-everywhere]],
[[guide-stuck-step-rescue]], [[chatbot-walkthrough-follows-first-search]].
