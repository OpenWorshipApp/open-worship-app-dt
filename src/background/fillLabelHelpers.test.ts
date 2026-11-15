import { describe, expect, it, vi } from 'vitest';

// Marked, so a word that skipped `tran` shows.
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `[${text}]`,
}));

import {
    genFillLabel,
    tranFillMotion,
    tranFillPatternName,
} from './fillLabelHelpers';
import {
    FILL_MOTION_LIST,
    FILL_PATTERN_LIST,
    parseFill,
} from './fillValueHelpers';

describe('a fill’s name for a person', () => {
    it('names every pattern and speed in the app’s language', () => {
        expect(FILL_PATTERN_LIST.map(tranFillPatternName)).toEqual([
            '[Dots]',
            '[Grid]',
            '[Stripes]',
            '[Diagonal Lines]',
            '[Checks]',
            '[Zigzag]',
        ]);
        expect(FILL_MOTION_LIST.map(tranFillMotion)).toEqual([
            '[None]',
            '[Slow]',
            '[Normal]',
            '[Fast]',
        ]);
    });

    it('keeps the codes as they are and translates only words', () => {
        expect(genFillLabel(parseFill('#123456')!)).toBe('#123456');
        expect(
            genFillLabel(parseFill('gradient?angle=135&colors=1E3A8A-581C87')!),
        ).toBe('135° #1E3A8A → #581C87');
        expect(
            genFillLabel(
                parseFill(
                    'gradient?shape=radial&colors=1E40AF-0B1120&motion=fast',
                )!,
            ),
        ).toBe('◎ #1E40AF → #0B1120 ([Speed]: [Fast])');
        expect(
            genFillLabel(
                parseFill(
                    'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
                )!,
            ),
        ).toBe('[Grid] #FFFFFF1A / #18181B ([Speed]: [Slow])');
    });
});
