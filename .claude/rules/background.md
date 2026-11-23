---
paths:
  - "src/background/**"
  - "src/_screen/ScreenBackground*"
  - "src/_screen/glslAnimationRuntime.ts"
  - "src/_screen/screenAnimationBackgroundHelpers.ts"
  - "src/presenter-foreground/ForegroundFillComp.tsx"
  - "src/presenter-foreground/ForegroundAnimationComp.tsx"
  - "src/presenter-foreground/ForegroundPaintShowComp.tsx"
  - "src/presenter-foreground/foregroundPaintAutoPlayHelpers.ts"
  - "electron/animationCaptureHelpers.ts"
  - "tools/owa-devtools-mcp/agentAnimation*.mjs"
---

# The Background panel

Seven tabs (`BackgroundComp.tsx`): **Fills**, **Animations**, **Images**,
**Videos**, **Cameras**, **Webs**, then **Audios**. Fills and Animations are
the newest (2026-11-14 / 11-15). Each file's header says why it is the way it
is; this is the map, and what holds across files. The full story of the animations is memory
`background-animation-runtime`.

- **A background's `src` is ONE string**, so keeping, comparing, dragging,
  saving and restoring work for every kind alike. A fill is a colour
  (`#RRGGBB[AA]`), `gradient?…` or `pattern?…` (`fillValueHelpers.ts`); an
  animation is `css?name=…`, `css?code=…`, `glsl?name=…` or `glsl?code=…`
  (`animationValueHelpers.ts`). Compare two with `compareFillSrc` /
  `compareAnimationSrc`, never as strings: the same fill or animation can be
  written more than one way (`toCanonicalFillSrc`).
- **Built from checked parts.** A built-in effect's CSS is built from parsed
  parts (`fillCssTextHelpers.ts`, `cssAnimationLayerHelpers.ts`), never read
  from a value, so a run sheet or a slide from somebody else's computer can
  carry no `url()` onto a projector. The only code read from a value is a
  person's own, since 2026-11-19: CSS through `checkCssCodeProblem`
  (`cssCodeCheckHelpers.ts`: no address, no escape, keyframes on the
  compositor only), drawn in a shadow root of a `contain: strict` box
  (`cssCodeAnimationElementHelpers.ts`); GLSL through `checkGlslCodeProblem`
  (WebGL 1, ASCII, loops with constant bounds).
- **Old saved names** — the fill kind was `color`, its drag kind `bg-color`,
  until 2026-11-14. Screens, settings, `.bg.json`, run sheets and undo backups
  still say so, and `backgroundFillLegacyHelpers.ts` is the one place the old
  names are spelled. Every reader of saved data goes through it.
- **It moves only where it is presented** (`appProvider.isPageScreen`). Tiles,
  the Mini Screen, previews, print and PowerPoint get a still. A shader's
  still comes from ONE shared WebGL context (`glslStillRenderer.ts`: 24
  programs kept, the context released after 10 s idle), because a browser
  keeps only a few contexts and a tab of tiles would push out the
  projector's. The live runtime (`src/_screen/glslAnimationRuntime.ts`) is a
  dynamic import, kept out of the screen's static closure, over a CSS
  gradient of the same colours, so a lost context never leaves a transparent
  projector.
- **Infinite on purpose, on the compositor.** A moving fill or animation runs
  forever on the projector, and it moves `transform` / `opacity` only:
  `ScreenBackgroundFillComp.scss`, the effects' keyframes (their test fails
  on any other property) and the CSS code check. It is exempt from the
  `prefers-reduced-motion` clamp, as a video background is. App chrome may
  not run an infinite paint animation at all
  (`src/test-setup/infinitePaintAnimation.test.ts`, memory
  `infinite-paint-animation-at-rest`).
- **The capture window** (`electron/animationCaptureHelpers.ts`) is for
  **Save as image** / **Save as video** of a CSS animation. Markup cannot be
  read back from its own renderer, so main loads the Copy Code page in a
  hidden window and pictures it. The window is loaded as a stranger's page:
  partition `owa-capture-animation` (memory only), sandboxed, no Node, no
  preload, popups, navigation, permissions and downloads refused, and only
  the staged file served (never a `data:` URL). Script stays on only to SEEK
  every animation to each frame's time. It is `offscreen`, because the OS
  shrinks a hidden window larger than the display. One capture runs at a
  time, and the window closes after 20 s with no frame asked for. A shader
  is drawn in the renderer instead (`animationExportFrameSources.ts`).
- **The export** (`animationExportHelpers.tsx`) writes into the folder of the
  active session of the panel the file can be put up from (Images / Videos,
  or Image Show / Video Show). With no folder there, a toast says so and
  nothing is written. A video is H.264 in a progressive MP4
  (`src/virtual-display/mp4FileWriter.ts`), each frame drawn at its moment,
  never recorded in real time. The file is written as `<name>.part`, renamed
  when whole, and deleted on Stop or failure.
- **Dark / Light on both tabs.** The Fills switch and the Animations switch
  are one component (`ColorModeSwitchComp`) with one rule: open on the held
  one's side, move only when a built-in of the other side is held, store
  nothing. Every animation category has `palettes` (Dark, unchanged since
  before the switch) and `lightPalettes`; a built-in effect that shades its
  ground must stay pale on a pale ground (Sunrise's hill).
- **A show walks a ROW** (`paintShowOrderHelpers.ts`): the session's saved
  list, the pinned animations, then the held one's built-in row -- of its
  side of Dark / Light. Its clocks live outside React, because the tabs
  unmount when another tab is looked at.
  **Fill Show** and **Animation Show** are the same pickers over the slide
  (`ForegroundPaintShowComp.tsx`, `foregroundPaintAutoPlayHelpers.ts`).
- **One picker per screen** once a session has something up, so Customize
  and the code panels debounce **per instance**
  (`useMemo(() => genTimeoutAttempt(500), [])`, CLAUDE.md).
- **The assistant** changes an animation with `owa_animation_edit`
  (`tools/owa-devtools-mcp/agentAnimationEdit.mjs`, its rules in
  `animationAgentRules.ts`; a test holds their two action lists together).
  What it may do, and where: `.claude/rules/agent-tools.md`.
