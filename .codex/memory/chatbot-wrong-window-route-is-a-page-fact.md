---
name: chatbot-wrong-window-route-is-a-page-fact
description: The way OUT of a window is a fact about that window the model cannot read off the manual - the Reader has no Documents list and no Presenter tab (its route is the Go Back to Presenter button); a prompt rule the model ignored 3 of 4 became a one-shot code nudge (checkIsStepsWithoutPage)
metadata: 
  node_type: memory
  type: project
  originSessionId: 700f73b0-e031-4840-a03d-7e1ed1cdee31
  modified: 2026-09-09T21:56:06.595Z
---

Measured 2026-09-09 on the standing corpus, *How do I edit a slide?* asked
from the Bible Reader on Claude Sonnet 5: the steps were written off the
search excerpt (no `owa_help_page`) 3 runs in 4, and every one started
*"In the **Documents** list"* — the Reader page is `BibleReaderComp` and
nothing else. The two answers earlier graded as passing had sent the user
to *"the Presenter tab at the top"*, which the Reader does not have either:
its route back is the 🖥️ **Go Back to Presenter** button
(`QuitCurrentPageComp`, top right). The Document Editor DOES have a Presenter
tab, so the route differs per page.

**Why:** a manual written for the Presenter cannot tell the model which
panels another page lacks or how that page gets back; and a rule the model
ignores twice ("open the page BEFORE you write any step", in the prompt and
on the top hit) is not a rule.

**How to apply:**
- The fact lives in the prompt per page (`notHereText` / `backToPresenterText`
  in `genSystemPrompt`): the non-Presenter main-window pages have none of the
  Presenter's panels, and step 1 names the real control for THAT page. Grade a
  wrong-window answer's first step against the real control, not its intent.
- `checkIsStepsWithoutPage` (`llmBotHelpers.ts`) hands a numbered list written
  after a manual search with no page opened back to the model ONCE, in both
  provider loops, never on the last round. Keep it even when the prompt fact
  makes it fire rarely — the next shape that ignores the rule will not announce
  itself. Related: [[chatbot-recipe-id-scrub]] (the same "in code, not in the
  prompt" lesson), [[help-search-known-question]].
- A follow-up in the same tab that costs twice the median rounds usually means
  the page it needs does not EXIST (q12 → W-43 Move to Trash); check the
  manual before the prompt or the ranking.
