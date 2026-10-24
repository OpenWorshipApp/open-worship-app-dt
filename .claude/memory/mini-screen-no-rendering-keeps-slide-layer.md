---
name: mini-screen-no-rendering-keeps-slide-layer
description: "The mini-screen \"No rendering\" toggle unmounts every drawing layer but must keep the slide layer mounted unpainted — slide media sound and Slide Media Control live there"
metadata:
  node_type: memory
  type: project
  originSessionId: ef24ffc8-d94b-4f22-b017-19ae215bc36d
  modified: 2026-10-03T01:31:54.651Z
---

Each mini-screen card's header has an eye toggle (**Stop rendering preview**, 2026-10-02, user's ask for low-spec machines; setting `mini-screen-no-rendering-<screenId>`, in `previewerSettingPrefixList`). `screen.html` keeps drawing; the card shows a static striped **No rendering** face.

**The slide layer is NOT a drawing layer.** A slide's video, audio and YouTube clip play their SOUND on the presenter's mini screen — the projected copy is a muted follower that never autoplays — and a run sheet's `Slide: Media Control` drives that element (`screenSlideMediaControlHelpers`). Unmounting it would leave slide media silent and stuck on its first frame. So `MiniScreenAppComp` keeps `ScreenVaryAppDocumentComp` mounted with `isUnpainted` (`content-visibility: hidden`), and every other slot keeps its position so a toggle never remounts it (a playing clip carries on). Only a slide video's own play button is lost while off.

**Why:** "everything working the same except no content drawing" — the user's words.

**How to apply:**
- A layer that only draws (background, both foreground roots, bible, focus, draw) hands its root back on unmount via `releaseRootContainer` / `releaseDiv` — identity-guarded (a colour-note remount attaches the new root first, see `ScreenDrawManager.releaseDiv`) and skipped when `isPageScreen`. Before this, an unmounted mini screen (panel closed too) left managers rendering into detached divs: clips decoding, cameras open, countdown frames.
- `ScreenForegroundManager` renderers run only with a mounted root (`whenMounted`); attaching a root re-renders all of `foregroundData`.
- A ref callback that returns a cleanup must be STABLE (`useCallback`): these layers re-render on every `refresh` event, and React 19 runs an inline ref's cleanup on each render — every overlay would be torn down and rebuilt.
- Measured 2026-10-02: presenter renderer 7.7% → 1.7% CPU with both cards off. The GPU process sat at ~35% CPU either way — something else in the presenter, not investigated.

Related: [[website-screenshot-not-iframe]], [[infinite-paint-animation-at-rest]].
