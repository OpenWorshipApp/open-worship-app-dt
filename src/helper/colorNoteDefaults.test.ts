import { describe, expect, test } from 'vitest';

import colorList from '../others/color-list.json';
import {
    DEFAULT_BIBLE_COLOR_NOTE,
    findUnusedColorNote,
} from './colorNoteDefaults';

describe('findUnusedColorNote', () => {
    test('walks the menu order, matching codes in any case', () => {
        expect(findUnusedColorNote(new Set())).toBe(colorList.main.fuchsia);
        expect(
            findUnusedColorNote(
                new Set(['#ff00ff', DEFAULT_BIBLE_COLOR_NOTE.toLowerCase()]),
            ),
        ).toBe(colorList.main.yellow);
    });

    test('goes on into the extension list, then gives up', () => {
        const mainColors = Object.values(colorList.main).map((color) => {
            return color.toLowerCase();
        });
        const extensionColor = findUnusedColorNote(new Set(mainColors));
        expect(extensionColor).not.toBeNull();
        expect(mainColors).not.toContain(extensionColor!.toLowerCase());
        const allColors = [
            ...mainColors,
            ...Object.values(colorList.extension).map((color) => {
                return color.toLowerCase();
            }),
        ];
        expect(findUnusedColorNote(new Set(allColors))).toBeNull();
    });
});
