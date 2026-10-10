---
name: settings-archive-owasetting
description: Export / Import Settings (Settings sidebar) — .owasetting.tar.gz holding only manifest.json; a nested section tree classified by settingArchiveCatalog; import REPLACES each ticked section; credentials only into and out of a password-protected file
metadata:
  node_type: memory
  type: project
  originSessionId: 7d3b388c-e9ce-4842-9450-b2697277cc88
  modified: 2026-10-09T19:31:03.645Z
---

Added 2026-10-09 at the user's request (_"export import setting … import can choose
section to import and override the existing section"_, then _"export should allow
choose section under nested sections"_). Two buttons under **Apply Settings** in the
Settings window's sidebar (`src/setting/setting-archive/SettingArchiveButtonsComp.tsx`,
flows lazy-imported on click). W-52; matrix ST-61..ST-66.

**Format.** `Settings.owasetting.tar.gz`, or `Settings.owasetting.enc` with a password
([[archive-password-protection]]), written to Downloads. The tar holds only
`manifest.json`: `{version, itemKind: 'settings', sections: <leaf ids>, settings:
[{store, key, value}]}`. A chosen section with nothing in it is still listed, because
an empty section is how a file says "all default here".

**Four stores, one catalog** (`settingArchiveCatalog.ts`, pure, imports only
`constants`): `local` (`appLocalStorage`, a file per key under the data folder),
`home` (`clientSetting` in `setting.json`), `secure` (`safeStorage`, cannot be
listed), `theme` (`nativeTheme.themeSource` over IPC). There is no registry of setting
keys in this app, so `classifySettingKey` sorts every key into one of 43 leaves by
exact keys first, then exclusions, then ORDERED prefix/regex rules, then the
`other.other` catch-all (local keys only — home and secure are allowlists, so
`__proto__` can never reach `clientSetting[key]`). Checked against a real ~700-key
profile: 2 keys landed in Other. **Leaf ids are written into files — never rename one**
(the catalog test pins them).

**Import REPLACES a ticked section** (the user's choice over "overwrite matching
keys"): current keys of that leaf that the file lacks are removed, the file's are
written. Both sides are classified by THIS version's catalog. Only leaves listed in
`sections` are offered, and a setting outside them is dropped — replacing a leaf only
some of whose settings are in the file would wipe the rest.

**Never travel:** the data-folder choice (`selected-parent-dir*` — it decides where
`local-storage/` lives), screen-mirror identity / guests / router mapping / mode,
`virtual-display-access`, `virtual-display-tls`, `ai-enabled` (opens the agent doors
— must be turned on knowingly, rule `agent-access.md`), migration markers, one-off
requests, chat sessions and the spend ledger, live screen content.

**Credentials** (AI keys, SongSelect sign-in + its plaintext twin, connection codes)
are exported only into a password-protected file — their rows are disabled until a
password is typed — and taken only out of one (`openArchiveForReading` now returns
`isProtected`). They are never read just to count them: a read can raise the OS
keychain prompt.

**Paths travel portable**, one VALUE at a time against the setting's own file
(`toPortableFileText` out, `toRealFileText` in). The manifest is read as RAW bytes,
never through `fsReadFile`, whose alias expansion over the whole manifest would read
the escape level off the wrong text.

**`ElectronSettingManager` now flushes on `will-quit`.** Its `save()` waits a second,
and nothing flushed on quit, so a Restart pressed right after an import could drop the
home-store writes still waiting (the `taskbarHelpers` comment claimed a flush that did
not exist).

Verification limits: the MCP firewall refuses presses inside the app's popups, so an
agent can open both dialogs but not tick, expand or press **Ok** — the final pass is a
person's. The `trySettingsExport` / `trySettingsImport(path)` dev hooks exist for a
human at DevTools.
