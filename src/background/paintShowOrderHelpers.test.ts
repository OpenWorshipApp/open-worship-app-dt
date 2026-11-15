import { describe, expect, it } from 'vitest';

import {
    CSS_ANIMATION_SAMPLE_LIST,
    GLSL_ANIMATION_SAMPLE_LIST,
} from './animationBuiltInHelpers';
import {
    FILL_BUILT_IN_GRADIENT_MAP,
    FILL_BUILT_IN_PATTERN_MAP,
} from './fillBuiltInHelpers';
import {
    findNextPaintShowSrc,
    findPaintShowRow,
    toPaintPresetSettingName,
} from './paintShowOrderHelpers';

const ALL = { isNext: true, step: 1, repeatKind: 'all' } as const;
const NONE = { isNext: true, step: 1, repeatKind: 'none' } as const;

const DARK_GRADIENTS = FILL_BUILT_IN_GRADIENT_MAP.dark;
const LIGHT_PATTERNS = FILL_BUILT_IN_PATTERN_MAP.light;
const CSS_SRC_LIST = CSS_ANIMATION_SAMPLE_LIST.map((sample) => sample.src);
const GLSL_SRC_LIST = GLSL_ANIMATION_SAMPLE_LIST.map((sample) => sample.src);

describe('the row a fill show walks', () => {
    it('is the row of tiles the fill up is in, on its own side of the switch', () => {
        expect(findPaintShowRow('fill', DARK_GRADIENTS[1], [])).toBe(
            DARK_GRADIENTS,
        );
        expect(findPaintShowRow('fill', LIGHT_PATTERNS[0], [])).toBe(
            LIGHT_PATTERNS,
        );
    });

    it('is the saved row first, so a session list is a playlist', () => {
        const saved = ['#112233', DARK_GRADIENTS[0], '#445566'];
        expect(findPaintShowRow('fill', DARK_GRADIENTS[0], saved)).toBe(saved);
        expect(
            findNextPaintShowSrc('fill', DARK_GRADIENTS[0], saved, ALL),
        ).toBe('#445566');
        // A colour walks only when it was saved: the palette is no row.
        expect(findNextPaintShowSrc('fill', '#445566', saved, ALL)).toBe(
            '#112233',
        );
    });

    it('is none for a colour of the palette or a fill changed in Customize', () => {
        expect(findPaintShowRow('fill', '#FF0000', [])).toEqual([]);
        expect(findNextPaintShowSrc('fill', '#FF0000', [], ALL)).toBe(null);
        const changed = DARK_GRADIENTS[0].replace('angle=180', 'angle=170');
        expect(findNextPaintShowSrc('fill', changed, [], ALL)).toBe(null);
    });

    it('steps by the rules: forward, back, by more, round or to the end', () => {
        const last = DARK_GRADIENTS.length - 1;
        expect(findNextPaintShowSrc('fill', DARK_GRADIENTS[0], [], ALL)).toBe(
            DARK_GRADIENTS[1],
        );
        expect(
            findNextPaintShowSrc('fill', DARK_GRADIENTS[0], [], {
                ...ALL,
                isNext: false,
            }),
        ).toBe(DARK_GRADIENTS[last]);
        expect(
            findNextPaintShowSrc('fill', DARK_GRADIENTS[0], [], {
                ...ALL,
                step: 2,
            }),
        ).toBe(DARK_GRADIENTS[2]);
        expect(
            findNextPaintShowSrc('fill', DARK_GRADIENTS[last], [], ALL),
        ).toBe(DARK_GRADIENTS[0]);
        // "No repeat" leaves the last one up: there is no next.
        expect(
            findNextPaintShowSrc('fill', DARK_GRADIENTS[last], [], NONE),
        ).toBe(null);
    });

    it('answers the same one for a row of one under repeat', () => {
        expect(findNextPaintShowSrc('fill', '#112233', ['#112233'], ALL)).toBe(
            '#112233',
        );
    });
});

describe('the row an animation show walks', () => {
    it('is the CSS animations or the shaders, whichever the one up is', () => {
        expect(findPaintShowRow('animation', CSS_SRC_LIST[2], [])).toEqual(
            CSS_SRC_LIST,
        );
        expect(
            findNextPaintShowSrc('animation', GLSL_SRC_LIST[0], [], ALL),
        ).toBe(GLSL_SRC_LIST[1]);
    });

    it('compares as an animation, in any order of its parts', () => {
        const [path, query] = CSS_SRC_LIST[0].split('?');
        const reordered = `${path}?${query.split('&').reverse().join('&')}`;
        expect(findNextPaintShowSrc('animation', reordered, [], ALL)).toBe(
            CSS_SRC_LIST[1],
        );
    });
});

describe('where a session keeps its saved ones', () => {
    it('is the list there has always been for Default, its own for another', () => {
        expect(toPaintPresetSettingName('fill', '')).toBe(
            'background-fill-presets',
        );
        expect(toPaintPresetSettingName('animation', '-s1')).toBe(
            'background-animation-presets-s1',
        );
    });
});
