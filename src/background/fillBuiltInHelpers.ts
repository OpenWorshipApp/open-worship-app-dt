import type { ColorModeType } from '../others/color/colorContrastHelpers';
import {
    findColorTone,
    toInitialColorTone,
} from '../others/color/colorToneHelpers';
import {
    checkIsFillDark,
    checkIsSolidFillSrc,
    compareFillSrc,
    parseFill,
} from './fillValueHelpers';

/**
 * The gradients and patterns the Fills tab offers beside its colours, one set
 * for each side of its Dark / Light switch: deep ones that light words read
 * on, pale ones that dark words read on -- the same promise the colour tones
 * under it make. A pattern's ink is a see-through tint of its base, so the
 * words over it stay the thing that is read. One of each kind on each side
 * moves, so the motion is there to be found; anyone can turn it on, off or
 * faster in Customize.
 *
 * Written in the one form `toFillSrc` writes, so a held fill is lit by plain
 * comparison (`compareFillSrc`). Pure.
 */
export const FILL_BUILT_IN_GRADIENT_MAP: Record<ColorModeType, string[]> = {
    dark: [
        'gradient?shape=linear&angle=180&colors=0F172A-1E3A8A',
        'gradient?shape=linear&angle=135&colors=1E3A8A-581C87',
        'gradient?shape=linear&angle=135&colors=450A0A-7C2D12',
        'gradient?shape=linear&angle=160&colors=052E16-134E4A',
        'gradient?shape=linear&angle=120&colors=042F2E-1E3A8A-3B0764&motion=slow',
        'gradient?shape=radial&angle=180&colors=1E40AF-0B1120',
        'gradient?shape=linear&angle=180&colors=3F3F46-18181B',
        'gradient?shape=linear&angle=45&colors=3B0764-7F1D1D',
    ],
    light: [
        'gradient?shape=linear&angle=180&colors=FEF9C3-FFEDD5',
        'gradient?shape=linear&angle=180&colors=DBEAFE-F4F4F5',
        'gradient?shape=linear&angle=135&colors=FEE2E2-F3E8FF',
        'gradient?shape=linear&angle=135&colors=DCFCE7-CCFBF1',
        'gradient?shape=linear&angle=120&colors=FFEDD5-FEE2E2-F3E8FF&motion=slow',
        'gradient?shape=radial&angle=180&colors=FFFFFF-E4E4E7',
        'gradient?shape=linear&angle=135&colors=F3E8FF-DBEAFE',
        'gradient?shape=linear&angle=45&colors=FEF9C3-FDBA74',
    ],
};

export const FILL_BUILT_IN_PATTERN_MAP: Record<ColorModeType, string[]> = {
    dark: [
        'pattern?name=dots&base=172554&ink=FFFFFF26&size=24',
        'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
        'pattern?name=stripes&base=052E16&ink=FFFFFF14&size=24',
        'pattern?name=diagonal&base=3B0764&ink=FFFFFF1A&size=32',
        'pattern?name=checks&base=042F2E&ink=FFFFFF14&size=48',
        'pattern?name=zigzag&base=450A0A&ink=FFFFFF1A&size=32',
    ],
    light: [
        'pattern?name=dots&base=F4F4F5&ink=0000001F&size=24',
        'pattern?name=grid&base=DBEAFE&ink=1E3A8A26&size=32&motion=slow',
        'pattern?name=stripes&base=FEF9C3&ink=713F1214&size=24',
        'pattern?name=diagonal&base=F3E8FF&ink=581C871A&size=32',
        'pattern?name=checks&base=DCFCE7&ink=14532D14&size=48',
        'pattern?name=zigzag&base=FFEDD5&ink=7C2D121F&size=32',
    ],
};

const TONE_LIST: ColorModeType[] = ['dark', 'light'];

/**
 * The side a held fill is offered on: a colour tone's, a built-in gradient's
 * or pattern's; null for anything the switch does not list.
 */
export function findFillTone(src: unknown): ColorModeType | null {
    if (checkIsSolidFillSrc(src)) {
        return findColorTone(src);
    }
    for (const tone of TONE_LIST) {
        const list = [
            ...FILL_BUILT_IN_GRADIENT_MAP[tone],
            ...FILL_BUILT_IN_PATTERN_MAP[tone],
        ];
        if (
            list.some((builtInSrc) => {
                return compareFillSrc(builtInSrc, src);
            })
        ) {
            return tone;
        }
    }
    return null;
}

/** The side the switch opens on: the held fill's, else the side it reads. */
export function toInitialFillTone(src: unknown): ColorModeType {
    const tone = findFillTone(src);
    if (tone !== null) {
        return tone;
    }
    const fill = parseFill(src);
    if (fill === null) {
        return 'dark';
    }
    if (fill.kind === 'solid') {
        return toInitialColorTone(fill.color);
    }
    return checkIsFillDark(fill) ? 'dark' : 'light';
}
