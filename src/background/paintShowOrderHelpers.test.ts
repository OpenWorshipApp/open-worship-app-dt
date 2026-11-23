import { describe, expect, it } from 'vitest';

import { listAnimationCategorySrcs } from './animationBuiltInHelpers';
import { parseAnimation, toAnimationSrc } from './animationValueHelpers';
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
const CSS_SRC_LIST = listAnimationCategorySrcs('christmas', 'css');
const GLSL_SRC_LIST = listAnimationCategorySrcs('christmas', 'glsl');

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
    it("is its category's CSS animations or shaders, whichever the one up is", () => {
        expect(findPaintShowRow('animation', CSS_SRC_LIST[2], [])).toEqual(
            CSS_SRC_LIST,
        );
        expect(
            findNextPaintShowSrc('animation', GLSL_SRC_LIST[0], [], ALL),
        ).toBe(GLSL_SRC_LIST[1]);
        // Whichever category the one up is of.
        const thanksgiving = listAnimationCategorySrcs('thanksgiving', 'css');
        expect(findPaintShowRow('animation', thanksgiving[1], [])).toEqual(
            thanksgiving,
        );
    });

    it('is the side of the Dark / Light switch the one up is on', () => {
        const light = listAnimationCategorySrcs('christmas', 'glsl', 'light');
        expect(light).not.toEqual(GLSL_SRC_LIST);
        expect(findPaintShowRow('animation', light[3], [])).toEqual(light);
        expect(findNextPaintShowSrc('animation', light.at(-1)!, [], ALL)).toBe(
            light[0],
        );
    });

    it('is the saved row, then the pinned, then the category', () => {
        const pinned = [GLSL_SRC_LIST[4], CSS_SRC_LIST[0]];
        expect(findPaintShowRow('animation', CSS_SRC_LIST[0], [], pinned)).toBe(
            pinned,
        );
        expect(
            findNextPaintShowSrc('animation', CSS_SRC_LIST[0], [], ALL, pinned),
        ).toBe(GLSL_SRC_LIST[4]);
        const saved = [CSS_SRC_LIST[0], CSS_SRC_LIST[5]];
        expect(
            findPaintShowRow('animation', CSS_SRC_LIST[0], saved, pinned),
        ).toBe(saved);
        // Not pinned: its category's row.
        expect(
            findPaintShowRow('animation', CSS_SRC_LIST[3], [], pinned),
        ).toEqual(CSS_SRC_LIST);
    });

    it('is none for an animation changed in Customize', () => {
        const changed = parseAnimation(CSS_SRC_LIST[0])!;
        const fast = toAnimationSrc({ ...changed, speed: 'fast' });
        expect(findPaintShowRow('animation', fast, [])).toEqual([]);
        expect(findNextPaintShowSrc('animation', fast, [], ALL)).toBe(null);
        expect(findPaintShowRow('animation', 'not an animation', [])).toEqual(
            [],
        );
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
