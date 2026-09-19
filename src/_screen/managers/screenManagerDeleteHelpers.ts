import { screenManagerSettingNames } from '../../helper/constants';
import { parseJsonSafely } from '../../helper/helpers';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../../helper/settingHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { SCREEN_MANAGER_SETTING_NAME } from './screenHelpers';
import { drawPanelSettingPrefixList } from './screenSettingKeyHelpers';

// A deleted screen's id is REUSED: `genNewScreenManagerBase` hands out the
// lowest free id, so the next screen the user adds after deleting screen 1 IS
// screen 1. Anything still persisted under that id is therefore not dead
// weight — it is silently adopted by a different screen (its display
// assignment, its drawing, its brush, its spotlight settings). Everything keyed
// by screen id has to go when the screen does.

// Content that is stored as one JSON object keyed by screen id, with the lock
// key its writers take. FULL_TEXT is written under a `set-`-prefixed lock
// (see ScreenBibleManager's screenViewData setter), the others under the plain
// setting name.
const onScreenSettingList = [
    {
        settingName: screenManagerSettingNames.BACKGROUND,
        lockKey: screenManagerSettingNames.BACKGROUND,
    },
    {
        settingName: screenManagerSettingNames.FOREGROUND,
        lockKey: screenManagerSettingNames.FOREGROUND,
    },
    {
        settingName: screenManagerSettingNames.VARY_APP_DOCUMENT,
        lockKey: screenManagerSettingNames.VARY_APP_DOCUMENT,
    },
    {
        settingName: screenManagerSettingNames.FULL_TEXT,
        lockKey: `set-${screenManagerSettingNames.FULL_TEXT}`,
    },
];

// Surgical on purpose: parse, drop the one key, write back. Going through the
// `get*OnScreenSetting()` readers instead would be shorter but they sanitize —
// `getBackgroundSrcListOnScreenSetting` returns `{}` when ANY entry looks
// wrong — so writing their output back would wipe every other screen's content
// on the way past.
function removeScreenEntryFromOnScreenSetting(
    settingName: string,
    lockKey: string,
    screenKey: string,
) {
    return unlocking(lockKey, () => {
        const json = parseJsonSafely<Record<string, unknown>>(
            getSetting(settingName) ?? '',
            true,
        );
        if (json === null || typeof json !== 'object') {
            return;
        }
        if (!(screenKey in json)) {
            return;
        }
        delete json[screenKey];
        setSetting(settingName, JSON.stringify(json));
    });
}

// Per-screen keys that no manager owns: the display assignment (written by
// `ScreenManagerBase`'s displayId setter) and the previewer draw-panel
// settings. Managers drop their own keys in their `delete()`.
function getUnownedPerScreenSettingKeys(screenId: number) {
    return [
        `${SCREEN_MANAGER_SETTING_NAME}-pid-${screenId}`,
        ...drawPanelSettingPrefixList.map((prefix) => {
            return `${prefix}${screenId}`;
        }),
    ];
}

export async function deleteScreenPersistedData(screenId: number) {
    for (const key of getUnownedPerScreenSettingKeys(screenId)) {
        removeSetting(key);
    }
    const screenKey = screenId.toString();
    for (const { settingName, lockKey } of onScreenSettingList) {
        await removeScreenEntryFromOnScreenSetting(
            settingName,
            lockKey,
            screenKey,
        );
    }
}
