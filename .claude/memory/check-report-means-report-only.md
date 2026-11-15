---
name: check-report-means-report-only
description: "\"check <report>\" asks for a verdict per finding and a recommendation -- change nothing until the user picks items"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 869d1cd2-029a-4f81-922e-44bdd476ec85
  modified: 2026-11-15T20:45:41.443Z
---

Asked to "check test-results/robot-test/report-20261115-1635.md" (2026-11-15), the
session verified the findings AND wrote, tested and live-verified fixes for two of them.
The user: _I didn't tell to fix, just report and let me decide_. The edits were reverted
(kept as a patch); the user then asked for a recommendation and picked from it.

**Why:** the user decides what gets fixed. A fix nobody asked for costs a revert -- here
also two hot-reload crashes of the Presenter in the shared dev app, each needing a reload.

**How to apply:** for "check / look at / review" a report or a finding, answer with a
verdict per finding (real, by design, or contradicted by the code, with `file:line`) and,
when useful, a ranked recommendation -- then stop. Edit only after the user names the
items. Same spirit as [[robot-test-stays-in-the-asked-scope]] and owa-enhance's
"report, then wait for apply". Accepted non-bugs go in [[qa-intentional-not-bugs]].
