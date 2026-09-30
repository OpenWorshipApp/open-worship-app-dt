---
name: chatbot-verse-by-reference
description: "\"Put John 3:16 on the screen\" is one tool call now (owa_present_bible, the app's own parser + the lookup's present path); the recipe demo under the old answer died at step 2 because the Bible Lookup is a picker no step can drive; a needle with its [shortcut] is press-safe"
metadata: 
  node_type: memory
  type: project
  originSessionId: 192b39ca-6a32-4590-acbb-f3ec67a9aeba
  modified: 2026-09-10T14:42:12.921Z
---

**The Bible Lookup cannot be driven by steps, so a verse is presented by
its REFERENCE.** `owa_present_bible` (2026-09-10) takes "John 3:16" as the
user said it, resolves it with `BibleItem.fromTitleText` (the lookup box's
own parser) in the version the lookup is on, then any installed one that
reads it, presents through `ScreenBibleManager.handleBibleItemSelecting`
with a null event (the ticked screens, exactly like the lookup's **Show
bible item**; nothing saved to the Bibles list) and reads the screens back.
`/verse John 3:16` and the offline bot (`VERSE_ASK_PATTERN`, check first,
ONE button) use the same door. `applyToolWatch` marks a presented result
`isActedOn` so no W-06 walkthrough is offered under an answer that did it.

**Why:** measured twice (2026-09-09, 2026-09-10): the answer was W-06's
steps and **Do it for me** pressed **Bible Lookup**, then stopped on step 2
with `find: ""`, `press: "Tab"` and the verse nowhere — the picker's labels
along the way are the book's own name and bare numbers. `runBotAction`
judged the demo "good enough" because `canDemo` is true when ANY step is
pressable (`EC-148`, still open for every other recipe that types).

**How to apply:**
- A new ask that the model can only DESCRIBE because the app's UI is a
  multi-step picker wants an app-side action over the `owa-agent-*` relay,
  not a smarter card. Verify through the app's OWN host (`mcpUrl`), and
  note the `dev` script has NO watcher on `tools/` — only `electron:dev`
  does; with an orphaned app holding the single-instance lock, close its
  main window over CDP (`window.close()`), then touch a file under
  `tools/owa-devtools-mcp/` so nodemon relaunches. `taskkill` is refused.
- `owa_click` by a title WITH its shortcut (`Clear Bible [F9]`, the words
  `owa_list_screens` hands back) is press-safe since `EC-135`:
  `checkIsNamedNearly` strips the bracket off both sides.
- The version that goes up is whatever the lookup is on (Amplified on the
  dev machine while every saved item was KJV) — `EC-149`; the answer names
  it, so say it back.

Related: [[chatbot-in-the-middle-of]], [[click-reports-effect-not-action]],
[[mcp-tool-edit-two-processes]].
