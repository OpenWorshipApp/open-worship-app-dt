---
name: hover-hidden-controls
description: "Much of the OWA UI is laid out and clickable but painted only while the mouse is over it; the MCP matcher classifies three ways and forces :hover rather than moving the mouse"
metadata:
  type: project
---

A large slice of this app's controls are **invisible without being absent**:
laid out and sized at all times, painted away by a plain CSS `:hover` rule on a
container **several levels up**, not on the button. Most use
`HoverMotionHandler`'s classes (`src/helper/domHelpers.ts`; the rules are a
`@for` loop in `src/others/appInit.scss`):
`.app-top-hover-motion-N:hover .app-low-hover-visible-N` flips `visibility`.

The reported case was the icon row of every bible view (Copy, Split horizontal /
vertical, Save bible item, Save and show, Export to MS Word). Since 2026-09-29
it no longer uses those classes: it lives in `.bible-view-header-actions`
(`src/bible-reader/BibleViewComp.scss`), absolutely positioned over the END of
the title on the header's own row, at `opacity: 0` + `pointer-events: none`
until `.bible-view-header:hover` (or `:has(:focus-visible)`). It had held a
second, empty line of every pane while invisible, and wrapped under 550px.
Opacity rather than `visibility` so a keyboard can still reach it; the matcher
reads both as `hidden`, and the forced hover below lifts `pointer-events` too.

Measured on the presenter, 2026-08-31: of 659 controls, **24 are painted away
but laid out** and only 13 have no box at all.

Consequences that keep catching things out:

- **`getBoundingClientRect().width > 0` does not mean "the user can see it".**
  Any visibility judgement written that way is answering the wrong question.
  `Element.checkVisibility({checkVisibilityCSS: true, opacityProperty: true})`
  answers the right one, and did all 659 in **0.4ms against 11ms** for the
  ancestor walk. Called with NO options it asks only "has it a box", which is
  how `display:none` is told from painted-away without forcing a layout.
- `tools/owa-devtools-mcp/domMatch.mjs` classifies `shown` / `hidden` / `gone`
  (`visibilityOf`), marks a match `showsOnHover`, and prefers a visible twin —
  ranked BELOW `isControl`, so a hidden button still beats a visible container.
- To show one, it **forces the `:hover` state** (`revealHidden`) rather than
  moving the mouse: the page's own `:hover` rules re-emitted with `:hover`
  rewritten to `[data-owa-hover]`, stamped on the control and every ancestor.
  `:hover` and `[attr]` weigh the same in the cascade, so the rewritten rule
  wins on document order and needs no `!important`. One reveal at a time, always
  released on a timer.
- **Do not move the mouse to do this.** It is the user's pointer, a synthetic
  move lands wherever the window has since scrolled, and a real hover ends the
  moment they reach for the button — while a forced one stays while they read.
- A caller must not test "is it hidden?" before asking for a reveal: on a
  re-render the control is visible *because* the caller is holding it.
  `revealHidden` answers "is this being held", true either way.

Related: [[dom-match-memoised-in-page]] (clear `window.__owaDomMatch` before
believing a live result), [[panel-name-in-dom]], [[mcp-tool-edit-two-processes]].
