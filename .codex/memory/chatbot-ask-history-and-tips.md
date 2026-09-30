---
name: chatbot-ask-history-and-tips
description: Alt+↑/↓ walks back through what the chat window has been asked (one list for the whole window, seeded from saved conversations), and a random 💡 line above the box names a feature nothing else announces
metadata:
  type: project
---

Added 2026-09-04 on branch `refactor32`, asked for from the app: *"chatbot, it
should remember asking history, when editing the alt+arrow-up/down should get
the text from history"*, then *"show this kind of tip somewhere to let user know
any features"* and *"showing tip randomly, maybe above the input text"*.

`src/chatbot/askHistoryHelpers.ts` + `tipHelpers.ts`, wired in
`ChatbotAppComp.tsx` (`handleRecalling`, `rememberAsking`, `RenderChatTipComp`).

**Why:** both are about the same user — a volunteer at a machine in a back room
minutes before a service. Retyping a question that was nearly right (wrong verse
reference, wrong screen number) is the most expensive part of using the window,
and the camera, the pointer, **Report**, the walkthrough cards and the recall
itself are all built and none of them announces itself, so a quarter of the
window goes unused.

**How to apply:**

- The history is ONE list for the whole window, not per tab: a second tab is
  opened precisely because the first went wrong, so the question wanted back is
  rarely in the tab it was typed in. Setting `chatbot-ask-history`, capped 30
  entries × 2000 chars × 20 000 total — `appLocalStorage` is a synchronous
  write. Nothing longer than 2000 chars is remembered AT ALL rather than
  remembered truncated: a recalled question silently missing its end would be
  asked as it stands.
- Seeded from the saved conversations on first load (`loadAskHistory(sessions)`)
  — the only way to discover Alt+↑ is to press it and get something back. Only
  `you` messages with NO `note`: a noted one is a walkthrough card's rescue
  (`DO: …`), machine instructions that must not go back to the model as the
  user's words.
- Only what came out of the BOX is recorded — the form's submit and
  `handleAdding`, never `handleAsking` itself, or the walk goes past three
  presses of *Yes* to reach the sentence worth keeping.
- Index -1 is the user's own half-written words, stashed on the way in and given
  back at the bottom of the walk. Typing resets to -1; so does switching tabs.
- **Alt**, not the bare arrows — those belong to the caret (the box is
  multi-line) and to the type-ahead list, per [[chatbot-answer-options]]'s
  neighbours. A recall also dismisses the suggestion list, which has nothing to
  add to a question already asked.
- The caret is moved to the END of the recalled text from inside the effect that
  already sizes the box, behind a ref flag — one subscription, and it must not
  fire on ordinary typing.
- The tip is RANDOM and never the same twice running (`chatbot-tip-shown` holds
  the last id); a press gives another and returns the caret to the box. Every
  tip must name something the window actually does — a tip for a feature that is
  not there is worse than none, because the reader is standing in front of the
  app looking for it.
- **The two chevrons beside it WALK the list** (`stepChatTip`, added 2026-09-04
  on the same branch, asked for as *"should `<-` and `->` for pre next tip"*).
  Random answers *"show me another"* and cannot answer either *"show me all of
  them"* — nothing tells you when you have seen the lot — or *"bring back the
  one I was half way through"*. Both behaviours are kept: the sentence is
  random, the arrows are ordered and wrap. Every path remembers what it showed
  (`rememberChatTip`); `genChatTip` stays pure so the choosing is testable with
  no setting store. `+ count` before the modulo is load-bearing — `%` keeps the
  sign in JS, so stepping back off the first tip indexes at -1.
- The arrows are drawn at half opacity, NOT revealed on hover. This whole line
  exists because a feature nobody announces is a feature nobody has; hiding its
  own controls until you already know they are there is the same mistake one
  level down. (Contrast [[hover-hidden-controls]], which is the app's own habit
  and a driving hazard.)

Documented in W-42 step 6, matrix row `CB-46`, questions `ask-again-earlier` and
`see-more-tips` in `questions/common.json`. See [[chatbot-attachments]],
[[chatbot-mid-flight-additions]], [[chatbot-report-button]],
[[chatbot-progress-log]].
