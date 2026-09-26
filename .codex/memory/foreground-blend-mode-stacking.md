---
name: foreground-blend-mode-stacking
description: "A foreground widget's `mix-blend-mode` only reaches the background/slide layers because nothing between it and the document root makes a stacking context — never give `#foreground` a z-index, isolation, opacity or transform"
metadata:
  node_type: memory
  type: project
  originSessionId: 709cd00f-9374-4a37-9a3a-80dbd06b55b5
  modified: 2026-09-24T18:15:00.000Z
---

**Video Show** and **Image Show** (2026-09-24) put a clip or a picture on the
`#foreground` layer, above the background, the slide and the bible view, and
they — with **Camera Show** and **Web Show** — carry a **Blend Mode** picker.
The driving case is a falling-snow clip shot on black: with
`mix-blend-mode: screen` the black drops out and only the snow lands over the
live slide.

**Why it works, and what breaks it.** `mix-blend-mode` blends an element with
whatever is painted below it **within the nearest ancestor stacking context**.
On `screen.html` the layers are flat siblings inside `#root` with no `z-index`
anywhere in `src/_screen`, `ScreenForegroundManager.containerStyle` puts
`position: absolute` inline on `#foreground` (overriding the stylesheet's
`position: fixed`, which WOULD make a stacking context), and
`createDivContainer` makes a deliberately unstyled `<div>`. So the backdrop is
`#background` + `#slide` + `#bible-screen-view`.

**Do not** give `#foreground` or that wrapper a `z-index`, `isolation`,
`opacity` below 1, a `filter`, a `transform`, `will-change` or `contain: paint`.
Any one of them confines the blend to the foreground layer and turns every blend
mode into a **silent no-op** — nothing errors, the picture just covers the slide
again. Both sites carry a comment saying so.

Other rules that fell out of building it:

- **`genHtmlForegroundVideo` builds its `<video>` imperatively**, not through
  `renderToStaticMarkup` like its neighbours: React does not write `muted` into
  static markup (it is a property-only attribute), so an SSR'd clip arrives
  unmuted and **Chromium refuses to autoplay it**. `getCameraAndShowMedia` does
  the same for the same reason.
- **`handleRemoving` calls `releaseMediaElement`.** Detaching a media element
  does not free its player, and Chromium refuses to make any more once a frame
  holds a thousand. Video is the first foreground widget that would have leaked
  one.
- **`genForegroundExtraStyle` drops `backdropFilter` and the box shadow while a
  blend mode is in force** — a backdrop root composited with a blend on the same
  element is undefined, and a black shadow is a no-op under `screen` but a dark
  ring under `multiply`. Since 2026-09-25 the shadow is a preset an operator can
  choose (see [[foreground-effects-one-setting]]) and only the DEFAULT one is
  dropped: a preset picked by hand is an answer, not noise.
- `fade().animIn` used to finish by writing a flat `opacity: '1'`, stomping the
  Opacity slider's own value; it restores the element's **authored** opacity now.
- The two widgets keep their **own** dir sources (`FOREGROUND_VIDEO` /
  `FOREGROUND_IMAGE`, folders `foreground-videos` / `foreground-images`), and a
  presenting-flow archive carries their files under the archive kinds
  `foreground-video` / `foreground-image` so an import lands them there rather
  than among the backgrounds.
- **They are built on the Background tabs' own windowed grid.**
  `BackgroundMediaComp` gained a `genItemData` seam (`MediaItemDataType` in
  `backgroundHelpers.ts`) answering "which LAYER is this tile on, how do I put
  it up, how does it drag" -- the default reads `ScreenBackgroundManager`, the
  foreground widgets pass their own. That is what keeps a folder of 3 058 files
  at ~54 mounted tiles, and it is why `ForegroundMediaComp` has ONE Properties
  panel rather than one per file: `appLocalStorage.getItem` reads a FILE per
  key, so a panel per card was ~11 disk reads per file in the folder.
- **A session is one saved set-up of a widget** -- its own folder, Properties
  and slide show -- and `id` on the datum says which session put an item up, so
  picking a new file replaces that session's entry and leaves the others alone.
  Several sessions is how one widget holds several overlays; there is
  deliberately no shift-click "append".
