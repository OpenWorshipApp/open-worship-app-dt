---
name: transition-overrides
description: "Per-document, per-slide, per-background-tab/item and per-foreground-component/session transitions override the screen's Tr row; present = ticked, each item leaves the way it came in"
metadata:
  node_type: memory
  type: project
  originSessionId: a468318b-b7c8-42bf-a0bf-740d0e28e407
  modified: 2026-10-04T12:56:04.393Z
---

Since 2026-10-04 (W-48, PM-154..156, the user's ask: _"transition per slides
preview and per slide … an enabling checkbox … if disabled then it will depend
on screen transition … for all"_ — "section" meant the session tabs) every
level below the screen's **Tr:** row can carry its OWN transition:

| Layer | Levels (most specific wins) | Stored in |
|---|---|---|
| Slides | screen `Slide:` → slides preview (`self`) → slide (id) | `<file>.transition.json` sidecar beside the document (`SlideTransitionManager`) |
| Background | screen `Background:` → tab (type) → item (src) | settings `background-tab-transition` / `background-item-transition` (JSON maps) |
| Foreground | screen `Foreground:` (new on the Tr row) → component → session | `foreground-component-transition-<widgetKey>` / the session's existing `…-setting-show-widget-transition` |

Rules that are easy to break:

- **Present = ticked.** Each level stores just the effect; unticking REMOVES the
  entry (the sidecar is deleted when empty). Nothing writes a default, and a
  datum gets `transitionEffect` only through `withTransitionEffect` /
  `toTransitionPart` -- `checkAreObjectsEqual` counts keys, so an
  `undefined`-valued key rebuilds restored items. Migration-free: a media
  widget's old picker value is simply a ticked session.
- **Resolved on the presenter, carried in the data.** Slides in
  `ScreenVaryAppDocumentManager.applyVarySlideData` (sidecar read lazily, in
  `Promise.all` with the lyric re-derive; a failed read is `undefined`, never a
  blocked slide); backgrounds in the `backgroundSrc` setter BEFORE its equality
  check; foreground at each panel's start/drop/drag path
  (`applyForegroundDragData` copies it for the four types it rebuilds). The
  screen window never reads the stores.
- **Each item leaves the way it came in** (`TRANSITION_DATASET_KEY` on the node
  `animIn` appended -- for zoom, its `.zoom-container`; `getStyleAnimForNode`
  on the way out). Animating the outgoing node with the INCOMING effect cut it
  instantly whenever one side was zoom. `none` is a cut both ways; `move` uses
  the `translate` property and never writes `left` or pushes a sibling; zoom
  clears its transform at rest (a lingering one kills foreground blend modes,
  [[foreground-blend-mode-stacking]]).
- **Marquee is the exception**: with nothing ticked it keeps its edge slide,
  not the screen's Foreground effect (`genMarqueeTransitionCss`).
- The sidecar travels: `FILE_EXTENSIONS` (rename/trash), `AGENT_SIDECAR_EXTENSIONS`,
  `preDelete`, and the archives as an optional `transitionMetas` manifest field.
- Colour swatches are every colour picker in the app; only the Background
  Colors tab provides their transition row (`ColorSwatchExtraMenuContext`).
- Inherited labels read `ScreenEffectManager.getCommonEffectType`; a panel
  restored open on start-up is drawn before any screen exists, so it listens to
  `SCREEN_EFFECT_CHANGED_EVENT` (it read "Varies by screen" until it did).

**Why:** the user wanted different content to change differently on screen;
the Tr row could only say one thing per layer per screen.

**How to apply:** a new way of putting a slide/background/overlay up needs no
work if it goes through those choke points; a new file-copying path must carry
`.transition.json` like `.bg.json`; driving it live, scripts that rewrite a
file in place make Vite serve a stale module ([[vite-caches-failed-import-resolution]]) -- touch the file.
