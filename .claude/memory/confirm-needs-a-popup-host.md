---
name: confirm-needs-a-popup-host
description: "showAppConfirm answers false when the window mounts no popup host, which is indistinguishable from Cancel — so a gate on it must fail open"
metadata: 
  node_type: memory
  type: project
  originSessionId: b6cce606-0f5c-4914-9eb7-7d885333454a
  modified: 2026-09-12T14:37:54.940Z
---

`showAppConfirm` (`src/popup-widget/popupWidgetHelpers.ts`) returns
`Promise.resolve(false)` when `popupWidgetManager.openConfirm` is `null` — that
is, when the window has no popup host mounted. **`false` there is
indistinguishable from the user pressing Cancel.**

`HandleAlertComp` is what registers the host, and it is mounted in only four
places: `src/reader.tsx`, `src/router/AppLayoutComp.tsx` (the main window),
`src/router/PopupLayoutComp.tsx` and `src/setting.tsx`. **`lwShare` and
`lyricEditor` mount none** — yet `AppWindowToolsComp` puts `AppAssistantComp`
(Ctrl+Shift+A, opens the assistant) on all nine renderer entries, so those two
windows have the feature and no way to ask about it.

So any code that gates an action on a confirm must decide what a `false`
means, and for a WARNING the answer is **fail open**: check
`popupWidgetManager.openConfirm === null` first and proceed. A window that
cannot ask is a window that acts. Failing closed makes the control silently do
nothing, which a user reads as a broken app rather than as a warning — and
strictly worse than the warning simply not appearing.

Done this way in `askAiCaution` (`src/helper/ai/aiCautionHelpers.ts`,
2026-09-12, `EC-175`), the caution shown before the 🤖 and ✨ windows open.
Its test asserts the fail-open, because nothing in normal use would ever show
it had regressed.

Two smaller traps in the same area: a partial `vi.mock` of
`popupWidgetHelpers` that exports only `showAppConfirm` makes the manager
`undefined` and throws on the property read — mock both; and turning a click
handler async means tests must flush a microtask before asserting. See
[[confirm-popup-labels-auto-tran]] for the button labels, which are `tran()`ed
for you, and [[tran-missing-key-throws-in-dev]] for the new strings.
