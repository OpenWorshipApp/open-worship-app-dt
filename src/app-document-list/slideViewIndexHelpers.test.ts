import { describe, expect, test } from 'vitest';

import { toSlideViewIndex, toSubSlideIndex } from './slideViewIndexHelpers';

describe('slide view index', () => {
    test('a sub-slide card reads its hundredth, not a float tail', () => {
        // `15 + 0.01 + 1` is 16.009999999999998: the badge seen 2026-11-22.
        expect(String(toSlideViewIndex(toSubSlideIndex(15, 0)))).toBe('16.01');
        expect(String(toSlideViewIndex(toSubSlideIndex(31, 0)))).toBe('32.01');
        expect(String(toSubSlideIndex(0, 34))).toBe('0.35');
        expect(String(toSlideViewIndex(toSubSlideIndex(0, 35)))).toBe('1.36');
    });

    test('every sub-slide number prints as two decimals at most', () => {
        for (let i = 0; i < 300; i++) {
            for (let j = 0; j < 99; j++) {
                const index = toSubSlideIndex(i, j);
                const expectedIndex = `${i}.${String(j + 1).padStart(2, '0')}`;
                const expectedView = `${i + 1}.${String(j + 1).padStart(2, '0')}`;
                expect(index).toBe(Number(expectedIndex));
                expect(toSlideViewIndex(index)).toBe(Number(expectedView));
            }
        }
    });

    test('a whole slide keeps its plain number', () => {
        expect(toSlideViewIndex(0)).toBe(1);
        expect(toSlideViewIndex(41)).toBe(42);
    });
});
