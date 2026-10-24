import { describe, expect, test } from 'vitest';

import { diffCompositorScreens, toWallpaperKey } from './compositorHelpers';

function toCurrent(entries: [number, string][]) {
    return new Map(entries);
}

describe('diffCompositorScreens', () => {
    test('nothing on show: every screen asked for is added, in order', () => {
        const result = diffCompositorScreens(toCurrent([]), [
            { screenId: 2, src: '/s2' },
            { screenId: 0, src: '/s0' },
        ]);
        expect(result).toEqual({ removed: [], added: [2, 0], order: [2, 0] });
    });

    test('the same screens at the same addresses change nothing', () => {
        const result = diffCompositorScreens(
            toCurrent([
                [0, '/s0'],
                [1, '/s1'],
            ]),
            [
                { screenId: 0, src: '/s0' },
                { screenId: 1, src: '/s1' },
            ],
        );
        expect(result).toEqual({ removed: [], added: [], order: [0, 1] });
    });

    test('a screen no longer asked for is removed and not added', () => {
        const result = diffCompositorScreens(
            toCurrent([
                [0, '/s0'],
                [1, '/s1'],
            ]),
            [{ screenId: 1, src: '/s1' }],
        );
        expect(result).toEqual({ removed: [0], added: [], order: [1] });
    });

    test('a changed address is removed and added again, never navigated', () => {
        const result = diffCompositorScreens(
            toCurrent([
                [0, '/s0?a'],
                [1, '/s1'],
            ]),
            [
                { screenId: 0, src: '/s0?b' },
                { screenId: 1, src: '/s1' },
            ],
        );
        expect(result.removed).toEqual([0]);
        expect(result.added).toEqual([0]);
        expect(result.order).toEqual([0, 1]);
    });

    test('a new order alone restacks without reloading anything', () => {
        const result = diffCompositorScreens(
            toCurrent([
                [0, '/s0'],
                [1, '/s1'],
            ]),
            [
                { screenId: 1, src: '/s1' },
                { screenId: 0, src: '/s0' },
            ],
        );
        expect(result).toEqual({ removed: [], added: [], order: [1, 0] });
    });

    test('an empty list removes every screen', () => {
        const result = diffCompositorScreens(
            toCurrent([
                [3, '/s3'],
                [4, '/s4'],
            ]),
            [],
        );
        expect(result).toEqual({ removed: [3, 4], added: [], order: [] });
    });

    test('add, keep, change and remove at once', () => {
        const result = diffCompositorScreens(
            toCurrent([
                [0, '/keep'],
                [1, '/old'],
                [2, '/gone'],
            ]),
            [
                { screenId: 3, src: '/new' },
                { screenId: 1, src: '/changed' },
                { screenId: 0, src: '/keep' },
            ],
        );
        expect(result.removed).toEqual([1, 2]);
        expect(result.added).toEqual([3, 1]);
        expect(result.order).toEqual([3, 1, 0]);
    });

    test('the inputs are not changed', () => {
        const current = toCurrent([[0, '/s0']]);
        const screens = [{ screenId: 1, src: '/s1' }];
        diffCompositorScreens(current, screens);
        expect([...current]).toEqual([[0, '/s0']]);
        expect(screens).toEqual([{ screenId: 1, src: '/s1' }]);
    });
});

describe('toWallpaperKey', () => {
    test('the same wallpaper gives the same key', () => {
        expect(toWallpaperKey({ kind: 'color', color: '#112233' })).toBe(
            toWallpaperKey({ kind: 'color', color: '#112233' }),
        );
        expect(toWallpaperKey({ kind: 'none' })).toBe(
            toWallpaperKey({ kind: 'none' }),
        );
    });

    test('a different colour, file or kind gives a different key', () => {
        const keys = [
            toWallpaperKey({ kind: 'none' }),
            toWallpaperKey({ kind: 'color', color: '#112233' }),
            toWallpaperKey({ kind: 'color', color: '#112234' }),
            toWallpaperKey({ kind: 'image', filePath: 'C:\\w\\a.png' }),
            toWallpaperKey({ kind: 'video', filePath: 'C:\\w\\a.png' }),
            toWallpaperKey({ kind: 'image', filePath: 'C:\\w\\b.png' }),
        ];
        expect(new Set(keys).size).toBe(keys.length);
    });
});
