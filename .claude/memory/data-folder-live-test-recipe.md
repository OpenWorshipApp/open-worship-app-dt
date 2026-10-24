---
name: data-folder-live-test-recipe
description: "How to drive the data-folder flows live on a scratch profile: the native folder picker through Win32, a stick as a subst drive letter, confirms on a firewall-off pinned server, and why the Desktop move must touch the real home"
metadata:
  node_type: memory
  type: reference
  originSessionId: 819b138a-b9db-4a65-b21b-aab87139bcd0
  modified: 2026-10-24T19:05:19.011Z
---

What made the 2026-10-24 path-settings run (report
`test-results/robot-test/report-20261024-1009.md`) able to press everything,
on top of [[scratch-dev-instance-beside-user-app]]:

- **Confirms** (Switch, Set according paths, Create Data Folder, Copy → Switch,
  Move Now) are refused by the MCP firewall. With the user's explicit OK, a
  stdio `node tools/owa-devtools-mcp/bin.mjs` started with `OWA_CDP_PORT=<the
  scratch port>` and `OWA_MCP_FIREWALL=off` answers them -- that server only,
  never the shared one, never the user's app.
- **The native folder picker** (Browse, Copy Data Folder) is a `#32770` window
  of the scratch MAIN pid. UI Automation's root search did not list it (nor
  the scratch Settings window), and its Folder box (control id `1152`) has no
  ValuePattern there. What worked: `EnumWindows` for a visible `#32770` of that
  pid, `EnumChildWindows` for the `Edit` whose own or parent id is `1152`,
  `WM_SETTEXT` the path, then `WM_COMMAND` `IDOK` (wParam 1) repeated while the
  window lives -- the first can navigate INTO the folder; `WM_CLOSE` cancels.
  Wait up to 20 s for its box. A Tip of the Day toast can sit over the
  parent's folder button and swallow a uid click.
- **A USB stick** is `subst X: <folder>`; `subst X: /D` then `subst Y: <same>`
  is the stick back on another letter (`findMovedDataDirSync`). The user's own
  app sees the letter too while it is mapped -- remove it at the end.
- **The home and Desktop cannot be faked**: Electron dies at start
  (`0x80000003`) with `USERPROFILE` pointed elsewhere, so the Desktop-move
  rows (ST-80..82) need a throwaway `<real Desktop>\open-worship-data`, and the
  move lands in `~/.owa/open-worship-data (N)` beside the user's real folder.
  Ask first, mark them (`zz-robot-throwaway.txt`), recycle them after.
- **Seeding an old folder**: write a child setting or a `.ows` `srcData` RAW
  (no `$DATA_DIR_PATH`) with the app away from that folder -- that is what an
  older version left, and what Copy Data Folder and Repair Links must handle.
- Accessible names carry Bootstrap icon glyphs (U+F504 and the like) before a
  button's or dialog's words: match `Switch"`, never `"Switch"` -- a panel's
  `generic ".?Documents"` and an `alertdialog ".?Create the KJV Bible` too.
- `owa_list_ui` stops at 100 rows, so an open context menu is read off a
  snapshot (`menuitem` lines). `owa_find_ui` takes `text`, not `find`.
- **Dropping on a path row** (`owa_drop_files`, paths under `test-results/`
  or the temp folder only): Settings' Parent Directory row answers to the
  FIRST `Show path editor` (the topmost; check the answer's `onto.position.y`)
  -- its path text is no control and **Copy Data Folder** is outside the drop
  zone. A list's own drop zone is `Document List` and the like.
- **List the archive with `C:\Windows\System32\tar.exe`**: Git Bash's GNU tar
  reads `C:` as a remote host. And wait for **Exported to** before reading
  it: the tar is written in passes, the manifest last. Its Explorer reveal can
  come after 7 s -- poll longer, and close only a window that is NEW.
- **Aim traps from the full sweep (2026-10-24)**: `Background > images` is
  the Images TAB and the grid alike (a drop answers "nothing on screen") --
  drop on a tile by its full label (`zz-x zz-x.png`); a `/Mini Screen/`
  pattern hits "Divider between … and Mini Screen" first -- aim at the exact
  name; a press by label that lands BEHIND a modal (the KJV card's own
  Create) leaves the question up, and every later confirm, input and URL box
  queues behind it -- answer questions inside the dialog, by its uid; queued
  input boxes clear with repeated **Escape**.
- **By design**: a data folder whose child folders ALL name a gone place
  gets the standard-folders question first (`checkShouldSelectChildDir`), even
  though it is "already a data folder"; Repair Links fixes the links after.
- **Use This Folder** on a fresh profile adopts the user's REAL
  `~/.owa/open-worship-data`: seed NO data-folder key (`stay-awake` included)
  in that profile, or it is carried into their folder; fingerprint
  (`local-storage` sha1 + top level) before and after.
- **A held file** (to force Move Now's COPY path) must be opened by a
  process started with PowerShell `Start-Process` (`[IO.File]::Open(p,
  'Open','Read','Read')`); one spawned detached from Node held nothing. Prove
  it before pressing: renaming the folder must be refused. A "Folder In Use"
  shell dialog can follow a Recycle Bin call for a few seconds after -- close
  it, wait, retry.
- **OS focus is not CDP focus**: `select_page` with `bringToFront` fires no
  `focus` event, and `SetForegroundWindow` loses to the user's own window if
  they are working -- do not steal focus to test a focus listener. What does
  fire one: raw CDP `Emulation.setFocusEmulationEnabled` on the page's own
  `webSocketDebuggerUrl` -- `false` then `true` is one `focus` event, OS focus
  untouched; set it back to `false` afterwards.
- **The Desktop card is under every dialog** (`zIndex` 24, on purpose): with a
  question up -- a fresh profile's _Create the KJV Bible?_ -- its ✕ click lands
  on the backdrop. Answer the dialog first, and find the card's Close from its
  title DOWN in a snapshot: the dialog above it has a Close of its own.
- **A toast the pointer rests on stays up**: CDP clicks leave the pointer
  where they landed, so a toast there can cover the next dialog's buttons.
- The app's own **delete of a sheet or file on a `subst` drive is refused**
  (no Recycle Bin there; an agent never gets Delete Permanently) -- clean
  the stick from disk.

Related: [[data-folder-required]], [[portable-data-dir-alias]], [[bash-heredoc-halves-backslashes]].
