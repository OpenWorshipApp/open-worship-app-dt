import {
    mutateSavedPresets,
    readSavedPresets,
} from '../others/savedPresetHelpers';
import {
    MAX_SAVED_PRESET_COUNT,
    addSavedPreset,
    toSavedPresetName,
} from '../others/savedPresetListHelpers';
import {
    toSavedAnimationPreset,
    type SavedAnimationPresetType,
} from './animationPresetHelpers';
import {
    compareAnimationSrc,
    toCanonicalAnimationSrc,
} from './animationValueHelpers';

/**
 * The animations somebody PINNED (2026-11-19, the user: _should be able to
 * pin the item. so even category change it should be seen_): shown above
 * the category's samples whichever category is chosen, in the order they
 * were pinned, and walked first by a slide show of one of them
 * (`findPaintShowRow`).
 *
 * Kept the way saved animations are (`savedPresetHelpers`) -- one list for
 * the Background tab, Animation Show and every session, the same limit --
 * so a pin made in one picker shows in every other one mounted at once.
 * A pin's name is only what it was called when pinned: a tile names itself
 * from its animation, in the language of the day.
 */
export const ANIMATION_PIN_SETTING_NAME = 'background-animation-pins';

export type AnimationPinToggleResultType = 'pinned' | 'unpinned' | 'full';

export function readAnimationPins(): SavedAnimationPresetType[] {
    return readSavedPresets(ANIMATION_PIN_SETTING_NAME, toSavedAnimationPreset);
}

/** What a slide show walks first: the pinned animations, as written. */
export function readAnimationPinSrcList(): string[] {
    return readAnimationPins().map((pin) => {
        return pin.src;
    });
}

export function checkIsAnimationPinned(
    pins: readonly SavedAnimationPresetType[],
    src: string,
) {
    return pins.some((pin) => {
        return compareAnimationSrc(pin.src, src);
    });
}

/** No room for one more: a pin is taken out before another goes in. */
export function checkIsAnimationPinListFull(
    pins: readonly SavedAnimationPresetType[],
) {
    return pins.length >= MAX_SAVED_PRESET_COUNT;
}

/**
 * Pins `src`, or takes its pin out when it has one, on the list as it is
 * NOW; `full` when there was no room, and nothing changed.
 */
export function toggleAnimationPin(
    src: string,
    name: string,
): AnimationPinToggleResultType {
    const canonicalSrc = toCanonicalAnimationSrc(src);
    if (canonicalSrc === null) {
        return 'full';
    }
    let result: AnimationPinToggleResultType = 'full';
    mutateSavedPresets(
        ANIMATION_PIN_SETTING_NAME,
        toSavedAnimationPreset,
        (pins) => {
            if (checkIsAnimationPinned(pins, canonicalSrc)) {
                result = 'unpinned';
                return pins.filter((pin) => {
                    return !compareAnimationSrc(pin.src, canonicalSrc);
                });
            }
            // A pin's name is never shown; a nameless one is kept by its src.
            const pinName =
                toSavedPresetName(name) === '' ? canonicalSrc : name;
            const newPins = addSavedPreset(pins, pinName, {
                src: canonicalSrc,
            });
            result = newPins === null ? 'full' : 'pinned';
            return newPins;
        },
    );
    return result;
}
