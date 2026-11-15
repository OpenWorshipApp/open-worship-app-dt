import { describe, expect, it } from 'vitest';

import colorList from '../color-list.json';
import {
    COLOR_TONE_MAP,
    findColorTone,
    toInitialColorTone,
} from './colorToneHelpers';
import { checkIsColorDark, compareColor } from './colorValueHelpers';

describe('color tones', () => {
    it('offers two rows of eight a side, none of them a basic swatch', () => {
        const mainColors = Object.values(colorList.main) as `#${string}`[];
        for (const tone of ['dark', 'light'] as const) {
            const list = COLOR_TONE_MAP[tone];
            expect(list).toHaveLength(16);
            expect(new Set(list).size).toBe(16);
            for (const color of list) {
                expect(color).toMatch(/^#[0-9A-F]{6}$/);
                expect(
                    mainColors.some((mainColor) => {
                        return compareColor(mainColor, color);
                    }),
                ).toBe(false);
            }
        }
    });

    it('keeps each side on its own side, so words read on it', () => {
        for (const color of COLOR_TONE_MAP.dark) {
            expect(checkIsColorDark(color)).toBe(true);
        }
        for (const color of COLOR_TONE_MAP.light) {
            expect(checkIsColorDark(color)).toBe(false);
        }
    });

    it('finds the side a held colour is a tone of, alpha aside', () => {
        expect(findColorTone('#1E3A8A')).toBe('dark');
        expect(findColorTone('#1e3a8a80')).toBe('dark');
        expect(findColorTone('#FEF9C3FF')).toBe('light');
        expect(findColorTone('#000080')).toBeNull();
        expect(findColorTone(null)).toBeNull();
        expect(findColorTone(undefined)).toBeNull();
    });

    it('opens on the held colour side, and on Dark with nothing to go by', () => {
        expect(toInitialColorTone('#FEE2E2')).toBe('light');
        expect(toInitialColorTone('#450A0A')).toBe('dark');
        expect(toInitialColorTone('#FFFFFF')).toBe('light');
        expect(toInitialColorTone('#000080')).toBe('dark');
        expect(toInitialColorTone('#FFFFFF10')).toBe('dark');
        expect(toInitialColorTone(null)).toBe('dark');
    });
});
