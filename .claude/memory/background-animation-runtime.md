---
name: background-animation-runtime
description: Why the Background panel's Animations (CSS + GLSL) move only on the screen, draw stills from one shared WebGL context, keep a gradient under the canvas and keep a person's own CSS only through its check; how the samples come by category (built on demand, numbered looks), how pins and the Dark / Light switch work, how text contrast reads an animation, how the Fills/Animations sessions and slide shows (background and foreground) walk a row and end on a clear, and how an animation is saved as a PNG or an MP4 into the panel's session folder
metadata:
  node_type: memory
  type: project
  modified: 2026-11-19T00:00:00.000Z
---

Asked for on 2026-11-15 (the user: _implement `Animation` for background, it
should provide both css and glsl_, _support creative animation_, _make sure it
support transparency and blending mode so for screen in screen show it should
supply the affect_, _supply maximum sample for christian worshiping
background_, _have to allow customizing and preset_). The background type is
`animation`, the drag type `bg-animation`, the tab **Animations** right after
**Fills** (a saved `css-animation` tab key from the old dev placeholder opens
it). Its `src` is ONE canonical string built only from checked parts:
`css?name=…|code=<base64url>&colors=…&speed=…&density=…[&opacity=NN][&blend=mode]` or
`glsl?name=…|code=<base64url>&colors=…&speed=…&quality=…[&opacity][&blend]`
(`animationValueHelpers.ts`, the twin of `fillValueHelpers.ts`).

**Why:** the target is a weak church computer, and a run sheet or a slide
from another computer carries its backgrounds onto this projector.

**How to apply:**

- **No CSS reaches the screen unchecked.** A built-in CSS effect is a name
  plus colours, speed and density; its markup comes from
  `cssAnimationLayerHelpers.ts` with a seeded PRNG, colours only from the
  parsed parts (a test holds it). Until 2026-11-19 that was ALL the CSS there
  was, and a "custom CSS" field was refused as `url()` / `@import` onto the
  projector and a door to paint animations. That day the user's goal
  _chatbot can help handle css and glsl code editing_ added a person's own
  CSS (**CSS Code**, `css?code=`), kept only when `checkCssCodeProblem`
  (`cssCodeCheckHelpers.ts`) passes it -- no `url()`, `@import`,
  `image-set()`, `@font-face`, no backslash escape, printable ASCII, 12 000
  characters, no `:host` / `::slotted` / `::part` or `<`, and `@keyframes` on
  `transform` / `opacity` (and `translate`, `rotate`, `scale`,
  `offset-distance`) only -- and drawn in a shadow root of a `contain: strict`
  box (`cssCodeAnimationElementHelpers.ts`). The two reasons stand; the check
  is how they are kept. **Copy Code** still writes a whole HTML page.
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
  24 (a category draws 20 built-in shaders; at 16 every category switch
  rebuilt them all), the whole context given back after 10 s idle. A tile
  moves only under the pointer (one context at a time) and waits until it has
  been in view -- a CSS tile too since 2026-11-19 (`CssAnimationPreviewComp`'s
  `useHasBeenInView`): a category is ~35 tiles, each CSS still a few hundred
  particles of markup, and until in view it is the still gradient alone.
- **The runtime fails safe** (`src/_screen/glslAnimationRuntime.ts`, a dynamic
  import out of the screen's static closure -- memory
  [[renderer-entry-static-closure]]): a CSS gradient of the colours always
  sits under the canvas, so no WebGL, a compile error or a lost context leaves
  that gradient and never a transparent projector; after a context loss that
  code is not restarted in that window (a GPU crash loop otherwise). Quality is
  render scale and fps cap: low 0.35x / 24, normal 0.5x / 30 (default), high
  1x / 60. Measured: flames at ~29 fps, 0 Paint.
