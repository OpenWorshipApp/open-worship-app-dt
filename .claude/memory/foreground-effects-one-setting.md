---
name: foreground-effects-one-setting
description: "Every foreground widget's border, shadow, padding and text setting live in ONE JSON setting per prefix (a file per key otherwise); padding and the text measures are in `em`; the message stack must count the box, not only the lines"
metadata:
  node_type: memory
  type: project
  originSessionId: a6da6680-c553-4573-a83b-cec77caa8b42
  modified: 2026-09-25T17:52:08.946Z
---

**Effects** (2026-09-25, `src/presenter-foreground/foregroundDecorationHelpers.ts`
+ `ForegroundDecorationSettingComp.tsx`) is a fold under every foreground
widget's **Properties**, added because a message's words sat hard against the
edge of their own coloured box and nothing in the panel could move them. It
holds a border (style / width / colour), a box shadow (None / Soft / Medium /
Strong / Glow + colour) and padding for EVERY widget, and — only where the
widget shows words (`isCommonStyle`) — text align, line height, letter spacing,
a text shadow (None / Soft / Glow / Outline + colour) and italic / underline /
uppercase.

**Thirteen values, ONE setting key.** `appLocalStorage.getItem` reads a FILE per
key and `genForegroundExtraStyle` re-reads every key each time a widget works
out its style, so a key per property would have been thirteen more disk reads
per widget — on a machine where a media widget already pays one card's worth per
file in a folder. They are JSON in
`<prefix>-setting-show-widget-decoration`, the way the position pad has always
stored its two values. `toForegroundDecoration` validates FIELD BY FIELD and
falls back per field: the value goes straight into a projector's inline style,
and a hand-edited or half-written settings file must not take a widget's whole
dressing down with it.

**Padding, line height and letter spacing are in `em`; the border and the box
shadow are in `px`.** Padding belongs to the type, so it has to keep its
proportion when Font Size changes; a text shadow belongs to the LETTERFORM (a
2px outline vanishes under 200px type and swallows a Khmer glyph's strokes at
30px). A box shadow belongs to the BOX, so it stays in pixels.

**The default for `padding` is the one default that is not what the app used to
do** — 0.25em where it was 0 — and it is 0 for the media widgets
(`genDecorationDefault(isText)`), which set no font size of their own, so an
`em` there would resolve against whatever the screen happened to inherit.
`shadow: 'medium'` IS the `0 10px 30px rgb(0 0 0 / 25%)` every non-blending
overlay used to get hardcoded from the deleted `getDropExtraStyle()`.

**A blend mode still drops the box shadow, but only the default one.** The
reason in [[foreground-blend-mode-stacking]] stands (a black shadow is a no-op
under `screen`, a dark ring under `multiply`) — but a preset picked by hand is
an answer, and a control that silently ignores the answer reads as broken.

**The message stack counts the BOX, not only the lines.**
`genStackedMessageDataList` in `ForegroundMessageComp.tsx` offsets each shown
message by `calc(<lines*lineHeight + boxes*2*padding>em + <boxes*2*border>px)`;
with padding on, counting lines alone puts two notices back on top of each
other. It is module-level and pure because TWO callers need it and they used to
drift: a Properties change re-sent each datum with the new `extraStyle` spread
over it, which threw the `marginTop` away, so touching any control with two
messages up dropped them onto one another. The **Show all in turn** datum
(`MESSAGE_ALL_ID`) is not one of the stacked ones — it keeps its own text and
interval and takes only the new style. Wrapped lines are still not counted:
nothing in the panel knows the screen's width, so a message long enough to wrap
overlaps the next one slightly. That approximation predates this.

Related: [[foreground-blend-mode-stacking]], [[panel-name-in-dom]],
[[tran-missing-key-throws-in-dev]].
