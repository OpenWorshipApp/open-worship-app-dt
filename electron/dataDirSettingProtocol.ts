/**
 * Settings that belong to the DATA FOLDER although every reader reaches them
 * through the computer's own store (`clientSetting` in `setting.json`, the
 * renderer's `appHomeStorage`): `ElectronSettingManager` keeps them as files in
 * `<data folder>/local-storage/`, beside the folder's other settings, so they
 * go wherever the folder goes -- a stick, a copy, the move off the Desktop
 * (the user's "Global / Data dir" list, 2026-10-23).
 *
 * What stays the computer's: windows, which data folder is chosen, the
 * language, the AI assistants (_ai (chatbot) is not data dir dependee_), every
 * secret, and the three Screen Mirror facts of this machine on its network --
 * `screen-mirror-identity` (two instances with one id refuse each other as
 * "self"), `screen-mirror-router-mapping` (a port opened on THIS network's
 * router) and `screen-mirror-last-port`.
 *
 * Pure: the renderer imports it too (`appLocalStorage.listKeys`).
 */
export const DATA_DIR_SETTING_NAME_LIST: readonly string[] = [
    'song-select-setting', // `src/plugins/song-select/songSelectSettingHelpers.ts`
    'stay-awake', // `electron/stayAwakeProtocol.ts`
    // `electron/screenMirrorService.ts` (`screen-mirror-` + name).
    'screen-mirror-mode',
    'screen-mirror-host',
    'screen-mirror-guests',
    'screen-mirror-internet',
    'screen-mirror-public-port',
    'screen-mirror-public-address',
    'screen-mirror-port',
    'screen-mirror-tunnel',
    // `electron/virtualDisplayProtocol.ts`, `virtualDisplayService.ts`.
    'virtual-displays',
    'virtual-display-share',
    'virtual-display-access',
    'virtual-display-https',
    'virtual-display-viewer-labels',
];

// The Bible note editor's own store (`bibleNoteHelpers.ts`), every key it asks.
const DATA_DIR_SETTING_PREFIX_LIST: readonly string[] = ['lexical-playground-'];

// A setting is a FILE named after its key: only a plain name may become one,
// never a path a key from a renderer could walk out of the folder with.
const SAFE_SETTING_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

export const SELECTED_PARENT_DIR_SETTING_NAME = 'selected-parent-dir';
export const DATA_DIR_LOCAL_STORAGE_FOLDER_NAME = 'local-storage';

export function checkIsDataDirSettingName(key: unknown): key is string {
    if (typeof key !== 'string' || !SAFE_SETTING_NAME_PATTERN.test(key)) {
        return false;
    }
    return (
        DATA_DIR_SETTING_NAME_LIST.includes(key) ||
        DATA_DIR_SETTING_PREFIX_LIST.some((prefix) => {
            return key.startsWith(prefix);
        })
    );
}
