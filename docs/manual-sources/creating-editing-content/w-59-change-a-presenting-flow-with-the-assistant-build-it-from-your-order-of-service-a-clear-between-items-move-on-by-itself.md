---
id: W-59
title: "Change a presenting flow with the assistant (build it from your order of service, a clear between items, move on by itself)"
section: "Creating & editing content"
verify: [PL-109, CB-168]
screenshots: 2
generatedFrom: user-workflows.md
workflowsVersion: "2026-11-11"
---
# W-59 — Change a presenting flow with the assistant (build it from your order of service, a clear between items, move on by itself)

**Goal:** have the help window change one of your presenting flows (the running order of a
service, W-22) for you — build it from your order of service, typed or photographed, check
it, put a clear between items, make the songs move on by themselves, and add, move, copy,
park, colour, pin or arm its lines, countdowns and CC elements.

1. In **[en:tran:Presenting Flows]**, right-click a presenting flow's NAME row (its own row
   with its name on it, not one of its lines), or click the faint **⋮** at its right-hand
   end, and choose **[en:tran:Open in Chatbot]**, right under **[en:tran:Open Preview]**. 📸
2. The help window opens a chat of its own with the presenting flow attached under the box,
   and a card that says what it can change, with four buttons. 📸
3. Press a button under the card, or type what you want:
   - **Check the running order** reads every line and says what is wrong or missing — a song
     whose file was renamed or deleted, a **[en:tran:Jump to]** with nowhere to go, a
     **[en:tran:Keyboard Event]** with no shortcut — and offers the fixes. It changes
     nothing until you say.
   - **Build it from my order of service**: paste your order of service into the box, or
     attach a picture of the printed bulletin (**[en:tran:Attach a file]** in the **⋮** at
     the left of the box), or both, and the assistant
     adds every item in order — songs and slide documents by their names in
     **[en:tran:Documents]**, Bible passages, a countdown or a notice where the order says
     one. It says which items had no document to match; it never makes up a song.
   - **Clear the screen between items** puts a **[en:tran:Clear All]** after every song,
     slide document and passage that has none after it.
   - **Move on by itself** asks how many seconds a slide stays, then gives every song and
     slide document a **[en:tran:Next: Timeout]** that rides along with it (a CC element,
     W-22d), so its slides go on by themselves — one timeout line shared by all of them; a
     song that already moves on by itself has its time changed rather than a second one
     added.
   - Or type it: _Add a 5 minute countdown at the top_, _Make line 2's timeout 10 seconds_,
     _Pin line 3 to screen 1_, _Colour the songs blue_, _Park the sermon_, _Move the
     offering after the second song_, _Add Psalm 23 after line 4_, _Remove the last line_.
   - _list me more options_ shows the card and its buttons again.
4. The answer says what changed. A presenting flow has no Save: the change is **kept at
   once**, and the panel shows it. **[en:tran:Undo this change]** under the answer puts the
   whole change back, and **[en:tran:Show it in the list]** finds its row in
   **[en:tran:Presenting Flows]**.

**Not there?** **[en:tran:Open in Chatbot]** is in a presenting flow's menu only while AI is
on (**[en:tran:Settings]** → **[en:tran:AI Providers]** → _Enable AI features_). When no
assistant can answer, the chat says so and offers **Open AI settings**. A video, a picture,
a camera, another screen or a web page on the **[en:tran:Foreground]** is picked in its
panel and dragged in (W-22) — the assistant does not add those from words.

::: details 🤖 Robot-verified — coverage traceability
This page maps 1:1 to a workflow the QA robot drives live. It proves these `coverage-matrix.md` rows:

`PL-109` · `CB-168`

Regenerated from `user-workflows.md` (workflowsVersion 2026-11-11).
:::
