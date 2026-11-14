---
name: lint-gate-only-at-final-validation
description: "During an iterative improve-and-push loop, push without the full `npm run lint` gate; run the gate once at final validation"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 64c20cce-a53c-493c-b1f4-046abac8f766
  modified: 2026-11-12T15:20:50.544Z
---

While iterating (fix → batch → blind read → push, many pushes an hour), do NOT run the full `npm run lint` gate before each push; run it once at the FINAL validation, before calling the work done. Run the targeted tests of the files touched (vitest on those files, the language confinement test when a new string or regex has letters outside ASCII) before each push instead.

**Why:** 2026-11-12, the user during the Bible-note chatbot loop (BN-161..165), after each push had waited ~8 minutes on a gate whose only failures were another session's autosave: _skip the linting gate and run at the final validation only_. This narrows their earlier _make sure nothing broken before git pushing_ for that loop.

**How to apply:** pushes inside such a loop go after the touched files' own tests pass; the full gate (and its report of failures that are not ours) comes at the end. CLAUDE.md's "after any code change, run `npm run lint`" still holds for the final hand-off. Related: [[bible-note-chatbot]].

Since 2026-11-12 the user throws this switch with `/owa-lt` (`.claude/skills/owa-lt`), which runs the gate's own stages on the files this session touched (`scripts/lint-touched.mjs`, seconds) instead of the targeted tests picked by hand; `/owa-gi <minutes>` commits and pushes on an interval behind that same check.
