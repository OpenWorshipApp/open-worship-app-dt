// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// A macOS machine importing a bundle made on Windows: every path function the
// module reaches runs with POSIX rules, and the manifest carries Windows paths.
const h = vi.hoisted(() => {
    return {
        sessionData: {
            defaultStorageDirPath: '/Volumes/USB/data' as string | null,
        },
        copiedTo: [] as { dirPath: string; fileFullName: string }[],
        importedPathByName: new Map<string, string>(),
    };
});

vi.mock('../server/appProvider', async () => {
    const { posix } = await import('node:path');
    return {
        default: {
            isPageScreen: false,
            isPageReader: false,
            isMainPage: false,
            systemUtils: { isDev: false, isWindows: false },
            sessionData: h.sessionData,
            pathUtils: posix,
            messageUtils: { sendData: () => {}, sendDataSync: () => null },
        },
    };
});

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

vi.mock('../server/fileHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../server/fileHelpers')>();
    return {
        ...actual,
        // Everything the archive extracted is there; nothing of that name is
        // in the destination yet.
        fsCheckFileExist: async (filePath: string) => {
            return filePath.startsWith('/tmp/extract/');
        },
        fsCopyFilePathToPath: async (
            _sourcePath: string,
            dirPath: string,
            fileFullName: string,
        ) => {
            h.copiedTo.push({ dirPath, fileFullName });
            return (
                h.importedPathByName.get(fileFullName) ??
                actual.pathJoin(dirPath, fileFullName)
            );
        },
    };
});

const { importArchiveFiles } = await import('./appArchiveHelpers');

const WINDOWS_DATA_DIR = String.raw`C:\Users\x\data`;
const dirPathByKind = new Map([
    ['document', '/Volumes/USB/data/documents'],
    ['video', '/Volumes/USB/data/videos'],
] as const);

beforeEach(() => {
    h.sessionData.defaultStorageDirPath = '/Volumes/USB/data';
    h.copiedTo.length = 0;
    h.importedPathByName.clear();
});

describe('importArchiveFiles across operating systems', () => {
    test('names the file after the Windows path, not WITH it', async () => {
        await importArchiveFiles(
            '/tmp/extract',
            [
                {
                    originalPath: String.raw`${WINDOWS_DATA_DIR}\documents\Song.ows`,
                    archivePath: 'files/001-Song.ows',
                    kind: 'document',
                },
            ],
            new Map(dirPathByKind),
        );
        expect(h.copiedTo).toEqual([
            {
                dirPath: '/Volumes/USB/data/documents',
                fileFullName: 'Song.ows',
            },
        ]);
    });

    test('cleans a name this machine would refuse', async () => {
        await importArchiveFiles(
            '/tmp/extract',
            [
                {
                    originalPath: '/home/me/data/documents/What?.ows',
                    archivePath: 'files/001-What_.ows',
                    kind: 'document',
                },
            ],
            new Map(dirPathByKind),
        );
        expect(h.copiedTo[0].fileFullName).toBe('What.ows');
    });

    test("finds a document's own media by the path it has HERE", async () => {
        // Imported beside this machine's own, different `intro.mp4`.
        h.importedPathByName.set(
            'intro.mp4',
            '/Volumes/USB/data/videos/intro (1).mp4',
        );
        const { localFilePathByOriginalPath } = await importArchiveFiles(
            '/tmp/extract',
            [
                {
                    originalPath: String.raw`${WINDOWS_DATA_DIR}\videos\intro.mp4`,
                    archivePath: 'files/001-intro.mp4',
                    kind: 'video',
                },
            ],
            new Map(dirPathByKind),
            WINDOWS_DATA_DIR,
        );
        // The document says `$DATA_DIR_PATH\videos\intro.mp4`, which reads
        // back on this machine as the path below.
        expect(
            localFilePathByOriginalPath.get(
                '/Volumes/USB/data/videos/intro.mp4',
            ),
        ).toBe('/Volumes/USB/data/videos/intro (1).mp4');
        expect(
            localFilePathByOriginalPath.get(
                String.raw`${WINDOWS_DATA_DIR}\videos\intro.mp4`,
            ),
        ).toBe('/Volumes/USB/data/videos/intro (1).mp4');
    });

    test('a bundle from before the data folder was recorded keys as before', async () => {
        const { localFilePathByOriginalPath } = await importArchiveFiles(
            '/tmp/extract',
            [
                {
                    originalPath: String.raw`${WINDOWS_DATA_DIR}\videos\intro.mp4`,
                    archivePath: 'files/001-intro.mp4',
                    kind: 'video',
                },
            ],
            new Map(dirPathByKind),
        );
        expect([...localFilePathByOriginalPath.keys()]).toEqual([
            String.raw`${WINDOWS_DATA_DIR}\videos\intro.mp4`,
        ]);
    });
});
