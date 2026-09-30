---
name: selector-name-with-a-twin
description: a naming attribute is only a NAME if it names one thing; a twin among its siblings returned null and took every descendant with it
metadata: 
  node_type: memory
  type: project
  originSessionId: b6cce606-0f5c-4914-9eb7-7d885333454a
  modified: 2026-09-12T14:01:02.784Z
---

`selectorOf` in `tools/owa-devtools-mcp/domMatch.mjs` prefers a naming
attribute (`data-widget-name`, `data-tab-key`, `name`, `aria-label`,
`placeholder`, `title`) over `:nth-child`, because a name survives a
re-render and a position does not. Until 2026-09-12 it never asked whether
the name named **one** thing.

**Two same-named SIBLINGS are unrecoverable by walking up.** The Bible Reader
routinely shows two panes carrying `data-widget-name="Bible View"`, as
`nth-child(1)` and `nth-child(3)` of the same parent. Measured live, both
produced byte-identical candidate chains at all 8 steps, every one matching 2
elements — because every ancestor they share is *literally the same node*, so
every longer prefix still matches both. The index that separates them was
computed at step 0 and thrown away. `MAX_SELECTOR_DEPTH` was never the
problem; raising it would have changed nothing.

**The cost is never the named element.** One ambiguous ancestor makes every
descendant under it untraceable too — **156 of 949 elements** in a two-Bible
Reader had no selector (→ 12 after the fix, 0 mis-targeted).

The fix is a sibling twin-count: a named part with a twin keeps the name and
appends `:nth-child(n)`; a lone one is left clean, so ordinary selectors do
not start carrying a brittle index. Three tests in `domMatch.test.mjs` hold
it, including a control *inside* one of two same-named panes.

**What it looked like from the outside:** the chip for a control the user had
POINTED AT, in the chatbot ask row, answering *"There is nothing left to show
for that one."* — a sentence true of the code and false of the window. When a
pick, a ring or a `SHOWS:` chip cannot find something that is plainly on
screen, suspect an ambiguous name before suspecting the depth budget or a
re-render. See [[dom-match-exact-label-beats-everything]] and
[[panel-name-in-dom]]; the page memoises the runtime, so an edit needs
[[dom-match-memoised-in-page]]'s workaround to test live.
