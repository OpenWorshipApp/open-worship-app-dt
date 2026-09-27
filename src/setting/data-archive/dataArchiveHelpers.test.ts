// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

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

// What the archive is built out of, captured rather than run: the point of
// these cases is WHICH entries each of the two tar passes is given.
const h = vi.hoisted(() => {
    return {
        // Typed, so the cases below can read the arguments back off the call.
        tarCreate: vi.fn(
            async (
                _inputDir: string,
                _outputFilePath: string,
                _files: string[],
                _isGzip?: boolean,
                _excludeNamePatterns?: string[],
                _excludeEntryPaths?: string[],
            ) => {},
        ),
        tarAppend: vi.fn(
            async (
                _archiveFilePath: string,
                _inputDir: string,
                _files: string[],
            ) => {},
        ),
        written: [] as { filePath: string; text: string }[],
        listed: new Map<string, { name: string; isFile: boolean }[]>(),
        heads: new Map<string, string | null>(),
        saved: new Map<string, string | null>(),
    };
});

vi.mock('../../server/appHelpers', () => ({
    tarCreate: h.tarCreate,
    tarAppend: h.tarAppend,
    tarExtract: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
}));

vi.mock('../../server/fileHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../server/fileHelpers')>();
    return {
        ...actual,
        getDownloadPath: () => '/home/me/Downloads',
        fsList: async (dirPath: string) => {
            return h.listed.get(dirPath) ?? [];
        },
        fsCreateFile: async (filePath: string, text: string) => {
            h.written.push({ filePath, text });
            return true;
        },
    };
});

vi.mock('../../helper/appArchiveHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../helper/appArchiveHelpers')>();
    return {
        ...actual,
        createWorkDir: async () => '/tmp/staging',
        safeDeleteDir: async () => {},
        writeArchiveManifest: async () => {},
        genNextArchiveFilePath: async (
            dirPath: string,
            fileFullName: string,
        ) => {
            return `${dirPath}/${fileFullName}`;
        },
    };
});

vi.mock(
    '../../editing-manager/EditingHistoryManager',
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import('../../editing-manager/EditingHistoryManager')
            >();
        return {
            ...actual,
            default: {
                getInstance: (filePath: string) => ({
                    getCurrentHistory: async () =>
                        h.heads.get(filePath) ?? null,
                    getOriginalData: async () => h.saved.get(filePath) ?? null,
                }),
            },
        };
    },
);

const { toCommonAncestor, collectUnsavedDataEntries, createDataArchive } =
    await import('./dataArchiveHelpers');

function toNoteText(text: string, lastEditDate = '2026-09-27') {
    return JSON.stringify({ metadata: { lastEditDate }, items: [{ text }] });
}

const documentsFolder = {
    dataDirectory: { settingName: 'documents-dir' },
    dirPath: '/home/me/data/documents',
} as any;

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

// An editable document keeps what was typed into it in its editing history
// until somebody presses Save, and this archive is written straight from the
// folders -- so without this a backup taken before a service carried the
// notes as they were that morning.
describe('a data archive carries the LIVE state of an unsaved document', () => {
    beforeEach(() => {
        h.tarCreate.mockClear();
        h.tarAppend.mockClear();
        h.written.length = 0;
        h.listed.clear();
        h.heads.clear();
        h.saved.clear();
        h.listed.set('/home/me/data/documents', [
            { name: 'sermon.ows', isFile: true },
            { name: 'sermon.ows.histories', isFile: false },
            { name: 'clean.ows', isFile: true },
            { name: 'clean.ows.histories', isFile: false },
        ]);
        h.saved.set('/home/me/data/documents/sermon.ows', toNoteText('saved'));
        h.heads.set('/home/me/data/documents/sermon.ows', toNoteText('typed'));
        h.saved.set('/home/me/data/documents/clean.ows', toNoteText('same'));
        h.heads.set('/home/me/data/documents/clean.ows', toNoteText('same'));
    });

    test('names only the documents whose head differs from the file', async () => {
        expect(
            await collectUnsavedDataEntries([documentsFolder], ['documents']),
        ).toEqual([
            {
                entryPath: 'documents/sermon.ows',
                text: toNoteText('typed'),
            },
        ]);
    });

    test('a head that differs only by its edit date is not unsaved', async () => {
        // `metadata.lastEditDate` moves on its own, so a raw compare would
        // call every document ever opened modified forever.
        h.heads.set(
            '/home/me/data/documents/sermon.ows',
            toNoteText('saved', '2026-09-28'),
        );
        expect(
            await collectUnsavedDataEntries([documentsFolder], ['documents']),
        ).toEqual([]);
    });

    test('a folder archived file by file holds no documents to look at', async () => {
        const bibleFolder = {
            ...documentsFolder,
            dataDirectory: {
                settingName: 'bible-dir',
                fileNamePattern: /\.xml$/,
            },
        };
        expect(
            await collectUnsavedDataEntries([bibleFolder], ['bibles']),
        ).toEqual([]);
    });

    test('the file is written once: skipped by the pass that copies, appended from its head', async () => {
        await createDataArchive([documentsFolder]);

        const [, , files, , , excludeEntryPaths] = h.tarCreate.mock.calls[0];
        expect(files).toEqual(['documents']);
        expect(excludeEntryPaths).toEqual(['documents/sermon.ows']);

        // the head's own text, under the file's own name
        expect(h.written).toEqual([
            {
                filePath: '/tmp/staging/documents/sermon.ows',
                text: toNoteText('typed'),
            },
        ]);
        const [, , appended] = h.tarAppend.mock.calls[0];
        expect(appended).toEqual(['manifest.json', 'documents/sermon.ows']);
    });

    test('nothing pending changes nothing about the archive', async () => {
        h.heads.set('/home/me/data/documents/sermon.ows', toNoteText('saved'));
        await createDataArchive([documentsFolder]);

        const [, , , , , excludeEntryPaths] = h.tarCreate.mock.calls[0];
        expect(excludeEntryPaths).toEqual([]);
        expect(h.written).toEqual([]);
        const [, , appended] = h.tarAppend.mock.calls[0];
        expect(appended).toEqual(['manifest.json']);
    });
});
