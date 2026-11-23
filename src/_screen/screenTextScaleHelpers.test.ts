import { describe, expect, it } from 'vitest';

import {
    DEFAULT_SCREEN_TEXT_SCALE,
    MAX_SCREEN_TEXT_SCALE,
    MIN_SCREEN_TEXT_SCALE,
    genScreenTextScaleCss,
    readScreenTextScale,
} from './screenTextScaleHelpers';

describe('readScreenTextScale', () => {
    it('is 1 for nothing usable', () => {
        for (const value of [
            null,
            undefined,
            '',
            '  ',
            'big',
            Number.NaN,
            Number.POSITIVE_INFINITY,
            {},
            [],
            true,
        ]) {
            expect(readScreenTextScale(value)).toBe(DEFAULT_SCREEN_TEXT_SCALE);
        }
    });

    it('reads a number and the setting string of one', () => {
        expect(readScreenTextScale(1.5)).toBe(1.5);
        expect(readScreenTextScale('2.25')).toBe(2.25);
        expect(readScreenTextScale(' 0.5 ')).toBe(0.5);
    });

    it('clamps to 0.1..10', () => {
        expect(readScreenTextScale(0)).toBe(MIN_SCREEN_TEXT_SCALE);
        expect(readScreenTextScale(-3)).toBe(MIN_SCREEN_TEXT_SCALE);
        expect(readScreenTextScale(0.05)).toBe(MIN_SCREEN_TEXT_SCALE);
        expect(readScreenTextScale(12)).toBe(MAX_SCREEN_TEXT_SCALE);
        expect(readScreenTextScale('99')).toBe(MAX_SCREEN_TEXT_SCALE);
    });

    it('keeps two decimals', () => {
        expect(readScreenTextScale(1.23456)).toBe(1.23);
        expect(readScreenTextScale(0.999)).toBe(1);
    });
});

describe('genScreenTextScaleCss', () => {
    it('writes nothing at 1', () => {
        expect(genScreenTextScaleCss(65, 1)).toBe('');
    });

    it('sizes the rows by the scale', () => {
        expect(genScreenTextScaleCss(65, 2)).toBe(
            '#bible-screen-view tr { font-size: 130px; }',
        );
        expect(genScreenTextScaleCss(65, 0.33)).toBe(
            '#bible-screen-view tr { font-size: 21.45px; }',
        );
    });
});
