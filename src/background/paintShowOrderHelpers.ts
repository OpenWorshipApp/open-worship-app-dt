import type { ColorModeType } from '../others/color/colorContrastHelpers';
import {
    type RepeatKindType,
    toNextIndex,
} from '../slide-auto-play/slideAutoPlayRuleHelpers';
import {
    findAnimationSample,
    listAnimationCategorySrcs,
} from './animationBuiltInHelpers';
import { ANIMATION_PRESET_SETTING_NAME } from './animationPresetHelpers';
import { compareAnimationSrc, parseAnimation } from './animationValueHelpers';
import {
    FILL_BUILT_IN_GRADIENT_MAP,
    FILL_BUILT_IN_PATTERN_MAP,
} from './fillBuiltInHelpers';
import { FILL_PRESET_SETTING_NAME } from './fillPresetHelpers';
import { compareFillSrc } from './fillValueHelpers';

/**
 * What a FILL or ANIMATION slide show walks through (2026-11-15, the user:
 * _like background image, `Fills` and `Animations` should support session
 * and auto-play_, then _`Fills Show` and `Animations Show` should support
 * auto-play as well_).
 *
 * A picture show walks its folder in the order the grid draws it. A fill or
 * an animation has no folder: its picker is ROWS of tiles -- the gradients
 * and the patterns of one side of the Dark / Light switch, the CSS
 * animations, the shaders -- with the ones somebody saved under them. So a
 * show walks the row the held one is in, in the order drawn: a gradient up,
 * the gradients go by; a saved one up, the saved ones. The saved row is
 * looked at first, so a session's own list is its playlist even when it
 * holds a built-in; for an animation the PINNED ones are next (2026-11-19),
 * then the row of the held sample's category, side and kind -- Christmas's
 * Light shaders, say, as the Category and the switch show them. A colour
 * from the palette, or a fill (an animation) changed in Customize, is in no
 * row -- the palette is a picker, not a row of
 * backgrounds to show in turn -- and it stays where it is, as a picture from
 * another folder does; saved, it walks with the saved ones.
 *
 * Pure, so the walk is tested without a screen.
 */
export type PaintShowKindType = 'fill' | 'animation';

const TONE_LIST: ColorModeType[] = ['dark', 'light'];

function toCompare(kind: PaintShowKindType) {
    return kind === 'fill' ? compareFillSrc : compareAnimationSrc;
}

/**
 * The built-in rows `heldSrc` could be in. An animation's is its category's
 * row of its side and kind, built for this one tick and let go: no list of
 * every sample is ever kept.
 */
function toBuiltInRowList(
    kind: PaintShowKindType,
    heldSrc: string,
): string[][] {
    if (kind === 'animation') {
        const animation = parseAnimation(heldSrc);
        const sample =
            animation === null ? null : findAnimationSample(animation);
        return animation === null || sample === null
            ? []
            : [
                  listAnimationCategorySrcs(
                      sample.category,
                      animation.engine,
                      sample.tone,
                  ),
              ];
    }
    return TONE_LIST.flatMap((tone) => {
        return [
            FILL_BUILT_IN_GRADIENT_MAP[tone],
            FILL_BUILT_IN_PATTERN_MAP[tone],
        ];
    });
}

/**
 * Where one session's saved fills or animations are kept. The Default
 * session's suffix is empty, so it keeps the list there has always been --
 * the one Fill Show and Animation Show offer too.
 */
export function toPaintPresetSettingName(
    kind: PaintShowKindType,
    sessionSuffix: string,
) {
    const base =
        kind === 'fill'
            ? FILL_PRESET_SETTING_NAME
            : ANIMATION_PRESET_SETTING_NAME;
    return `${base}${sessionSuffix}`;
}

/**
 * The row `heldSrc` is in, in the order drawn; empty when it is in none.
 * `pinnedSrcList` is an animation's pinned ones, walked after the saved.
 */
export function findPaintShowRow(
    kind: PaintShowKindType,
    heldSrc: string,
    savedSrcList: string[],
    pinnedSrcList: string[] = [],
) {
    const compare = toCompare(kind);
    const checkHolds = (srcList: string[]) => {
        return srcList.some((src) => {
            return compare(src, heldSrc);
        });
    };
    if (checkHolds(savedSrcList)) {
        return savedSrcList;
    }
    if (checkHolds(pinnedSrcList)) {
        return pinnedSrcList;
    }
    return (
        toBuiltInRowList(kind, heldSrc).find((srcList) => {
            return checkHolds(srcList);
        }) ?? []
    );
}

/**
 * The one to put up after `heldSrc`, or null when there is none: it is in
 * no row, or "no repeat" walked off the end of its row. A row of one under
 * "repeat" answers the same one, which the caller puts up again -- never
 * pressed, which would take it down.
 */
export function findNextPaintShowSrc(
    kind: PaintShowKindType,
    heldSrc: string,
    savedSrcList: string[],
    rule: { isNext: boolean; step: number; repeatKind: RepeatKindType },
    pinnedSrcList: string[] = [],
) {
    const row = findPaintShowRow(kind, heldSrc, savedSrcList, pinnedSrcList);
    const compare = toCompare(kind);
    const index = row.findIndex((src) => {
        return compare(src, heldSrc);
    });
    const nextIndex = toNextIndex(index, row.length, rule);
    return nextIndex === null ? null : row[nextIndex];
}
