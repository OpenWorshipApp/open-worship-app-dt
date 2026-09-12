---
name: chatbot-walkthrough-follows-first-search
description: The chatbot's walkthrough buttons used to walk the model's FIRST search hit forever; they now follow the page it opened, and a ghost recipe id can pass a shape check while having no page
metadata:
  type: project
---

**The two buttons under a model-written answer start a guide with args decided
before the model was asked anything.** `runBotAction` (`helpBotHelpers.ts`) calls
`owa_guide_start` with `action.args` FIRST and only then, if `isNeedingModel`,
asks the model. So whatever recipe id is on those buttons is pressed, not
reviewed — which is why the id has to be right at the moment the answer is
built, and why a bad one is a walkthrough of the wrong task rather than a bad
suggestion.

It came from the first manual hit of the model's FIRST `owa_help_search`, latched
with a `=== null` guard so nothing could revise it: not a refined query, not the
page it actually opened with `owa_help_page`, not it answering from
`owa_list_screens` instead. Reported 2026-09-01: the presenter's own starter chip
"Is any screen showing right now?" was answered correctly about the mini screen
and then walked through eight steps of the keyboard screencast.

`applyToolWatch` / `toWatchedManualId` (`llmBotHelpers.ts`, pure and exported so
the rule is testable without a live MCP host) now rank the signals: a page the
model OPENED beats every search (last one wins), a later search overwrites an
earlier one, and once the model has started its own card no button is offered at
all.

**Separately: a recipe id can pass a shape check and have no page.**
`questions.test.mjs` asserted it "points every recipe at a real manual id" while
only matching `/^W-\d{2}[a-z]?$/`. `W-01b` passed that for months —
`docs/scripts/build-manual.mjs` matched `W-\d+` only, so the `### W-01b` heading
was not read as a heading and the whole recipe was folded into **W-01's** page,
taking W-01's own `verify` rows with it. Four supported questions named a
document that did not exist. The generator now throws on a `### W-` heading it
cannot parse, and a second test reads ids off `docs/manual-sources/**`. Any test
whose name claims a thing exists must go and look.

Related: [[help-search-prefix-overmatch]], [[question-corpus-maintenance]],
[[guide-stuck-step-rescue]], [[chatbot-answer-options]].
