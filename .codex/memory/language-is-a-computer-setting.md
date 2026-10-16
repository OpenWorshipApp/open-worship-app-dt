---
name: language-is-a-computer-setting
description: "The interface language lives in the home store (userData setting.json), not <data folder>/local-storage/; appLocalStorage routes COMPUTER_SETTING_NAME_LIST keys there"
metadata:
  node_type: memory
  type: project
  originSessionId: 307fb70f-4834-493d-adca-5bd274300247
  modified: 2026-10-15T21:27:02.435Z
---

Since 2026-10-15 the interface locale (`language-locale`) is the COMPUTER's: `getCurrentLocale()`
still calls `appLocalStorage.getItem`, which routes every key of `COMPUTER_SETTING_NAME_LIST`
(`src/setting/directory-setting/appLocalStorage.ts`) to `appHomeStorage` =
`clientSetting["language-locale"]` in the userData `setting.json`. A data-folder switch keeps it.
Routed INSIDE `appLocalStorage` on purpose: a `SettingManager` option or a new export broke ~10
test files that mock `appLocalStorage` and render `tran()`.

- A `<data folder>/local-storage/language-locale` file is an older version's copy. It is taken
  ONCE per computer (`language-locale-migrated` in the home store), then never read — a reset
  by Import Settings must not resurrect an old folder's language. Folder copies are left alone.
- Held 10 s in `appLocalStorage`'s own caches (sync IPC; `tran()` reads the locale per label).
  `listKeys()` leaves a folder's copy out, so nothing removes the computer's value by key.
- Screen pages read it from the bootstrap context: `getMirrorBootstrap` adds it explicitly
  (it is no longer in `PRESENTATION_SETTING`).
- `.owasetting`: exported from the home store; an old file's `local` entry is read as `home`
  (`toCurrentSettingStore`, `MOVED_TO_HOME_KEY_LIST` in `settingArchiveCatalog.ts`).
- Theme was already computer-wide (`nativeTheme.themeSource` in main).

**Why:** the user's ask — "setting language should be global (not store in data folder) so can
once set then have apply to every data folder change".

**How to apply:** to make another setting computer-wide, add its key to
`COMPUTER_SETTING_NAME_LIST` and to the catalog's `MOVED_TO_HOME_KEY_LIST` (+ `HOME_KEY_LEAF_MAP`).
Never write the locale into the data folder's files again. Related: [[dev-data-dir-is-separate]],
[[settings-archive-owasetting]].
