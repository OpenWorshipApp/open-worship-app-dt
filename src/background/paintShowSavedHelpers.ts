import { readSavedPresets } from '../others/savedPresetHelpers';
import { toSavedAnimationPreset } from './animationPresetHelpers';
import { toSavedFillPreset } from './fillPresetHelpers';
import {
    type PaintShowKindType,
    toPaintPresetSettingName,
} from './paintShowOrderHelpers';

/**
 * One session's saved fills or animations, read off the settings with
 * nothing rendered: a slide show's tick runs with its panel closed, and the
 * saved row is the one it walks first (`findPaintShowRow`).
 */
export function readPaintSavedSrcList(
    kind: PaintShowKindType,
    sessionSuffix: string,
) {
    const settingName = toPaintPresetSettingName(kind, sessionSuffix);
    const presetList =
        kind === 'fill'
            ? readSavedPresets(settingName, toSavedFillPreset)
            : readSavedPresets(settingName, toSavedAnimationPreset);
    return presetList.map((preset) => {
        return preset.src;
    });
}
