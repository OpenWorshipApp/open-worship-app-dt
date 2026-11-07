---
name: attention-sign-trail
description: "Something in Settings needing the user (an update to an installed language or the Extra Binaries) is signed as a TRAIL of amber dots: the top-bar gear, then the Settings tab, then the item itself; looked up once per launch, kept by main"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c598dea5-f58a-47ad-9dfd-8ceb035ba847
  modified: 2026-11-05T02:59:26.878Z
---

The user, 2026-11-04, with the Setting gear, the Settings tabs and the Extra
Binaries card circled: _as a user I want the app check for installed packages
(languages, extra-bin) for available update at launch so I can know_, then
_sign on the gear icon then on each tab then on the item to update_.

**Why:** a volunteer never opens Settings to look for updates; a sign on the
one button they see, leading tab by tab to the control that fixes it, is how
they find out. A sign only on the item (the "Update Available" pill that was
already there) is a sign nobody reaches.

**How to apply:**

- A new "needs your attention" state behind Settings follows the same trail:
  the gear (`SettingButtonComp`), the tab (`genTabTitle` in `SettingComp.tsx`),
  then the item (`SettingOthersSectionComp`'s `isUpdateAvailable`, or a row's
  own `app-update-dot-inline`). One amber, never animated (it can stay up all
  session; see [[infinite-paint-animation-at-rest]]).
- The look runs ONCE per launch, in the main window, 10 s after start, with the
  checking code `import()`ed only then (`packageUpdateCheckHelpers.ts`); the
  answer lives in MAIN (`electron/packageUpdateProtocol.ts`, `null` = nobody
  looked yet), because a main-window page switch reloads the renderer and must
  not ask the network again. Nothing installed asks the network nothing.
- The panels that already read the same facts (the Languages tab, the Extra
  Binaries card) REPORT what they learn, so an update clears the dots in every
  window with no second look. A report carries only the half it knows.
- Verified live on a scratch profile ([[scratch-dev-instance-beside-user-app]])
  seeded one version behind the dev catalog/pack; the user's own app needs
  View → Relaunch to get the main-process half
  ([[main-process-change-needs-relaunch]]).
