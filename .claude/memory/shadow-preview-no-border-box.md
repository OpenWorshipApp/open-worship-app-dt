---
name: shadow-preview-no-border-box
description: "Slide previews draw in a shadow root that Bootstrap's `* { box-sizing: border-box }` never reaches — a 100%-sized box with padding overflows there"
metadata:
  node_type: memory
  type: project
  originSessionId: bc375784-d075-4dcf-bb1c-6f13c3a0e661
  modified: 2026-11-07T18:50:00.310Z
---

Slide previews (`VarySlideRenderComp` → `ShadowingFillParentWidthComp`) render
inside a shadow root, and Bootstrap's reboot rule `*, ::before, ::after {
box-sizing: border-box }` does not cross into it. So anything sized `width:
100%; height: 100%` WITH padding is content-box there: a padding wider and
taller than its frame, shifted right and down by one padding.

Found 2026-11-07 through the Stage Style panel (the user: _I see the left and
top margin are bigger_): `genTextStyle` (text, html and Bible canvas items)
gave a 6 px padding and no `box-sizing`, so every lyric box's left/top gap was
12 px wider than its right/bottom one in the Stage Previewer — while the
editor, outside any shadow root, drew it centred. Proven live with
`get_css_styles`: only the user-agent `div` rule and a `*` transition matched.

**Why:** a style that relies on the page's global CSS renders differently in a
preview than in the editor.

**How to apply:** a style shared by previews says its own `box-sizing` (as
`genTextStyle` and `canvasBoxLayoutHelpers`' measuring element now do). When a
preview and the editor disagree by a few pixels, check what global rule the
shadow root is missing before touching the geometry. Related:
[[lyric-subsystem-architecture]].
