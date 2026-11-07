import {
    applyMirrorSettingPatch,
    checkIsMirrorPresentationSetting,
    MIRROR_PRESENTATION_SETTING_MAX_LENGTH,
} from '../../../electron/screenMirrorProtocol';
import { screenManagerSettingNames } from '../../helper/constants';
import appProvider from '../../server/appProvider';
import { addSettingWriteListener } from '../../setting/directory-setting/appLocalStorage';

/**
 * A screen page draws from its own copy of the presentation settings, taken
 * when its window opened (`appLocalStorage.getItem` on a screen page). A
 * setting changed on the presenter afterwards never reached it: Line Sync
 * flipped on the Mini Screen and the projector kept the old layout until its
 * window was opened again. So every change to one is sent to each showing
 * screen as a `screen-setting` message, on the same channel as the layer
 * messages -- in order, so the redraw that follows a change already reads it.
 */
export type ScreenSettingPatchType = {
    settings: Record<string, string | null>;
};

// Settings whose value IS a layer's state: what the screen shows from them
// arrives as that layer's own message, and they are rewritten whole on every
// present or stroke and can be large.
const LAYER_STATE_SETTING_NAMES = new Set<string>([
    screenManagerSettingNames.VARY_APP_DOCUMENT,
    screenManagerSettingNames.FOREGROUND,
    screenManagerSettingNames.BACKGROUND,
    screenManagerSettingNames.FULL_TEXT,
]);
// A drawing's strokes, `ScreenDrawManager.ts` (`DRAW_SETTING_PREFIX`).
const LAYER_STATE_SETTING_PREFIX_LIST = ['screen-draw-data-'];

function checkIsLayerStateSetting(key: string) {
    return (
        LAYER_STATE_SETTING_NAMES.has(key) ||
        LAYER_STATE_SETTING_PREFIX_LIST.some((prefix) => {
            return key.startsWith(prefix);
        })
    );
}

/** What to send the screens for one write, or null when it is not theirs. */
export function genScreenSettingPatch(
    key: string,
    value: string | null,
): ScreenSettingPatchType | null {
    if (
        !checkIsMirrorPresentationSetting(key) ||
        checkIsLayerStateSetting(key)
    ) {
        return null;
    }
    // Too long for the copy a screen opens with: dropped from it, as from the
    // copy a screen opened now would get, so it draws the default.
    const sentValue =
        value !== null && value.length >= MIRROR_PRESENTATION_SETTING_MAX_LENGTH
            ? null
            : value;
    return { settings: { [key]: sentValue } };
}

let unregisterSettingPush: (() => void) | null = null;

/**
 * From a window that drives screens (never a screen page itself), hand every
 * presentation setting it writes to `send`. Once per window.
 */
export function initScreenSettingPush(
    send: (patch: ScreenSettingPatchType) => void,
) {
    if (appProvider.isPageScreen || unregisterSettingPush !== null) {
        return;
    }
    unregisterSettingPush = addSettingWriteListener((key, value) => {
        const patch = genScreenSettingPatch(key, value);
        if (patch !== null) {
            send(patch);
        }
    });
}

/** On a screen page: take a `screen-setting` message into its own copy. */
export function applyScreenSettingPatch(data: unknown) {
    if (!appProvider.isPageScreen) {
        return;
    }
    const settings = appProvider.screenUtils?.getContext()?.settings;
    if (settings) {
        applyMirrorSettingPatch(settings, data);
    }
}
