---
name: chatbot-spend-guard
description: "The chatbot pauses at a rolling-hour spending cap (default $1) or 150 model calls and stays paused until a person presses Allow more - a corpus driver trips the pace cap after ~5 runs, and a seeded ledger file needs a window reload"
metadata: 
  node_type: memory
  type: project
  originSessionId: 03b9255b-b300-4408-abb0-9f31679b7a58
  modified: 2026-09-10T19:50:53.746Z
---

Since 2026-09-10 (`src/chatbot/spendGuardHelpers.ts`, the user's own ask)
every model round the chatbot buys goes through a circuit breaker with a
latch: a rolling-hour ledger in `local-storage/chatbot-spend-ledger`, a money
cap the user sets (`chatbot-spend-limit`, default $1 an hour, `off` for
none) and a fixed pace cap of 150 model calls an hour. At either cap the
assistant answers from the offline guide under a pause note and refuses
every further round until **Allow more** is pressed (head row, the note, or
`/limit more`). Time passing and a restart do NOT lift it.

**Why:** a runaway is a bounded question asked again and again, and every
cap the loop had was per question. Only a budget over time with a
human-only reset bounds repetition.

**How to apply:**
- A research driver that asks the corpus is a runaway by this definition:
  five corpus runs in an hour is the pace cap. Lift it with `/limit more`
  typed in the box, the amber **Allow more** in the head row, or the
  scratchpad `spend-state.mjs allow`; or raise the cap (`/limit 20`) for the
  session and put it back (`/limit 1`) before the last ask.
- The ledger is read from disk ONCE and then held in memory: a driver that
  seeds `chatbot-spend-ledger` by hand must reload the chatbot window before
  the seed counts.
- A pause is `SpendLimitError`, never a provider fault: a run that sees the
  offline guide answering under *I have paused the assistant…* is measuring
  the guard, not the model. Related: [[chatbot-cdp-driver-gotchas]],
  [[chatbot-cost-measured-on-the-wire]].
