import type { ForegroundColorModeType } from './foregroundContrastHelpers';
import {
    type ForegroundColorPairType,
    type ForegroundPresetFlagsType,
    applyForegroundPreset,
    getForegroundPreset,
} from './foregroundPresetHelpers';

/**
 * Quick Text's own keys, in one place: the panel reads them and a Bible
 * passage's Create Quick Text writes them for a session that is not mounted.
 */
export const QUICK_TEXT_WIDGET_KEY = 'quick-text';

export function toQuickTextPrefix(suffix: string) {
    return `${QUICK_TEXT_WIDGET_KEY}${suffix}`;
}
export function toQuickTextSettingName(suffix: string) {
    return `foreground-quick-text-setting${suffix}`;
}
export function toQuickTextTimeDelaySettingName(suffix: string) {
    return `foreground-quick-text-time-delay${suffix}`;
}
export function toQuickTextTimeToLiveSettingName(suffix: string) {
    return `foreground-quick-text-time-to-live${suffix}`;
}

/** The Quick Text panel's Properties rows (`ForegroundQuickTextComp`). */
export const QUICK_TEXT_PRESET_FLAGS: ForegroundPresetFlagsType = {
    isFontSize: true,
    isGeometry: true,
    isCommonStyle: true,
    isMargin: true,
};

export type QuickTextPresetIdType =
    | 'bible-verse'
    | 'speaker'
    | 'song-title'
    | 'sermon-title'
    | 'event-session'
    | 'announcement';

/**
 * Writes one of Quick Text's presets (`foregroundPresetHelpers`) over ONE
 * session's look and its seconds on screen, for a session that may not be
 * mounted -- a Bible passage's Create Quick Text, the help window's
 * assistant -- on `mode`'s side, else the side the session is on (an unset
 * colour read as `defaultColors`, the app theme's side). False for an id
 * Quick Text has no preset by.
 */
export function applyQuickTextPreset(
    suffix: string,
    presetId: QuickTextPresetIdType,
    mode?: ForegroundColorModeType,
    defaultColors?: ForegroundColorPairType,
) {
    const preset = getForegroundPreset(QUICK_TEXT_WIDGET_KEY, presetId);
    if (preset === undefined) {
        return false;
    }
    applyForegroundPreset({
        widgetKey: QUICK_TEXT_WIDGET_KEY,
        prefix: toQuickTextPrefix(suffix),
        flags: QUICK_TEXT_PRESET_FLAGS,
        preset,
        mode,
        defaultColors,
    });
    return true;
}
