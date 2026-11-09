import { describe, expect, test, vi } from 'vitest';

// BN-38 (2026-11-08): a note changed through a path written with forward
// slashes, then undone, never reached the note's open window -- the undo's
// "this note changed" named the file with backslashes, the window held it
// with forward slashes, and the two keys differed. On Windows they are one
// file. The platform is this file's own, switched per test.
const h = vi.hoisted(() => {
    return { isWindows: false, isLinux: false };
});

vi.mock('./appProvider', async () => {
    const nodePath = await import('node:path');
    return {
        default: {
            get pathUtils() {
                return h.isWindows ? nodePath.win32 : nodePath.posix;
            },
            browserUtils: {
                pathToFileURL: (filePath: string) => `file://${filePath}`,
            },
            sessionData: { defaultStorageDirPath: null },
            get systemUtils() {
                return { isWindows: h.isWindows, isLinux: h.isLinux };
            },
            messageUtils: { sendDataSync: () => undefined },
            fileUtils: {},
        },
    };
});
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));

async function loadKey(platform: 'windows' | 'mac' | 'linux') {
    h.isWindows = platform === 'windows';
    h.isLinux = platform === 'linux';
    vi.resetModules();
    return (await import('./storageFileHelpers')).toPathCompareKey;
}

describe('one key for every way of writing a path', () => {
    test('on Windows a forward slash is the backslash, and case does not count', async () => {
        const toKey = await loadKey('windows');
        expect(toKey('C:/Notes/Default.own')).toBe(
            toKey('c:\\notes\\default.own'),
        );
        expect(toKey('C:/Notes/Default.own')).not.toBe(
            toKey('C:\\Notes\\Other.own'),
        );
    });

    test('on a Mac case does not count, and a backslash is a letter of a name', async () => {
        const toKey = await loadKey('mac');
        expect(toKey('/Users/a/Notes.own')).toBe(toKey('/users/a/notes.own'));
        expect(toKey('/Users/a\\b.own')).not.toBe(toKey('/Users/a/b.own'));
    });

    test('on Linux the path is the key, as written', async () => {
        const toKey = await loadKey('linux');
        expect(toKey('/home/a/Notes.own')).toBe('/home/a/Notes.own');
        expect(toKey('/home/a/Notes.own')).not.toBe(toKey('/home/a/notes.own'));
    });
});
