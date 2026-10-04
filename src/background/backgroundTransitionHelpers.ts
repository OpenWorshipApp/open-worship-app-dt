import EventHandler from '../event/EventHandler';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import type {
    BackgroundSrcType,
    BackgroundType,
} from '../_screen/screenTypeHelpers';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import {
    toValidTransitionEffect,
    withTransitionEffect,
} from '../_screen/transitionOverrideHelpers';

/**
 * A Background tab's own transition (Colors, Images, Videos, Cameras, Webs)
 * and one background's own -- each overriding the screen's `Background:`,
 * the item over its tab. Kept the way `video-fading-at-the-end` keeps its
 * per-file choice: one JSON map per setting key (`appLocalStorage` is a file
 * per key, so a key per tile would be a file per tile), holding only the
 * entries that are switched on.
 *
 * Items are keyed by the `src` a background goes up with -- the file's `src`
 * for a picture, video or web file, the colour for a colour, the device for a
 * camera, the address for a web link.
 */
export const BACKGROUND_TAB_TRANSITION_SETTING_NAME =
    'background-tab-transition';
export const BACKGROUND_ITEM_TRANSITION_SETTING_NAME =
    'background-item-transition';
export const BACKGROUND_TRANSITION_CHANGED_EVENT =
    'background-transition-changed';

type TransitionMapType = { [key: string]: TransitionEffectType };

// One parsed copy per setting key, kept only while the stored text is the
// same: the setter runs for every background put up and every tile badge
// asks, and re-parsing the map each time is the cost this saves. Two entries,
// ever -- one per key above.
const parsedMapCache = new Map<
    string,
    { raw: string; map: TransitionMapType }
>();

function readTransitionMap(settingName: string): TransitionMapType {
    const raw = getSetting(settingName) ?? '';
    const cached = parsedMapCache.get(settingName);
    if (cached !== undefined && cached.raw === raw) {
        return cached.map;
    }
    const map: TransitionMapType = {};
    try {
        const parsed = raw === '' ? {} : JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
                const effect = toValidTransitionEffect(value);
                if (effect !== undefined) {
                    map[key] = effect;
                }
            }
        }
    } catch (_error) {}
    parsedMapCache.set(settingName, { raw, map });
    return map;
}

function writeTransitionEntry(
    settingName: string,
    key: string,
    effect: TransitionEffectType | undefined,
) {
    const map = { ...readTransitionMap(settingName) };
    if (effect === undefined) {
        delete map[key];
    } else {
        map[key] = effect;
    }
    if (Object.keys(map).length === 0) {
        removeSetting(settingName);
    } else {
        setSetting(settingName, JSON.stringify(map));
    }
    EventHandler.addPropEvent(BACKGROUND_TRANSITION_CHANGED_EVENT);
}

export function getBackgroundTabTransition(
    backgroundType: BackgroundType,
): TransitionEffectType | undefined {
    return readTransitionMap(BACKGROUND_TAB_TRANSITION_SETTING_NAME)[
        backgroundType
    ];
}

export function setBackgroundTabTransition(
    backgroundType: BackgroundType,
    effect: TransitionEffectType | undefined,
) {
    writeTransitionEntry(
        BACKGROUND_TAB_TRANSITION_SETTING_NAME,
        backgroundType,
        effect,
    );
}

export function getBackgroundItemTransition(
    src: string,
): TransitionEffectType | undefined {
    return readTransitionMap(BACKGROUND_ITEM_TRANSITION_SETTING_NAME)[src];
}

export function setBackgroundItemTransition(
    src: string,
    effect: TransitionEffectType | undefined,
) {
    writeTransitionEntry(BACKGROUND_ITEM_TRANSITION_SETTING_NAME, src, effect);
}

/** What a background goes up with: its own, else its tab's. */
export function resolveBackgroundTransition({
    type,
    src,
}: {
    type: BackgroundType;
    src: string;
}): TransitionEffectType | undefined {
    return getBackgroundItemTransition(src) ?? getBackgroundTabTransition(type);
}

/**
 * The background with its override stamped on -- or with no
 * `transitionEffect` key at all when it follows the screen.
 */
export function stampBackgroundTransition(
    backgroundSrc: BackgroundSrcType,
): BackgroundSrcType {
    return withTransitionEffect(
        backgroundSrc,
        resolveBackgroundTransition(backgroundSrc),
    );
}
