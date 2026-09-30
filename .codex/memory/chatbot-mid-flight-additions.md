---
name: chatbot-mid-flight-additions
description: The chatbot ask box stays live while an answer comes; an addition is drained only where the next model round is guaranteed, and a Stop gives every typed word back
metadata:
  type: project
---

The chatbot's box is no longer `disabled={isBusy}`. While an answer is coming,
**Add** appears beside **Stop** once there are words in it, and what is typed is
folded into the answer already being written. Added 2026-09-02.

**Why:** a question asked with a detail missing had to be STOPPED and asked
again — paying twice and throwing away every round already bought on the user's
own key.

**How to apply:**

- **Drain only where the next model call is guaranteed.** `askLlmBot` takes a
  `takeAdditions` pull callback, and the loop drains it AFTER pushing the tool
  results — a point reachable only when the model called a tool, which it can
  only do while tools are still being sent. Draining near the early return would
  silently swallow what the user typed.
- **That is also why the return shape did not change.** An item handed over IS
  the proof it was folded; whatever is still queued when the promise settles is
  the leftover, asked as its own question with a note saying why.
- **Anthropic's ordering is part of the message shape.** In a user message
  carrying tool results, `tool_result` blocks come FIRST and any text AFTER
  them — the addition is a trailing text block inside that same message. A
  second consecutive `user` message is MERGED rather than refused, which is
  worse than an error because it looks right. (The old comment claiming
  Anthropic "rejects" consecutive user turns is stale.)
- **The queue lives on the pending ask, not in the loop**, so a call that dies
  mid-round can hand it back: `handleCancelling` puts everything — taken and
  untaken alike — into the draft. Nothing a volunteer typed is ever dropped.
- **Route off `pendingAskListRef`, never off `isBusy`** — in that closure
  `isBusy` is the stale value `isForced` exists for. And never send an addition
  to a walkthrough rescue: its answer is one line drawn on a card in another
  window, where the user would never see their own aside.

Related: [[chatbot-attachments]], [[chatbot-stop-answer]].
