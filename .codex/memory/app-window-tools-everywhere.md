---
name: app-window-tools-everywhere
description: AppWindowToolsComp mounts the presenting control and the assistant on all nine app pages; the theme-token wrapper and focused-window menu routing are both load-bearing
metadata:
  type: project
---

`src/others/AppWindowToolsComp.tsx` is the one declaration of **what every
window of the app carries**: `PresentingControlComp` (the annotation overlay)
and `AppAssistantComp` (the way into the chatbot). It is mounted on all nine
renderer entries — presenter, reader, appDocumentEditor, bibleNote, setting,
webEditor, lwShare, lyricEditor, experiment — and deliberately NOT on `about`,
`chatbot`, `finder` or `screen`. Inclusion is decided by which entry file
imports it; there is no page gate anywhere.

Only three windows have a top bar to hold the 🤖 button, so the way in
everywhere is `Tools → Start Controlling` / `Ctrl+Shift+P` and
`Tools → App Assistant` / `Ctrl+Shift+A`. A popup's menu bar is hidden
(`setMenuBarVisibility(false)`), so on most windows the **shortcut is the only
door** — but the menu is still attached, so its accelerators still fire.

**Why:** a volunteer stuck in Settings, a Bible Note or the Lyric Editor had no
way to reach the help that would answer them, and the overlay stopped at
whichever five entries happened to import it.

**How to apply:**

- The wrapper is `<div className="app" data-bs-theme={theme}
  style={{display:'contents'}}>` and that is load-bearing. The `--app-*` tokens
  are declared ONLY under `.app[data-bs-theme='…']` in
  `others/theme-override-{dark,light}.scss`, which `others/main.tsx` imports —
  and `lwShare`, `lyricEditor` and `experiment` never go through `main.tsx`.
  Without the wrapper (and the two SCSS imports the component makes itself) the
  controller paints untokenised. `display: contents` keeps it layout-neutral;
  custom properties still inherit through it.
- `lyricEditor` gets its own `#app-window-tools` div in the html, because its
  body belongs to the Open Lyric dashboard — hence `getReactRoot(containerId)`.
  It and `experiment` also had to start calling `init()`, which the tools need
  for `tran` to have a locale.
- **`setAppMenuItems` keeps ONE entry per key**, and routes the click to the
  window that registered it. A key every window contributes is therefore owned
  by whichever loaded LAST, and every other window's press is dropped by its own
  `getIsWindowFocused()` guard — opening Settings silently took
  *Tools → Start Controlling* away from the presenter. Both tools pass
  `{ isRoutedToFocusedWindow: true }` (`src/lang/langHelpers.ts` →
  `electron/electronEventListener.ts`), which sends it to the window in front
  instead. `lang`, `file`, `insert` and `view` keep owner routing on purpose:
  only the registrant has a handler for their `clickData`.
- `AppAssistantComp` calls `openChatbotPage()` in its OWN window rather than
  asking the main process, so the help window is aligned to the window the
  question is about and `detectOpenerFocus` starts on the right one. Opening it
  twice focuses the existing window — the popup group de-duplicates on
  `uuid=chatbot`.

Related: [[agent-access-mcp-chatbot]], [[question-corpus-maintenance]],
[[panel-name-in-dom]].
