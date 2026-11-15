---
name: background-animation-runtime
description: Why the Background panel's Animations (CSS + GLSL) move only on the screen, draw stills from one shared WebGL context, keep a gradient under the canvas and accept no raw CSS; how the Fills/Animations sessions and slide shows (background and foreground) walk a row and end on a clear
metadata:
  node_type: memory
  type: project
  modified: 2026-11-15T00:00:00.000Z
---

Asked for on 2026-11-15 (the user: _implement `Animation` for background, it
should provide both css and glsl_, _support creative animation_, _make sure it
support transparency and blending mode so for screen in screen show it should
supply the affect_, _supply maximum sample for christian worshiping
background_, _have to allow customizing and preset_). The background type is
`animation`, the drag type `bg-animation`, the tab **Animations** right after
**Fills** (a saved `css-animation` tab key from the old dev placeholder opens
it). Its `src` is ONE canonical string built only from checked parts:
`css?name=…&colors=…&speed=…&density=…[&opacity=NN][&blend=mode]` or
`glsl?name=…|code=<base64url>&colors=…&speed=…&quality=…[&opacity][&blend]`
(`animationValueHelpers.ts`, the twin of `fillValueHelpers.ts`).

**Why:** the target is a weak church computer, and a run sheet or a slide
from another computer carries its backgrounds onto this projector.

**How to apply:**

- **No raw CSS ever reaches the screen.** A CSS effect is a name plus colours,
  speed and density; its markup comes from `cssAnimationLayerHelpers.ts` with a
  seeded PRNG, colours only from the parsed parts (a test holds it). A person
  who wants their own CSS gets **Copy Code** -- a whole HTML page -- and a Webs
  file, where arbitrary HTML already lives in an iframe. Do not add a "custom
  CSS" field: it is `url()` / `@import` onto the projector and a door to paint
  animations.
- **CSS effects move `transform` / `opacity` only**, sizes in container units
  (`cqmin`), keyframes injected once per document. A keyframes test fails on
  any other property (memory [[infinite-paint-animation-at-rest]]). Measured
  on the screen target: snowfall 60 fps, 0 Paint, 0 Layout.
- **A GLSL shader is real code** -- WebGL1, Shadertoy-style `mainImage`,
  `iTime`, `iResolution`, `uColors[4]`, `uColorCount` and helpers; ASCII only,
  12 000 characters, must define `mainImage`, loops bounded by a constant. The
  footer premultiplies alpha so the canvas is see-through by its colour.
- **Live only where presented** (`appProvider.isPageScreen`), as a fill's
  motion is. Everywhere else -- tiles, Mini Screen, slide and run-sheet
  previews, print, PowerPoint -- a still: a CSS effect's still markup, a
  shader's frame from ONE shared offscreen WebGL context
  (`glslStillRenderer.ts`), created on demand, its compiled programs an LRU of
  16, the whole context given back after 10 s idle. A tile moves only under the
  pointer (one context at a time) and waits until it has been in view.
- **The runtime fails safe** (`src/_screen/glslAnimationRuntime.ts`, a dynamic
  import out of the screen's static closure -- memory
  [[renderer-entry-static-closure]]): a CSS gradient of the colours always
  sits under the canvas, so no WebGL, a compile error or a lost context leaves
  that gradient and never a transparent projector; after a context loss that
  code is not restarted in that window (a GPU crash loop otherwise). Quality is
  render scale and fps cap: low 0.35x / 24, normal 0.5x / 30 (default), high
  1x / 60. Measured: flames at ~29 fps, 0 Paint.
- **Text contrast reuses the fill's**: going up, the manager emits `fill-set`
  with the still gradient unless the animation is see-through (opacity under
  100 or a translucent colour).
- **Screen Show**: an iframe cannot blend across its edge, so the animation's
  blend is lifted onto the Screen Show box (`findScreenShowBackgroundBlend`)
  unless the overlay has a blend of its own (memory [[screen-show-foreground]]).
- **Customize and Shader Code debounce per instance**
  (`useMemo(() => genTimeoutAttempt(500), [])`): one picker per screen.
  Apply in the code panel flushes at once. The code editor is Monaco, lazy,
  language `cpp`, a fresh model uri per opening disposed after close.
- **On the foreground too** (2026-11-15): **Fill Show** and **Animation
  Show** (`ForegroundPaintShowComp`) draw the same pickers over the slide, per
  session, Image Show's way. The overlay box is the screen's shape
  (`genForegroundPaintBox`): pinned top left ONLY when Properties places it
  nowhere, because a right or bottom place sets `right` / `bottom` alone and a
  default `left: 0` beat it (a top-right fill drew at the top left). Live
  only in the screen window, as here. Like this tab, the panel is ONE picker
  while its session has nothing up and a picker PER SCREEN once it has (the
  user: _it's not split to new section for another screen selected. I drop
  glsl on another screen, it show customizing for only screen_): a single
  picker had held the first screen's tile and sent a Customize change onto
  every screen, writing one screen's animation over the other's. The fold
  per screen is component state, not a setting (one per session per screen
  would only pile up); Customize-closed is the session's, shared.
- **Sessions and a slide show, both tabs and both shows** (2026-11-15, the
  user: _like background image, `Fills` and `Animations` should support
  session and auto-play_, then _`Fills Show` and `Animations Show` should
  support auto-play as well_). The Fills and Animations tabs carry the Images
  tab's session strip (`PaintTabFrameComp`, `useBackgroundSessionStrip`); a
  session is a SAVED LIST (`toPaintPresetSettingName`, Default's the old
  `background-{fill,animation}-presets`, which the foreground's pickers keep
  reading, so removing a session never forgets Default's). A show walks the
  ROW the one up is in (`findPaintShowRow`: the session's saved list when the
  one up is in it, else the built-in gradients or patterns of its Dark/Light
  side, the CSS samples or the shaders), compared as a fill or an animation,
  never as a string. A palette colour or a Customize change is in no row and
  stays: there is nothing sensible to step to, and inventing one would put a
  colour up nobody picked. Its clocks live OUTSIDE React
  (`applyAutoPlayRunners`, keyed by the settings prefix) as the Images tab's
  do, because the tabs unmount whenever another is looked at. **One show per
  background layer**: a show started in one session ends the others'
  (`stopOtherSessionShows`), since every show would step every screen.
  **A clear ends a show** (`syncBackgroundPaintAutoPlayRunners`, called by
  the TAB on what is up, not by the strip, which leaves with the clear):
  left playing, the next tile put up would start cycling by itself. A step
  goes through `applyBackgroundSrcWithSyncGroup`, never the press path,
  which toggles a src already up off (a row of one). The foreground shows
  (`foregroundPaintAutoPlayHelpers.ts`) walk only the session's OWN
  overlays, each keeping its look, under `foreground-{fill,animation}{suffix}`
  -- the key the Foreground menu already reads for its running mark -- and
  `ForegroundMediaComp`'s ownership test became exact
  (`key === base || key.startsWith(base + '-')`): its `startsWith('foreground-')`
  had claimed every foreground show's timer, so a media show's panel
  reconciling its own (Image Show open and redrawn) would have stopped a
  running Fill Show. Seen live on a scratch instance in Afrikaans.
