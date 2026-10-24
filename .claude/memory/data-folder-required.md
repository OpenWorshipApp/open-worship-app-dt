---
name: data-folder-required
description: "A data folder is required -- none in use gates every window but Settings; the default is only a suggestion; ~/.owa and drives recommended, never the Desktop"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fb29e134-47f2-481d-86a0-45b06b4624e7
  modified: 2026-10-23T22:42:53.510Z
---

The user's rules for the data (parent) folder, set 2026-10-23 over one session
(W-16 step 2a, W-54, ST-20 / ST-54 / ST-55 / ST-82..85):

- **A data folder is required.** With none IN USE -- none chosen, or the chosen
  one not there (`appLocalStorage.isOnOwnFolder`) -- every window but Settings
  shows only `NoDataDirGateComp` (_No Parent Directory Selected_, Go to
  Settings, App Assistant), and `DirSource.getDirPathBySettingName` names no
  folder: the app's own folder still holds old child paths, and showing them
  read as data with nothing chosen. Settings keeps only what belongs to the
  computer -- General (language, theme), Path Settings, AI Providers.
- **No start-up dialog.** A missing or unset folder opens Path Settings with
  the box focused; a missing chosen folder is only marked _Missing_ in Recent
  Folders -- the user called a warning naming it "wrong".
- **The default `~/.owa/open-worship-data` is a SUGGESTION**, created only when
  **Use This Folder** is pressed. Recommended: that default and the data
  folders at the top of the drives -- never one on the Desktop
  (`loadFoundDirs`).
- **A Desktop data folder in use is said in EVERY window** (`DesktopDataDirCardComp`,
  "not a safe place"), not only once per launch; Move Now asks even while the
  start-up question is hidden for 30 days.
- **AI is not data-folder dependent**: the assistant stays reachable with no
  folder, and the AI keys stay global (see [[language-is-a-computer-setting]]).

**Why:** a volunteer saw songs and notes in an app whose Settings said no folder
was chosen, then dialogs about a folder they never knowingly picked.

**How to apply:** anything that reads data must go through a data folder in use;
never pick a folder for the person; never offer the Desktop back. The settings
split between global and data folder is [[settings-global-vs-data-dir]].
