import { describe, expect, test } from 'vitest';

import {
    COLOR_MODE_LIST,
    MIN_TEXT_CONTRAST,
    checkIsColorMode,
    genContrastColors,
    toColorMode,
    type ColorModeType,
} from './colorContrastHelpers';
import {
    FOREGROUND_COLOR_MODE_LIST,
    MIN_FOREGROUND_TEXT_CONTRAST,
    checkIsForegroundColorMode,
    genForegroundContrastColors,
    toForegroundColorMode,
} from '../../presenter-foreground/foregroundContrastHelpers';

// The calculation itself is held by `foregroundContrastHelpers.test.ts`
// through the foreground names; this holds that those names ARE this module's
// and what a slide's text box relies on of it.

// A colour handed back untouched may still be written `#rgb`.
function toLongForm(hex: string) {
    return hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
}

function toChannels(hex: string) {
    return [1, 3, 5].map((index) => {
        return Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    }) as [number, number, number];
}

function toAlpha(hex: string) {
    return hex.length === 9 ? Number.parseInt(hex.slice(7, 9), 16) / 255 : 1;
}

function blend(
    top: [number, number, number],
    alpha: number,
    under: [number, number, number],
) {
    return top.map((channel, index) => {
        return channel * alpha + under[index] * (1 - alpha);
    }) as [number, number, number];
}

function toLuminance(channels: [number, number, number]) {
    const [r, g, b] = channels.map((channel) => {
        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast of the words against their box, the box over a slide of that
// side -- worked out here on its own, not with the module's numbers.
function toContrast(
    colors: { color: string; backgroundColor: string },
    mode: ColorModeType,
) {
    const slide: [number, number, number] =
        mode === 'light' ? [1, 1, 1] : [0, 0, 0];
    const box = blend(
        toChannels(colors.backgroundColor),
        toAlpha(colors.backgroundColor),
        slide,
    );
    const words = blend(toChannels(colors.color), toAlpha(colors.color), box);
    const a = toLuminance(box);
    const b = toLuminance(words);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('colorContrastHelpers', () => {
    test("the foreground's names are this module's own, not copies", () => {
        expect(genForegroundContrastColors).toBe(genContrastColors);
        expect(toForegroundColorMode).toBe(toColorMode);
        expect(checkIsForegroundColorMode).toBe(checkIsColorMode);
        expect(FOREGROUND_COLOR_MODE_LIST).toBe(COLOR_MODE_LIST);
        expect(MIN_FOREGROUND_TEXT_CONTRAST).toBe(MIN_TEXT_CONTRAST);
    });

    test('the side is read off the words: light words are the dark side', () => {
        expect(toColorMode('#FFFFFF')).toBe('dark');
        expect(toColorMode('#FDE68A')).toBe('dark');
        expect(toColorMode('#000000')).toBe('light');
        expect(toColorMode('#1E3A8A')).toBe('light');
        expect(COLOR_MODE_LIST).toEqual(['dark', 'light']);
        expect(checkIsColorMode('dark')).toBe(true);
        expect(checkIsColorMode('light')).toBe(true);
        expect(checkIsColorMode('Dark')).toBe(false);
        expect(checkIsColorMode(undefined)).toBe(false);
    });

    test('either side ends with words that read at 4.5 to 1 or better', () => {
        expect(MIN_TEXT_CONTRAST).toBe(4.5);
        const boxes = [
            // Grey on grey: both have to move.
            { color: '#777777', backgroundColor: '#888888' },
            // A see-through box, its alpha kept.
            { color: '#FFFFFF', backgroundColor: '#0F766EB3' },
            // Words already dark on a pale box.
            { color: '#1F2937', backgroundColor: '#FEF3C7' },
            // Shorthand colours read as their long form.
            { color: '#fff', backgroundColor: '#333' },
        ];
        for (const colors of boxes) {
            for (const mode of COLOR_MODE_LIST) {
                const result = genContrastColors(colors, mode);
                const longForm = {
                    color: toLongForm(result.color),
                    backgroundColor: toLongForm(result.backgroundColor),
                };
                expect(
                    toContrast(longForm, mode),
                    `${JSON.stringify(colors)} on ${mode}`,
                ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
                // And the words are on that side: light words for dark.
                expect(toColorMode(longForm.color)).toBe(mode);
            }
        }
    });

    test('a see-through box keeps its alpha on the other side', () => {
        const result = genContrastColors(
            { color: '#FFFFFF', backgroundColor: '#0F766EB3' },
            'light',
        );
        expect(result.backgroundColor).toMatch(/^#[0-9A-F]{6}B3$/);
    });
});
