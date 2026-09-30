---
name: chatbot-stop-answer
description: The chatbot's Stop button aborts the request on the wire, says so at the press, and must never fall through to the offline bot
metadata:
  type: project
---

An answer on its way in the chatbot window can be STOPPED — the **Ask** button
becomes **Stop** while it is coming, and Escape does the same (ignored while
the caret is in a field, because renaming a tab is also Escape). One
`AbortSignal` per ask (`src/chatbot/cancelHelpers.ts`) runs through `askLlmBot`
into BOTH providers' request options and into every `callTool` fetch, and each
round of the tool loop checks it before buying another one.

**Why:** the loop is up to ten model rounds and the user is paying for every
one of them; a window that can only be waited out is not one a volunteer
trusts three minutes before a service. Four things were learned building it:

- **Aborting has to reach the SDK request option** (`create(params, {signal})`)
  and the `fetch`, or the call keeps running and keeps being billed while the
  window merely stops listening. The proof is in the network log:
  `POST /v1/chat/completions` → `net::ERR_ABORTED` on the round in flight.
- **A stop is not a failure.** `describeLlmError` reads an aborted request as
  an unreachable service, so an unguarded stop tells a volunteer their
  building's internet is down. It must also NOT fall through to the offline
  manual bot, which would answer a question the user just called off.
- **The transcript says "Stopped" AT THE PRESS**, not when the dropped call
  gets round to rejecting — the offline bot and the tool host finish whatever
  they were doing regardless, and a Stop that leaves the spinner up for two
  more seconds is not believed.
- **The busy flag is the pending list's length**, not a flat `false`: two asks
  overlap whenever a stuck guide card asks while the user's own question runs
  (see [[guide-stuck-step-rescue]]), and the first one home used to take the
  other's spinner down with it. Each pending ask remembers its own tab, so the
  "Stopped" line lands in the conversation that asked.

What it deliberately does not do is undo a tool that already clicked
something. Stopping is about the waiting.

**How to apply:** thread the signal, never a boolean flag, into anything new
the window waits on; classify with `checkIsCancelError(error, signal)` before
any error-describing code runs. See [[agent-access-mcp-chatbot]] and
[[chatbot-answer-options]]. Covered by `CB-23` and W-42 step 6.
