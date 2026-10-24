---
name: settings-global-vs-data-dir
description: "Which settings are the computer's (setting.json) and which the data folder's -- data-folder ones routed by ElectronSettingManager through the same appHomeStorage calls"
metadata:
  node_type: memory
  type: project
  originSessionId: fb29e134-47f2-481d-86a0-45b06b4624e7
  modified: 2026-10-23T23:03:17.086Z
---

The user's split, 2026-10-23 (their "Global / Data dir" list, then
_remove those_ for the machine-bound mirror keys and _ai (chatbot) is not
data dir dependee_):

- **The computer's** (`clientSetting` in `<userData>/setting.json`): windows and
  popups, theme, which data folder (`selected-parent-dir*`, `data-dir-move-*`),
  `language-locale`, the AI assistants (`ai-setting`, `ai-enabled`,
  `ai-custom-servers`), every secret, and `screen-mirror-identity` /
  `-router-mapping` / `-last-port` (two instances sharing an identity refuse
  each other as "self"; a router mapping is THIS network's).
- **The data folder's** (`<data folder>/local-storage/<key>`): SongSelect's
  plaintext half, `stay-awake`, the rest of Screen Mirror and virtual displays,
  and the Bible note editor's `lexical-playground-*` -- the list is
  `electron/dataDirSettingProtocol.ts`.

How: every reader still calls `appHomeStorage` / `getClientSetting`, and
`ElectronSettingManager` routes a listed key to the file (2 s cache in
`dataDirSettingHelpers.ts`, a plain-name check so no key walks out of the
folder). The data folder is the chosen one while it is there, else the
profile's own -- the renderer's rule. `moveSettingsToDataDir` moves the old
global copies into the chosen folder ONCE at the start (only a folder that is
there; the folder's own value wins), and a read falls back to the global copy
until then. `getAllClientSettingKeys` lists the folder's files, so Export /
Import Settings keeps its 'home' classification; `appLocalStorage.listKeys`
leaves them out so they are not listed twice.

A main-process change: a running dev app needs a relaunch to route them
([[main-process-change-needs-relaunch]]). Seen live 2026-10-23 on a scratch
profile: one start moved four keys into the folder and the Desktop move then
carried them to `~/.owa`; Copy Data Folder copied them. See
[[data-folder-required]].