- **A session's slide show runs OUTSIDE React**
  (`foregroundAutoPlayHelpers.ts`): `SlideAutoPlayComp` keeps its timer in an
  effect, so a show stopped the moment its session stopped being rendered.
  Timers now live in a module map keyed `<kind>:<sessionId>`, reconciled from
  whatever renders, and the TICK decides whether the show still has anything to
  advance -- which is how Clear Foreground stops a show whose panel nobody has
  open, with no subscription. `SlideAutoPlayComp` takes `isTimerExternal` so it
  does not also tick, and `onStateChange` so pressing Play reconciles.
- The blend labels are read with a DYNAMIC `tran(mode.labelKey)`, which no
  static sweep can see, so `tranKeyCoverage.test.ts` parses
  `BLEND_MODE_GROUP_LIST` as source text the way it already parses
  `targetLabelMap`. Keep that list's literals and its `] as const;`.
  `Screen Blend` rather than `Screen`: the dictionary's `Screen` is the
  projector.

- **The Foreground is a MENU of components, each in its own floating panel**
  (2026-09-24, `foregroundWidgetHelpers.tsx`). The tab opens a context menu at
  the cursor -- `FOREGROUND_WIDGET_LIST` is the registry -- and a pick opens
  that component in its own `FloatingWidgetComp`, keyed
  `floating-widget-rect-foreground-<key>` so it remembers size and place.
  Which panels are open is ONE setting (`foreground-open-panels`), because the
  chooser and the panels must agree the moment either changes; a `setSetting`
  behind a mounted panel's own `useStateSettingBoolean` would not reach it.
  `ForegroundLayoutComp` is now a bare `<div>`: no card, no collapse chevron
  (the panel's own bar already carries the name, the on-screen mark and
  Close), and NO scroller -- the panel's `.floating-widget__content` is the
  one scrollport, which is what lets the media bar `position: sticky` to it,
  and a second scroller nested inside shrank the windowed grid's visible band
  to two rows AND left dead space under it. Its `fullChildHeaders` /
  `childHeadersOnHidden` / `isOnScreen` props went with the card. The old
  `Background Images Slide Show` is GONE; Image Show does that job on the
  foreground layer.
- **The menu is the status board.** Only one component is looked at at a time
  and a slide show runs with no panel open at all, so each row carries: a tick
  for an open panel, the `app-on-screen` mark, **the number of every screen it
  is on** and a blue ▶ for a running show. Each row also carries
  `title: translate(widget.labelKey)` -- its own text is the name with the
  badges glued onto it ("Video Show1"), which is not what is written on the
  control and is not a name `owa_click` can press by; `labelPartsOf` reads the
  title as a SEPARATE part, so the exact-name tier fires again.
- **Everything that acts on a session rides ONE sticky row**: the session
  buttons, `Properties`, the slide show and the `ScreensRendererComp` that
  takes the item off. The slide show used to be `position: absolute; bottom: 0`
  (right over a previewer, wrong in a panel with a file grid in it) --
  `SlideAutoPlayComp` takes `isInline` for that, and its play / pause / hide
  controls got real names (`Start Slide Show`, `Stop Slide Show`,
  `Hide Slide Show Controls`) because three unnamed `<i>`s is a slide show a
  volunteer cannot find and nothing can press.
- **The show does NOT scroll the list.** `revealVirtualItem` re-CENTRES the row
  every tick (`useRevealPin` always calls `scrollToRow(index, 'center')`), and
  this panel is one the operator browses -- a grid that jumps back every five
  seconds while they hunt for the next picture is worse than not seeing at a
  glance which file is up.
- **Removing a session takes its overlay OFF the screens first.** A session is
  the only thing that knows which entry is its own; once it is gone the picture
  sits on the projector with the widget's Hide button following the ACTIVE
  session and only Clear Foreground left, which takes everything else down too.
- **A panel whose prefix changes must be REMOUNTED.** Every control in
  `PropertiesSettingBodyComp` reads its setting once at mount, so switching
  session left the panel showing the previous session's values while
  `genStyle()` used the new one's -- the panel lied about what would be
  presented. `key={prefix}` on `PropertiesSettingComp` and `key={activeId}` on
  `SlideAutoPlayComp` are what fix it; anything else keyed by a changing
  prefix needs the same.
- The sticky session/Properties bar needs `z-index` ABOVE the tiles: the file
  cards carry their own `z-index: 2` screen-id overlays, and at an equal
  z-index the later sibling wins -- the list painted straight through the
  Properties controls.

Verified live on the real `screen.html?screenId=1` output: the clip's band let
the slide's text show through, lightened, instead of covering it.

Related: [[infinite-paint-animation-at-rest]], [[panel-name-in-dom]],
[[portable-data-dir-alias]].
