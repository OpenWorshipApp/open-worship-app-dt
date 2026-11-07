import { beforeEach, describe, expect, test, vi } from 'vitest';

// The file half of sharing a pack: picking one, peeking at one json inside it,
// asking about one nobody vouches for, and copying one out to Downloads.

const h = vi.hoisted(() => {
    return {
        files: new Map<string, string>(),
        dirs: new Set<string>(),
        tarExtract: vi.fn(),
        // What the archive holds, by entry name.
        archive: {} as Record<string, string>,
        isExtractFailing: false,
        selectFiles: vi.fn(),
        showAppConfirm: vi.fn(),
        fsCopyFilePathToPath: vi.fn(),
        showSimpleToast: vi.fn(),
        showFileOrDirExplorer: vi.fn(),
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./loggerHelpers', () => ({ appError: vi.fn() }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirm,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: h.showFileOrDirExplorer,
    tarExtract: async (
        filePath: string,
        outputDir: string,
        entries?: string[],
    ) => {
        h.tarExtract(filePath, outputDir, entries);
        if (h.isExtractFailing) {
            throw new Error('TAR_BAD_ARCHIVE');
        }
        for (const [name, text] of Object.entries(h.archive)) {
            if (entries === undefined || entries.includes(name)) {
                h.files.set(`${outputDir}/${name}`, text);
            }
        }
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    getTempPath: () => '/tmp',
    getDownloadPath: () => '/home/me/Downloads',
    ensureDirectory: async (dirPath: string) => {
        h.dirs.add(dirPath);
    },
    fsDeleteDir: async (dirPath: string) => {
        h.dirs.delete(dirPath);
        for (const filePath of [...h.files.keys()]) {
            if (filePath.startsWith(`${dirPath}/`)) {
                h.files.delete(filePath);
            }
        }
    },
    fsReadFile: async (filePath: string) => {
        const text = h.files.get(filePath);
        if (text === undefined) {
            throw new Error(`ENOENT ${filePath}`);
        }
        return text;
    },
    selectFiles: h.selectFiles,
    fsCopyFilePathToPath: h.fsCopyFilePathToPath,
}));

import {
    confirmUnverifiedPackFile,
    exportPackFile,
    pickPackFile,
    readPackFileJson,
    toNotInstallablePackMessage,
} from './packFileHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    h.files.clear();
    h.dirs.clear();
    h.archive = {};
    h.isExtractFailing = false;
});

describe('reading one json out of a pack', () => {
    test('only that entry is unpacked, into a folder of its own that is gone after', async () => {
        h.archive = {
            'info.json': '{"version":"0.0.4","platform":"win"}',
            'yt/yt-dlp.exe': 'a big program',
        };

        const info = await readPackFileJson('/usb/bin.tar.gz', 'info.json');

        expect(info).toEqual({ version: '0.0.4', platform: 'win' });
        const [filePath, workDirPath, entries] = h.tarExtract.mock.calls[0];
        expect(filePath).toBe('/usb/bin.tar.gz');
        expect(workDirPath).toMatch(/^\/tmp\/owa-pack-check-/);
        expect(entries).toEqual(['info.json']);
        // Nothing left behind, the program never unpacked at all.
        expect(h.dirs.size).toBe(0);
        expect(h.files.size).toBe(0);
    });

    test('two reads never share a folder', async () => {
        h.archive = { 'meta.json': '{}' };
        await readPackFileJson('/a.tar.gz', 'meta.json');
        await readPackFileJson('/b.tar.gz', 'meta.json');
        const [first, second] = h.tarExtract.mock.calls.map((call) => {
            return call[1];
        });
        expect(first).not.toBe(second);
    });

    test.each([
        ['the entry is missing', {}, false],
        ['it is not json', { 'meta.json': 'not json' }, false],
        ['the file is no archive', {}, true],
    ])(
        'null when %s, and the folder still goes',
        async (_case, archive, isFailing) => {
            h.archive = archive;
            h.isExtractFailing = isFailing;
            await expect(
                readPackFileJson('/usb/photo.tar.gz', 'meta.json'),
            ).resolves.toBeNull();
            expect(h.dirs.size).toBe(0);
        },
    );
});

describe('picking and asking', () => {
    test('the first file picked, or null when the dialog was closed', async () => {
        h.selectFiles.mockResolvedValue(['/usb/a.tar.gz', '/usb/b.tar.gz']);
        await expect(pickPackFile()).resolves.toBe('/usb/a.tar.gz');
        expect(h.selectFiles.mock.calls[0][0][0].extensions).toContain('gz');

        h.selectFiles.mockResolvedValue([]);
        await expect(pickPackFile()).resolves.toBeNull();
    });

    test('the question about an unverified file hands its buttons over as keys', async () => {
        h.showAppConfirm.mockResolvedValue(true);
        await expect(confirmUnverifiedPackFile()).resolves.toBe(true);
        const [title, body, options] = h.showAppConfirm.mock.calls[0];
        expect(title).toBe('Import');
        expect(body).toContain('someone you trust');
        // The confirm translates its own buttons: a translated label here
        // would be looked up again and throw in dev.
        expect(options).toEqual({
            cancelButtonLabel: 'Cancel',
            confirmButtonLabel: 'Import',
        });
    });

    test('why a file cannot be installed follows the sentence', () => {
        expect(toNotInstallablePackMessage('"x.tar.gz"')).toBe(
            'This file is not a pack this app can install: "x.tar.gz"',
        );
    });
});

describe('copying a pack out to pass on', () => {
    test('into Downloads under the name given, then shown there', async () => {
        h.fsCopyFilePathToPath.mockResolvedValue(
            '/home/me/Downloads/km-1.0.0 (1).tar.gz',
        );

        const filePath = await exportPackFile(
            'Languages',
            '/tmp/download.tar.gz',
            'km-1.0.0.tar.gz',
        );

        expect(filePath).toBe('/home/me/Downloads/km-1.0.0 (1).tar.gz');
        expect(h.fsCopyFilePathToPath).toHaveBeenCalledWith(
            '/tmp/download.tar.gz',
            '/home/me/Downloads',
            'km-1.0.0.tar.gz',
        );
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Languages',
            'Exported to /home/me/Downloads/km-1.0.0 (1).tar.gz',
        );
        expect(h.showFileOrDirExplorer).toHaveBeenCalledWith(
            '/home/me/Downloads/km-1.0.0 (1).tar.gz',
        );
    });

    test('a failed copy says nothing more and shows nothing', async () => {
        // The copy reports its own failure.
        h.fsCopyFilePathToPath.mockResolvedValue(null);
        await expect(
            exportPackFile('Languages', '/tmp/x.tar.gz', 'x.tar.gz'),
        ).resolves.toBeNull();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(h.showFileOrDirExplorer).not.toHaveBeenCalled();
    });
});
