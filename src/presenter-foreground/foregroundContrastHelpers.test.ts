import { describe, expect, test } from 'vitest';

import {
    genForegroundContrastColors,
    genForegroundDefaultColors,
    toForegroundColorMode,
} from './foregroundContrastHelpers';

function toHsl(hex: string) {
    const [r, g, b] = [1, 3, 5].map((index) => {
        return Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    });
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0;
    if (max !== min) {
        const d = max - min;
        if (max === r) {
            hue = (g - b) / d + (g < b ? 6 : 0);
        } else if (max === g) {
            hue = (b - r) / d + 2;
        } else {
            hue = (r - g) / d + 4;
        }
    }
    return { hue: hue * 60, lightness: (max + min) / 2 };
}

describe('Dark / Light of a foreground box', () => {
    test('the side is read off the words', () => {
        expect(toForegroundColorMode('#FFFFFF')).toBe('dark');
        expect(toForegroundColorMode('#111827')).toBe('light');
    });

    test('a box already on its side is handed back as it came', () => {
        const colors = { color: '#FFFFFF', backgroundColor: '#1D4ED8E6' };
        expect(genForegroundContrastColors(colors, 'dark')).toEqual(colors);
    });

    test('Light makes the box lighter and the words darker, each its own colour', () => {
        expect(
            genForegroundContrastColors(
                { color: '#FFFFFF', backgroundColor: '#000000B3' },
                'light',
            ),
        ).toEqual({ color: '#000000', backgroundColor: '#FFFFFFB3' });
        const teal = genForegroundContrastColors(
            { color: '#FFFFFF', backgroundColor: '#0F766EE6' },
            'light',
        );
        // Same transparency, same hue, lighter.
        expect(teal.backgroundColor.endsWith('E6')).toBe(true);
        expect(
            Math.abs(toHsl(teal.backgroundColor).hue - toHsl('#0F766E').hue),
        ).toBeLessThan(2);
        expect(toHsl(teal.backgroundColor).lightness).toBeGreaterThan(
            toHsl('#0F766E').lightness,
        );
        expect(toHsl(teal.color).lightness).toBeLessThan(0.5);
        // And back: the box it started as.
        expect(genForegroundContrastColors(teal, 'dark')).toEqual({
            color: '#FFFFFF',
            backgroundColor: '#0F766EE6',
        });
    });

    test('the words are moved on until they read against the box', () => {
        // Yellow words: mirrored they would be a mid olive on white.
        const light = genForegroundContrastColors(
            { color: '#FACC15', backgroundColor: '#000000B3' },
            'light',
        );
        expect(light.backgroundColor).toBe('#FFFFFFB3');
        expect(
            Math.abs(toHsl(light.color).hue - toHsl('#FACC15').hue),
        ).toBeLessThan(3);
        expect(toHsl(light.color).lightness).toBeLessThan(0.3);
        // A mid blue box: lighter than its mirror, so black words read.
        const blue = genForegroundContrastColors(
            { color: '#FFFFFF', backgroundColor: '#1D4ED8E6' },
            'light',
        );
        expect(blue.color).toBe('#000000');
        expect(toHsl(blue.backgroundColor).lightness).toBeGreaterThan(
            1 - toHsl('#1D4ED8').lightness,
        );
    });

    test("unset colours are the app theme's side of the panel's defaults", () => {
        expect(genForegroundDefaultColors(true)).toEqual({
            color: '#FFFFFF',
            backgroundColor: '#000080AA',
        });
        // The same dark blue box, lighter, under black words.
        expect(genForegroundDefaultColors(false)).toEqual({
            color: '#000000',
            backgroundColor: '#7F7FFFAA',
        });
        expect(
            genForegroundContrastColors(
                genForegroundDefaultColors(false),
                'dark',
            ),
        ).toEqual(genForegroundDefaultColors(true));
    });

    test('a colour it cannot read is left alone', () => {
        const colors = { color: 'red', backgroundColor: '#000000' };
        expect(genForegroundContrastColors(colors, 'light')).toBe(colors);
    });
});