- **Text contrast reuses the fill's, on the colour the animation READS as**:
  going up, the manager emits `fill-set` with `toAnimationReadFillSrc` -- one
  solid colour, the ground with the mean of the other colours over as much of
  it as the effect covers (`CSS_COLOR_COVER_MAP` / `GLSL_COLOR_COVER_MAP` in
  `animationValueHelpers.ts`; null, the plain mean, for an effect that is all
  colour, as plasma or mesh; the plain mean for a person's own code) -- unless
  the animation is see-through (opacity under 100 or a translucent colour).
  It had sent the still gradient, every colour alike, and the categories'
  bright palettes broke it (2026-11-19): Thanksgiving's Fireworks, a few
  sparks on a near-black ground, read light and set the Bible text to black
  on a dark screen. A new effect needs its cover in both maps -- a test reads
  a sparse effect's samples as dark.
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
  one up is in it, then -- an animation -- the pinned row, else the built-in
  gradients or patterns of its Dark/Light side, or the held sample's category
  row of its kind, built for that tick), compared as a fill or an animation,
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
- **The samples come by CATEGORY, built when shown** (2026-11-19, the user:
  _add categroy control … sunday worship, christmas, thanksgiving, resurection
  day_, _give maximum sample for each category_, _add all possible
  category_, then _add more example, e.g. christmas should have like falling
  snow_). 57 occasions in 6 groups (`animationCategoryData.ts`, a pure leaf):
  each has 4 palettes (ground colour first, dark enough for white words), the
  effects it is known by (`lead`) and the ones it leaves out (`excluded`: no
  fireworks on Good Friday, no snow at Easter). Every effect of both kinds
  comes in the category's colours, and its first, second and third lead
  effect in 4, 3 and 2 numbered LOOKS (`LEAD_LOOK_COUNT_LIST`: another of its
  palettes, more of it or slower, never faster or sparser -- a sparse
  snowfall was an empty colour at tile size), so Christmas opens on Snowfall
  … Snowfall 4 of each kind. The 46 samples there were before are kept, src
  for src, as their category's first looks, so a saved preset, session, run
  sheet or slide keeps its label. **Nothing is built at load and nothing is
  kept**: the label of an animation (`genAnimationLabel`, in the Presenter's
  static closure) is found per category from its ONE effect's few looks,
  after a ground pre-check (`findAnimationSample`); no list of every sample,
  no map, no cache. Every src is unique across all categories (a test).
  The category shown is remembered beside the picker's saved list
  (`toAnimationCategorySettingName`, per Background session, Animation Show
  apart) and changes only when the person changes it; until then it is the
  held sample's own. **Pins** (`animationPinHelpers.ts`,
  `background-animation-pins`, 30 at most, the saved-preset store) are ONE
  list for every picker -- background, foreground, every session -- shown
  above the category's tiles whatever is chosen, and a mounted picker updates
  at once; the pin button is a SIBLING of the tile (never inside its
  `role=button`), shown on hover or focus as an opacity change.
- **Every category on both sides of a Dark / Light switch** (2026-11-19,
  the user: _`Animations` of background and foreground should support
  dark/light mode, keep the pin. all category should have dark/light_, then
  _check `Fills` for its dark/light mode work_). The switch is the Fills
  tab's (`ColorModeSwitchComp` in the picker's bar, both pickers and
  Animation Show alike), and so is its rule: it opens on the held one's
  side (`toInitialAnimationTone`: a sample's own, else the side its read
  colour is on) and moves only when a SAMPLE of the other side is held
  (`findAnimationTone`); the side is never stored, unlike the category.
  Each category's `lightPalettes` (4, the ground pale enough for black
  words, the strongest colour second so a sparse effect still shows) build
  the same effects in the same order and looks; the Dark side is `palettes`
  plus the legacy overrides, src for src what there always was, so a saved
  preset keeps its name. A sample carries its `tone`, `findAnimationSample`
  answers it, a Light one is named `… (Light)` (the Dark name unchanged),
  and a show walks the category row of the held one's side. Every src is
  unique across categories AND sides, and every Light sample reads LIGHT to
  the text-contrast check, sparse or all colour (a test, 1 500+ samples).
  Pins hold both sides and show above either. One shader assumed a dark
  ground: Sunrise drew its hill at 45% of the ground, a grey band on a pale
  one -- a ground brighter than half now gets a pale shade of itself (a
  dark ground's hill is unchanged).
- **Saved as a PNG or an MP4, frame by frame, nothing held** (2026-11-19,
  the user: _for animation add button to save to image|video. for both
  background|foreground, for video let user choose dimention and duration_,
  then _save to background image (if active folder section available), same
  to video, same to foreground_, _for image have to be png_). Two buttons
  right of Customize's preview (`AnimationExportButtonsComp`, the rest
  `import()`ed on the press, one export at a time). The file goes into the
  ACTIVE SESSION's folder of the panel it can be put up from --
  `toAnimationExportDirSettingName`: `select-dir-{image,video}-{bg,fg}` plus
  `toSessionSuffix(resolveActiveSessionId('{place}-{kind}'))`, NOT
  `getActiveDirSourceSettingName` (that assumes the session target and the
  folder setting share a name); no folder there is a toast and nothing
  written. A frame is drawn at its MOMENT, never recorded in real time (a weak
  machine would drop frames): a shader by `drawGlslFrame` at
  `(ANIMATION_STILL_TIME_SECONDS + t) × speed`, starting on the tile's still;
  a CSS effect -- DOM, which no renderer can read back -- in main's hidden
  `offscreen` sandboxed window (`electron/animationCaptureHelpers.ts`, the
  Copy Code page staged in a temp folder, every request but that file
  refused), each animation seeked by `getAnimations()` + `currentTime =
  t × playbackRate`, then `capturePage` (BGRA for a video, PNG for a
  picture); offscreen because the OS shrinks a hidden window larger than the
  display. Video is WebCodecs H.264 (High → Main → Baseline at the least
  level that holds the size) into a PROGRESSIVE MP4 (`mp4FileWriter.ts`,
  `moov` last, the `mdat` size patched with an `r+` stream) -- not the
  virtual display's fragmented one, which other players and worship software
  read badly; only 4 bytes a frame are kept, the samples go to disk as
  encoded, the encode queue at most 4. Written as `<name>.part`, renamed when
  whole, deleted on Stop or failure. **The progress toast is put up ONCE**
  and reads a tiny store: one toast a percent remounted it and replayed its
  slide-in a hundred times -- the user: _it's shaking_.
