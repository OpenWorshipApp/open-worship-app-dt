---
name: video-loop-crossfade-two-elements
description: "A background video's end-of-clip fade needs TWO stacked elements that take turns; one element cannot crossfade with itself, and rebuilding one per lap re-reads the clip"
metadata:
  node_type: memory
  type: project
  originSessionId: 9570d8c6-5061-41bf-98cb-1f1cebdd7830
  modified: 2026-09-27T16:08:18.301Z
---

A background video whose end-of-clip fade is on (`getIsFadingAtTheEndSetting`,
default ON except for a `*.loop.*` file name) is covered across its wrap by
**two stacked `<div>` copies that take turns** —
`_ensureVideoLoopTwin` / `_fadeOverVideoLoop` in
`src/_screen/managers/ScreenBackgroundManager.ts`. Two properties are in
TENSION there, and each has already been shipped broken while fixing the
other:

- **One element cannot crossfade with itself.** Fading the showing element out
  and then back in goes all the way through black. Stacked, the audience sees
  `new * a + old * (1 - a)`, so the copy coming in is the ONLY one that moves
  and the outgoing one must stay OPAQUE underneath until the fade finishes —
  fading both at once dips in the middle for the same reason.
- **A copy per lap re-reads the whole clip.** Chromium does not cache a
  `file://` media resource, so a fresh `<video src=...>` every lap means a full
  `bytes=0-` fetch every lap.

The regression that made this a memory: a 2026-09-26 performance pass took the
per-lap `render()` out (rightly — 37 full fetches of one 2.6 MB clip in a few
minutes, ~470 MB an hour for ONE clip on ONE screen) and replaced the crossfade
with `animOut` then `animIn` on the one playing element, which is a 1.5 s dip
to black at the end of every clip. Reported with a screenshot of a black Mini
Screen.

Both properties hold together only if the second copy is **built once and
reused**: after each fade the one that just ended is paused, seeked back to 0
and parked at `opacity: 0` in the same `#background`, and the next lap hands
back to it. Measured live 2026-09-27 on an 11.24 s clip, 8 consecutive wraps:
composite cover `1.0` at all 424 samples (never a dark frame), layer count
never left 2, both elements steady at `readyState: 4`, and **zero media
requests over ~5 laps** on the CDP network log.

Consequences elsewhere:

- Two elements share one `id` (`genVideoIDFromSrc`). That is fine and was
  already assumed: `setVideoCurrentTime` uses `querySelectorAll` and skips any
  element within `FADING_DURATION_SECOND + 0.1` of its start or end, which is
  both of them during a crossfade and the parked one for ever.
- Clearing a background must remove ALL children of `#background`, not
  `lastChild` — the parked copy used to be left behind with its media player.
- A parked copy is removed WITHOUT `animOut`: that helper puts `opacity: 1` on
  before it starts, which would bring a frozen first frame into view on the way
  out.
- `removeOldElements` calls `releaseMediaElement` on every
  `video[id^="video-"]` it takes away — a detached element keeps its player,
  and Chromium refuses to make more once a frame holds a thousand.

Related: [[website-screenshot-not-iframe]], [[infinite-paint-animation-at-rest]],
[[build-kills-running-dev-app]].
