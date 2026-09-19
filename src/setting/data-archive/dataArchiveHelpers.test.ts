// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

// A Linux machine: the folder tar is started in must stay ABSOLUTE, because a
// desktop launch starts the app in `$HOME`, not in `/`.
vi.mock('../../server/appProvider', async () => {
    const { posix } = await import('node:path');
    return {
        default: {
            isPageScreen: false,
            isPageReader: false,
            isMainPage: false,
            systemUtils: { isDev: false, isLinux: true },
            sessionData: { defaultStorageDirPath: null },
            pathUtils: posix,
            messageUtils: { sendData: () => {}, sendDataSync: () => null },
        },
    };
});

vi.mock('../directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

const { toCommonAncestor } = await import('./dataArchiveHelpers');

describe('toCommonAncestor on macOS/Linux', () => {
    test('keeps the leading / of the folder tar starts in', () => {
        expect(
            toCommonAncestor([
                '/media/me/USB/data/lyrics',
                '/media/me/USB/data/documents',
            ]),
        ).toEqual({
            ancestorDir: '/media/me/USB/data',
            entries: ['lyrics', 'documents'],
        });
    });

    test('a single folder still has a name of its own inside', () => {
        expect(toCommonAncestor(['/home/me/data/videos'])).toEqual({
            ancestorDir: '/home/me/data',
            entries: ['videos'],
        });
    });

    test('names differing only by case are two folders on Linux', () => {
        expect(
            toCommonAncestor(['/home/me/Data/lyrics', '/home/me/data/videos']),
        ).toEqual({
            ancestorDir: '/home/me',
            entries: ['Data/lyrics', 'data/videos'],
        });
    });

    test('folders with nothing but / in common are refused', () => {
        expect(() => {
            return toCommonAncestor(['/home/a/x', '/media/b/y']);
        }).toThrow('no common parent folder');
    });
});
