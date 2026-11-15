import { describe, expect, it } from 'vitest';

import { COLOR_TONE_MAP } from '../others/color/colorToneHelpers';
import {
    FILL_BUILT_IN_GRADIENT_MAP,
    FILL_BUILT_IN_PATTERN_MAP,
    findFillTone,
    toInitialFillTone,
} from './fillBuiltInHelpers';
import {
    checkIsFillDark,
    genFillMotionPlan,
    parseFill,
    toCanonicalFillSrc,
} from './fillValueHelpers';

const TONE_LIST = ['dark', 'light'] as const;

describe('the built-in gradients and patterns', () => {
    it('are fills of their own kind, written in the one form', () => {
        for (const tone of TONE_LIST) {
            for (const [kind, list] of [
                ['gradient', FILL_BUILT_IN_GRADIENT_MAP[tone]],
                ['pattern', FILL_BUILT_IN_PATTERN_MAP[tone]],
            ] as const) {
                for (const src of list) {
                    expect(parseFill(src)?.kind).toBe(kind);
                    // Lit by plain comparison: a second form would never be.
                    expect(toCanonicalFillSrc(src)).toBe(src);
                }
            }
        }
    });

    it('offer eight gradients and one pattern of each kind a side, none twice', () => {
        const all = TONE_LIST.flatMap((tone) => {
            return [
                ...FILL_BUILT_IN_GRADIENT_MAP[tone],
                ...FILL_BUILT_IN_PATTERN_MAP[tone],
            ];
        });
        expect(new Set(all).size).toBe(all.length);
        for (const tone of TONE_LIST) {
            expect(FILL_BUILT_IN_GRADIENT_MAP[tone]).toHaveLength(8);
            const names = FILL_BUILT_IN_PATTERN_MAP[tone].map((src) => {
                const fill = parseFill(src);
                return fill?.kind === 'pattern' ? fill.name : null;
            });
            expect(names).toEqual([
                'dots',
                'grid',
                'stripes',
                'diagonal',
                'checks',
                'zigzag',
            ]);
        }
    });

    it('keep each side on its own side, so words read on it', () => {
        for (const tone of TONE_LIST) {
            for (const src of [
                ...FILL_BUILT_IN_GRADIENT_MAP[tone],
                ...FILL_BUILT_IN_PATTERN_MAP[tone],
            ]) {
                expect(checkIsFillDark(parseFill(src)!)).toBe(tone === 'dark');
            }
        }
    });

    it('move one of each kind a side, so the motion is there to be found', () => {
        for (const tone of TONE_LIST) {
            for (const list of [
                FILL_BUILT_IN_GRADIENT_MAP[tone],
                FILL_BUILT_IN_PATTERN_MAP[tone],
            ]) {
                const moving = list.filter((src) => {
                    return genFillMotionPlan(parseFill(src)!) !== null;
                });
                expect(moving).toHaveLength(1);
            }
        }
    });
});

describe('the side a held fill is on', () => {
    it('is a built-in’s own side, however it was written', () => {
        expect(findFillTone(FILL_BUILT_IN_GRADIENT_MAP.dark[3])).toBe('dark');
        expect(findFillTone(FILL_BUILT_IN_PATTERN_MAP.light[2])).toBe('light');
        expect(findFillTone('gradient?colors=fef9c3-ffedd5&angle=180')).toBe(
            'light',
        );
    });

    it('is a colour tone’s side for a colour', () => {
        expect(findFillTone(COLOR_TONE_MAP.dark[0])).toBe('dark');
        expect(findFillTone(COLOR_TONE_MAP.light[0])).toBe('light');
        expect(findFillTone('#000080')).toBeNull();
    });

    it('is no side for a fill the switch does not list', () => {
        expect(findFillTone('gradient?colors=000000-FFFFFF')).toBeNull();
        expect(findFillTone('url(x)')).toBeNull();
        expect(findFillTone(null)).toBeNull();
    });

    it('opens the switch on the side a fill reads as when no list has it', () => {
        expect(toInitialFillTone(FILL_BUILT_IN_PATTERN_MAP.light[0])).toBe(
            'light',
        );
        expect(toInitialFillTone('gradient?colors=000000-111111')).toBe('dark');
        expect(
            toInitialFillTone('pattern?name=dots&base=FFFFFF&ink=00000010'),
        ).toBe('light');
        expect(toInitialFillTone('#FFFFFF')).toBe('light');
        expect(toInitialFillTone('#000080')).toBe('dark');
        expect(toInitialFillTone(null)).toBe('dark');
        expect(toInitialFillTone('url(x)')).toBe('dark');
    });
});
