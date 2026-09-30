---
name: mcp-interlock-reads-the-control
description: "The destructive interlock reads the CONTROL a press lands on, in every language the app shows -- English regexes on the caller's words let every Khmer Delete through"
metadata: 
  node_type: memory
  type: project
  originSessionId: c95a672a-48b7-47e0-a94d-10946a3ee48d
  modified: 2026-09-14T17:32:03.356Z
---

Until 2026-09-14 the MCP firewall's *point, don't press* rule was twelve
English regexes read against the words a call carried (`owa_click`'s `find`).
Measured that day, three ways past it:

- **Khmer.** All 41 destructive labels in the app's `tran()` dictionary have
  Khmer translations and the regexes caught none — while `owa_list_ui`,
  `owa_list_screens` and the manual hand the model the words AS DISPLAYED.
- **Folded spacing.** The matcher collapses whitespace; the regexes did not.
  `Clear All` with a no-break space pressed Clear All [F6].
- **The walkthrough.** `owa_guide_step {action: "do"}` pressed a step's `find`
  or `press` with no words read at all, and `press: "F6"` is Clear All.

**Why:** the rule has to judge what the element IS, not how it was named.

**How to apply:**

- The rule is written once, in `tools/owa-devtools-mcp/destructiveLabel.mjs`
  (no imports): the English patterns plus every translation of a
  destructively-worded dictionary key (`genDestructiveLabelRule`), so a new
  label is refused in Khmer the day its translation lands. The firewall caches
  the derived rule for a minute (`getDestructiveLabelRule`).
- It is read twice, the split `webUrlPolicy.mjs` makes: by the firewall on the
  call's words (cheap, logged), and IN THE PAGE on the resolved element
  (`PRESS_GUARD_SOURCE` ships the module's own functions as source text — keep
  them self-contained). The page half covers `owa_click`, `owa_type` (a
  picker's CHOSEN option) and the walkthrough's Do it, the card's own button
  and a tool `do` alike.
- A key is as destructive as the control whose title names it: `Clear All [F6]`
  refuses F6, `Clear Bible [F9]` leaves F9 alone.
- Anything inside the confirm / alert / input popups (`.modal-container--blocking`)
  is the user's to answer — refused as `question-press`.
- A translation the dictionary ALSO uses for an allowed control stays
  pressable: Khmer `លុបព្រះគម្ពីរ` is both Clear Bible and Delete Bible. The
  app's own confirm stands behind the destructive reading.
- The text of a NON-control (a slide card, a list row) is never read — a hymn
  saying "erase my sin" must not make its own card unpressable.
- `probe-mcp.mjs` proves the page half live on three injected probe buttons
  with a click counter. Never aim a regression check at a real Clear button: a
  screen may be holding a slide.

Related: [[mcp-uid-interlock]], [[knowledge-label-i18n-templates]], [[guide-press-safety-and-covers]].
