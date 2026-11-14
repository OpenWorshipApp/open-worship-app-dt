---
name: chatbot-foreground-component-edit
description: "The chatbot sets up and changes any of the 13 foreground components the PANEL's way: owa_foreground writes a new session named after its content, owa_foreground_edit (foreground ask only) changes an attached session in place; a session is chat context, attached from its chip menu, the panel header robot or the attach row; every write backed up as an app-setting restore"
metadata:
  node_type: memory
  type: project
  originSessionId: ad0005c0-be4a-4a31-8708-bfbb6f90d376
  modified: 2026-11-09T21:21:59.524Z
---

2026-11-09, the user: _chatbot can help modify any foreground component_
(a 5-minute countdown, a top marquee, a quick text for a verse), then, the
strip `Default · Session 2 · +` circled: _sessions of opening foreground
component should be able to attached to the chatbot for the chat context_.
Chosen with the user: ANY chat gets the richer `owa_foreground` (token
ceiling raised 8 350 → 8 480); new content goes into a NEW session named
after it, never over what a person typed; an ATTACHED session is changed in
place; attach from all three places (chip menu, panel header 🤖, attach row).
Recipe W-61; rules in `agent-tools.md`, `chatbot-llm.md`,
`chatbot-files-report.md`.

**Why:** the old tool wrote the screen with `extraStyle: {}` and no session,
so an overlay ignored its panel's size, colour and place, and the panel never
showed it — two descriptions of one widget drifting apart.

**How to apply:**

- One model per widget key in `foregroundComponentRules.ts` (leaf):
  sessions target, Properties prefix, flags, own setting names. Change a
  panel's flags or setting names THERE, or the assistant styles it apart.
- Panels read settings once at mount; anything that writes a foreground
  setting from outside must `notifyForegroundPanel(key)`
  (`foregroundPanelRevisionHelpers.ts`), or the open panel shows stale values
  and writes them back.
- `checkIsSameContent` compares unset keys at the PANEL's defaults (a fresh
  Default countdown already reads 5:00) — without it a 5-minute ask made a
  needless `5:00` session.
- Live checks go through a scratch profile and a fresh stdio server
  ([[scratch-dev-instance-beside-user-app]]); the help window's side waits
  for the AI caution, a person's press.
- Related: [[chatbot-foreground-door]], [[foreground-effects-one-setting]],
  [[foreground-sync-shared-refs]], [[foreground-timer-state-in-datum]],
  [[agent-data-tools-backup-undo]].
