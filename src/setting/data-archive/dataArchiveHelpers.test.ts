// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    ensureDirectoryMock,
    fsCheckDirExistMock,
    fsCheckFileExistMock,
    fsCloneFileMock,
    fsCreateFileMock,
    fsDeleteDirMock,
    fsGetFileSizeMock,
    fsListMock,
    fsReadFileMock,
    getFileMD5Mock,
    genNextFilePathMock,
    tarAppendMock,
    tarCreateMock,
    tarExtractMock,
    encryptFileMock,
    decryptFileMock,
    fsDeleteFileMock,
    getDirPathBySettingNameMock,
} = vi.hoisted(() => ({
    ensureDirectoryMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsGetFileSizeMock: vi.fn(),
    fsListMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    getFileMD5Mock: vi.fn(),
    genNextFilePathMock: vi.fn(),
    tarAppendMock: vi.fn(),
    tarCreateMock: vi.fn(),
    tarExtractMock: vi.fn(),
    encryptFileMock: vi.fn(),
    decryptFileMock: vi.fn(),
    fsDeleteFileMock: vi.fn(),
    getDirPathBySettingNameMock: vi.fn(),
}));

const pathJoinMock = (...parts: string[]) => parts.join('\\');

vi.mock('../../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn((filePath: string) => ({
            filePath,
            genNextFilePath: () => genNextFilePathMock(filePath),
        })),
    },
}));

vi.mock('../../helper/DirSource', () => ({
    default: { getDirPathBySettingName: getDirPathBySettingNameMock },
}));

// The app-managed bible data folder resolves its own path from the parent
// directory (it has no directory setting to read), and that is the module it
// asks — dynamically, so this mock only has to exist, not to be light.
vi.mock('../directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get defaultStorage() {
            return 'C:\\Users\\me\\Desktop\\open-worship-data';
        },
    },
}));

vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
    tarAppend: tarAppendMock,
    tarCreate: tarCreateMock,
    tarExtract: tarExtractMock,
    // A plain arrow, not a `vi.fn`: `mockReset` wipes implementations before
    // every test, and an undefined answer here reads as "protected".
    checkIsEncryptedFile: async () => false,
    encryptFile: encryptFileMock,
    decryptFile: decryptFileMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    checkIsHiddenName: (fileFullName: string) => fileFullName.startsWith('.'),
    ensureDirectory: ensureDirectoryMock,
    fsCheckDirExist: fsCheckDirExistMock,
    fsCheckFileExist: fsCheckFileExistMock,
    fsCloneFile: fsCloneFileMock,
    fsCreateFile: fsCreateFileMock,
    fsDeleteDir: fsDeleteDirMock,
    fsDeleteFile: fsDeleteFileMock,
    fsGetFileSize: fsGetFileSizeMock,
    fsList: fsListMock,
    fsReadFile: fsReadFileMock,
    getDownloadPath: () => 'C:\\downloads',
    getFileMD5: getFileMD5Mock,
    getTempPath: () => 'C:\\temp',
    pathBasename: (filePath: string) => filePath.split('\\').pop(),
    pathJoin: pathJoinMock,
    pathSeparator: '\\',
}));

async function loadModule() {
    vi.resetModules();
    return await import('./dataArchiveHelpers');
}

const DATA_DIR = 'C:\\Users\\me\\Desktop\\open-worship-data';
const EXTRACT_DIR = 'C:\\temp\\owadata-import-run-id';

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
    genNextFilePathMock.mockImplementation(async (filePath: string) => {
        return filePath;
    });
    fsCheckDirExistMock.mockResolvedValue(true);
    fsCheckFileExistMock.mockResolvedValue(false);
    fsListMock.mockResolvedValue([]);
    // Size is the free first half of the same-contents check, so an identical
    // size is the default and MD5 decides in the tests that care.
    fsGetFileSizeMock.mockResolvedValue(1024);
});

/** `fsList` entries for a folder holding these files and sub-folders. */
function genListEntries(fileNames: string[], dirNames: string[] = []) {
    return [
        ...fileNames.map((name) => {
            return { name, isFile: true, isDirectory: false };
        }),
        ...dirNames.map((name) => {
            return { name, isFile: false, isDirectory: true };
        }),
    ];
}

describe('toCommonAncestor', () => {
    test('archives from the shared parent with no staging copy', async () => {
        const { toCommonAncestor } = await loadModule();

        expect(
            toCommonAncestor([
                `${DATA_DIR}\\documents`,
                `${DATA_DIR}\\images`,
                `${DATA_DIR}\\videos`,
            ]),
        ).toEqual({
            ancestorDir: DATA_DIR,
            entries: ['documents', 'images', 'videos'],
        });
    });

    test('keeps a name for a single folder', async () => {
        const { toCommonAncestor } = await loadModule();

        // The prefix must stop short of the whole path, or the only entry
        // would be the empty string and the archive would have no folder in it.
        expect(toCommonAncestor([`${DATA_DIR}\\documents`])).toEqual({
            ancestorDir: DATA_DIR,
            entries: ['documents'],
        });
    });

    test('handles a folder moved outside the data directory', async () => {
        const { toCommonAncestor } = await loadModule();

        expect(
            toCommonAncestor([
                `${DATA_DIR}\\documents`,
                'C:\\Users\\me\\Videos\\worship',
            ]),
        ).toEqual({
            ancestorDir: 'C:\\Users\\me',
            entries: ['Desktop/open-worship-data/documents', 'Videos/worship'],
        });
    });

    test('refuses folders on different drives', async () => {
        const { toCommonAncestor } = await loadModule();

        expect(() => {
            return toCommonAncestor([`${DATA_DIR}\\documents`, 'D:\\media']);
        }).toThrowError(/no common parent folder/);
    });
});

describe('getExportableDataFolders', () => {
    /** The bible data folder as it really is: XMLs beside downloaded bibles. */
    function mockBibleDataFolder(fileNames: string[]) {
        fsListMock.mockImplementation(async (dirPath: string) => {
            return dirPath.endsWith('bibles-data')
                ? genListEntries(fileNames, ['KJV', 'ESV'])
                : [];
        });
    }

    test('offers every folder, including the ones with no path setting', async () => {
        getDirPathBySettingNameMock.mockImplementation(
            (settingName: string) => {
                return `${DATA_DIR}\\${settingName}`;
            },
        );
        mockBibleDataFolder([
            'KJV.xml',
            'Berean.XML',
            'notes.txt',
            '._KJV.xml',
        ]);

        const { getExportableDataFolders } = await loadModule();
        const folders = await getExportableDataFolders();
        const titles = folders.map(({ dataDirectory }) => {
            return dataDirectory.title;
        });

        // The two that used to be silently absent from a "whole data" backup:
        // the web backgrounds folder, and the bible XMLs — which are not
        // reachable through a directory setting at all.
        expect(titles).toContain('Background Webs');
        expect(titles).toContain('Bibles XML');
        const bibleXmls = folders.find(({ dataDirectory }) => {
            return dataDirectory.title === 'Bibles XML';
        });
        expect(bibleXmls?.dirPath).toBe(`${DATA_DIR}\\bibles-data`);
        // `.XML` counts, `.txt` does not, the `._` stub does not even though it
        // ends in `.xml`, and the downloaded-bible sub-folders are not files so
        // they never come up.
        expect(bibleXmls?.fileNames).toEqual(['KJV.xml', 'Berean.XML']);
    });

    test('leaves out a folder whose path has gone missing', async () => {
        getDirPathBySettingNameMock.mockReturnValue('');
        fsCheckDirExistMock.mockImplementation(async (dirPath: string) => {
            return dirPath.endsWith('bibles-data');
        });
        mockBibleDataFolder(['KJV.xml']);

        const { getExportableDataFolders } = await loadModule();
        const folders = await getExportableDataFolders();

        expect(
            folders.map(({ dataDirectory }) => {
                return dataDirectory.title;
            }),
        ).toEqual(['Bibles XML']);
    });

    test('leaves out the bible folder when it holds only downloaded bibles', async () => {
        getDirPathBySettingNameMock.mockReturnValue('');
        fsCheckDirExistMock.mockImplementation(async (dirPath: string) => {
            return dirPath.endsWith('bibles-data');
        });
        mockBibleDataFolder([]);

        const { getExportableDataFolders } = await loadModule();

        // Nothing of the user's own in there — a row that would restore
        // nothing is not worth offering.
        expect(await getExportableDataFolders()).toEqual([]);
    });
});

describe('createDataArchive', () => {
    test('writes the tar from the data folder, then appends the manifest', async () => {
        const { createDataArchive } = await loadModule();

        const archiveFilePath = await createDataArchive([
            {
                dataDirectory: {
                    title: 'Documents',
                    settingName: 'select-dir-app-document',
                    defaultDirName: 'documents',
                    iconClassName: 'bi-file-earmark-text',
                },
                dirPath: `${DATA_DIR}\\documents`,
            },
            {
                dataDirectory: {
                    title: 'Background Videos',
                    settingName: 'select-dir-video-bg',
                    defaultDirName: 'videos',
                    iconClassName: 'bi-film',
                },
                dirPath: `${DATA_DIR}\\videos`,
            },
        ]);

        expect(archiveFilePath).toBe(
            'C:\\downloads\\open-worship-data.owadata.tar',
        );
        // The user's own folder is the tar cwd — nothing is copied first — and
        // the regenerable caches are filtered out.
        expect(tarCreateMock).toHaveBeenCalledWith(
            DATA_DIR,
            'C:\\downloads\\open-worship-data.owadata.tar',
            ['documents', 'videos'],
            false,
            expect.arrayContaining(['\\.[^.]+(\\.histories|-images|-htmls)$']),
        );
        // What that pattern has to mean: the three regenerable caches are cut,
        // and a folder the user happened to name `wedding-images` is not.
        const [excludePattern] = tarCreateMock.mock.calls[0][4];
        const excludeRegExp = new RegExp(excludePattern);
        for (const name of [
            'a.ows.histories',
            'a.pdf-images',
            'a.pptx-htmls',
            'a.docx-docx-htmls',
        ]) {
            expect(excludeRegExp.test(name)).toBe(true);
        }
        for (const name of ['wedding-images', 'notes-htmls', 'a.ows']) {
            expect(excludeRegExp.test(name)).toBe(false);
        }
        // The second pattern is the app's hidden-name rule: the `._*` stubs a
        // macOS machine or a USB round-trip leaves behind never go in.
        const hiddenRegExp = new RegExp(tarCreateMock.mock.calls[0][4][1]);
        for (const name of ['._clock.html', '.DS_Store', '.git']) {
            expect(hiddenRegExp.test(name)).toBe(true);
        }
        for (const name of ['clock.html', 'a.ows', 'my.song.owl']) {
            expect(hiddenRegExp.test(name)).toBe(false);
        }
        // Not gzipped, because the manifest can only be appended to a plain tar.
        expect(tarCreateMock.mock.calls[0][3]).toBe(false);
        const manifestCall = fsCreateFileMock.mock.calls.find((call) => {
            return String(call[0]).endsWith('manifest.json');
        });
        expect(JSON.parse(String(manifestCall?.[1]))).toEqual({
            version: 1,
            kind: 'app-data',
            folders: [
                { settingName: 'select-dir-app-document', entry: 'documents' },
                { settingName: 'select-dir-video-bg', entry: 'videos' },
            ],
        });
        expect(tarAppendMock).toHaveBeenCalledWith(
            'C:\\downloads\\open-worship-data.owadata.tar',
            expect.stringContaining('owadata-manifest'),
            ['manifest.json'],
        );
        // No password was given, so nothing was wrapped and the archive is byte
        // for byte what this export has always written.
        expect(encryptFileMock).not.toHaveBeenCalled();
    });

    test('wraps the finished tar when a password is given', async () => {
        const { createDataArchive } = await loadModule();

        const archiveFilePath = await createDataArchive(
            [
                {
                    dataDirectory: {
                        title: 'Documents',
                        settingName: 'select-dir-app-document',
                        defaultDirName: 'documents',
                        iconClassName: 'bi-file-earmark-text',
                    },
                    dirPath: `${DATA_DIR}\\documents`,
                },
            ],
            'In Jesus Christ',
        );

        const finalFilePath = 'C:\\downloads\\open-worship-data.owadata.enc';
        const plainFilePath = `${finalFilePath}.part`;
        expect(archiveFilePath).toBe(finalFilePath);
        // The plain tar is built BESIDE the destination, not in the temp
        // folder: this archive has no staging copy by design and can be
        // gigabytes, so both files stay on the volume the operator chose.
        expect(tarCreateMock.mock.calls[0][1]).toBe(plainFilePath);
        // The manifest is appended BEFORE the wrap — `tar.r` cannot append to
        // ciphertext.
        expect(tarAppendMock).toHaveBeenCalledWith(
            plainFilePath,
            expect.stringContaining('owadata-manifest'),
            ['manifest.json'],
        );
        expect(encryptFileMock).toHaveBeenCalledWith(
            plainFilePath,
            finalFilePath,
            'In Jesus Christ',
        );
        // The unprotected copy is the whole point of the exercise and does not
        // get to outlive the protected one.
        expect(fsDeleteFileMock).toHaveBeenCalledWith(plainFilePath);
    });

    test('leaves no half-built `.part` behind when the wrap fails', async () => {
        encryptFileMock.mockRejectedValue(new Error('disk full'));
        const { createDataArchive } = await loadModule();

        await expect(
            createDataArchive(
                [
                    {
                        dataDirectory: {
                            title: 'Documents',
                            settingName: 'select-dir-app-document',
                            defaultDirName: 'documents',
                            iconClassName: 'bi-file-earmark-text',
                        },
                        dirPath: `${DATA_DIR}\\documents`,
                    },
                ],
                'In Jesus Christ',
            ),
        ).rejects.toThrow('disk full');

        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            'C:\\downloads\\open-worship-data.owadata.enc.part',
        );
    });
});

describe('createDataArchive, filtered folder', () => {
    const BIBLE_XML_DIRECTORY = {
        title: 'Bibles XML',
        settingName: 'app-dir-bible-data',
        defaultDirName: 'bibles-data',
        iconClassName: 'bi-filetype-xml',
        fileNamePattern: /\.xml$/i,
    };

    test('writes the matching files, and the FOLDER into the manifest', async () => {
        const { createDataArchive } = await loadModule();

        await createDataArchive([
            {
                dataDirectory: BIBLE_XML_DIRECTORY,
                dirPath: `${DATA_DIR}\\bibles-data`,
                fileNames: ['KJV.xml', 'Berean.XML'],
            },
            {
                dataDirectory: {
                    title: 'Documents',
                    settingName: 'select-dir-app-document',
                    defaultDirName: 'documents',
                    iconClassName: 'bi-file-earmark-text',
                },
                dirPath: `${DATA_DIR}\\documents`,
            },
        ]);

        // The hundreds of MB of downloaded bible databases sitting in the same
        // folder are named by nothing, so tar never walks them.
        expect(tarCreateMock.mock.calls[0][2]).toEqual([
            'bibles-data/KJV.xml',
            'bibles-data/Berean.XML',
            'documents',
        ]);
        // Import extracts by entry PREFIX, so the manifest still says the
        // folder and those files land back inside it.
        const manifestCall = fsCreateFileMock.mock.calls.find((call) => {
            return String(call[0]).endsWith('manifest.json');
        });
        expect(JSON.parse(String(manifestCall?.[1])).folders).toEqual([
            { settingName: 'app-dir-bible-data', entry: 'bibles-data' },
            { settingName: 'select-dir-app-document', entry: 'documents' },
        ]);
    });

    test('archives nothing of it when its files were never listed', async () => {
        const { createDataArchive } = await loadModule();

        await createDataArchive([
            {
                dataDirectory: BIBLE_XML_DIRECTORY,
                dirPath: `${DATA_DIR}\\bibles-data`,
            },
        ]);

        // Never the whole folder: the fallback has to be "nothing", or one
        // caller that forgets to list puts the downloaded bibles back in.
        expect(tarCreateMock.mock.calls[0][2]).toEqual([]);
    });
});

describe('readDataArchiveManifest', () => {
    function mockManifest(manifest: unknown) {
        fsCheckFileExistMock.mockResolvedValue(true);
        fsReadFileMock.mockResolvedValue(JSON.stringify(manifest));
    }

    test('unpacks ONLY the manifest', async () => {
        mockManifest({
            version: 1,
            kind: 'app-data',
            folders: [
                { settingName: 'select-dir-app-document', entry: 'documents' },
            ],
        });

        const { readDataArchiveManifest } = await loadModule();
        const manifest = await readDataArchiveManifest('C:\\downloads\\a.tar');

        expect(tarExtractMock).toHaveBeenCalledWith(
            'C:\\downloads\\a.tar',
            expect.stringContaining('owadata-read'),
            ['manifest.json'],
        );
        expect(manifest.folders).toHaveLength(1);
    });

    test('rejects a foreign archive', async () => {
        mockManifest({ version: 1, kind: 'presentingFlow' });

        const { readDataArchiveManifest } = await loadModule();

        await expect(
            readDataArchiveManifest('C:\\downloads\\a.tar'),
        ).rejects.toThrowError(/Invalid data archive manifest/);
    });

    test('drops an entry that climbs out of the extract folder', async () => {
        mockManifest({
            version: 1,
            kind: 'app-data',
            folders: [
                { settingName: 'select-dir-app-document', entry: '../../evil' },
                { settingName: 'select-dir-video-bg', entry: 'videos' },
            ],
        });

        const { readDataArchiveManifest } = await loadModule();
        const manifest = await readDataArchiveManifest('C:\\downloads\\a.tar');

        expect(manifest.folders).toEqual([
            { settingName: 'select-dir-video-bg', entry: 'videos' },
        ]);
    });
});

describe('importDataArchive', () => {
    const FOLDERS = [
        { settingName: 'select-dir-app-document', entry: 'documents' },
    ];

    test('fails before unpacking when a destination is not set', async () => {
        getDirPathBySettingNameMock.mockReturnValue('');

        const { importDataArchive } = await loadModule();

        await expect(
            importDataArchive('C:\\downloads\\a.tar', FOLDERS),
        ).rejects.toThrowError(/No folder is selected yet for: Documents/);
        expect(tarExtractMock).not.toHaveBeenCalled();
    });

    test('always writes a new document, even a byte-identical one', async () => {
        getDirPathBySettingNameMock.mockReturnValue(`${DATA_DIR}\\documents`);
        fsListMock.mockResolvedValue(genListEntries(['same.ows', 'new.ows']));
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.endsWith('same.ows');
        });
        getFileMD5Mock.mockResolvedValue('identical');
        genNextFilePathMock.mockImplementation(async (filePath: string) => {
            return filePath.endsWith('same.ows')
                ? `${DATA_DIR}\\documents\\same (1).ows`
                : filePath;
        });

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive('C:\\downloads\\a.tar', FOLDERS);

        expect(tarExtractMock).toHaveBeenCalledWith(
            'C:\\downloads\\a.tar',
            EXTRACT_DIR,
            ['documents'],
        );
        // A document is the operator's own work: the namesake is left as it is
        // and the imported one lands beside it rather than being skipped.
        expect(counts).toEqual({ copied: 2, reused: 0 });
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}\\documents\\same.ows`,
            `${DATA_DIR}\\documents\\same (1).ows`,
        );
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}\\documents\\new.ows`,
            `${DATA_DIR}\\documents\\new.ows`,
        );
        // Never hashed — the answer does not depend on the contents.
        expect(getFileMD5Mock).not.toHaveBeenCalled();
    });

    test('leaves an identical background video alone', async () => {
        const videoFolders = [
            { settingName: 'select-dir-video-bg', entry: 'videos' },
        ];
        getDirPathBySettingNameMock.mockReturnValue(`${DATA_DIR}\\videos`);
        fsListMock.mockResolvedValue(genListEntries(['same.mp4', 'new.mp4']));
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.endsWith('same.mp4');
        });
        getFileMD5Mock.mockResolvedValue('identical');

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive(
            'C:\\downloads\\a.tar',
            videoFolders,
        );

        // Media still dedupes: a second copy of a gigabyte video is the thing
        // worth avoiding on a machine that is tight on disk.
        expect(counts).toEqual({ copied: 1, reused: 1 });
        expect(fsCloneFileMock).toHaveBeenCalledTimes(1);
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}\\videos\\new.mp4`,
            `${DATA_DIR}\\videos\\new.mp4`,
        );
    });

    test('keeps a background video whose contents differ', async () => {
        const videoFolders = [
            { settingName: 'select-dir-video-bg', entry: 'videos' },
        ];
        getDirPathBySettingNameMock.mockReturnValue(`${DATA_DIR}\\videos`);
        fsListMock.mockResolvedValue(genListEntries(['a.mp4']));
        fsCheckFileExistMock.mockResolvedValue(true);
        getFileMD5Mock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR) ? 'archived' : 'local';
        });
        genNextFilePathMock.mockResolvedValue(`${DATA_DIR}\\videos\\a (1).mp4`);

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive(
            'C:\\downloads\\a.tar',
            videoFolders,
        );

        expect(counts).toEqual({ copied: 1, reused: 0 });
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}\\videos\\a.mp4`,
            `${DATA_DIR}\\videos\\a (1).mp4`,
        );
    });

    test('skips hashing a video whose size already differs', async () => {
        const videoFolders = [
            { settingName: 'select-dir-video-bg', entry: 'videos' },
        ];
        getDirPathBySettingNameMock.mockReturnValue(`${DATA_DIR}\\videos`);
        fsListMock.mockResolvedValue(genListEntries(['a.mp4']));
        fsCheckFileExistMock.mockResolvedValue(true);
        fsGetFileSizeMock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR) ? 2048 : 4096;
        });
        genNextFilePathMock.mockResolvedValue(`${DATA_DIR}\\videos\\a (1).mp4`);

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive(
            'C:\\downloads\\a.tar',
            videoFolders,
        );

        expect(counts).toEqual({ copied: 1, reused: 0 });
        // A differing size settles it without reading either file through.
        expect(getFileMD5Mock).not.toHaveBeenCalled();
    });

    test('never restores a dot-prefixed file from an older archive', async () => {
        getDirPathBySettingNameMock.mockReturnValue(`${DATA_DIR}\\documents`);
        fsListMock.mockResolvedValue(
            genListEntries(['a.ows', '._a.ows', '.DS_Store']),
        );

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive('C:\\downloads\\a.tar', FOLDERS);

        // An archive written before those names were excluded still holds
        // them; putting them back would restore what the app ignores anyway.
        expect(counts).toEqual({ copied: 1, reused: 0 });
        expect(fsCloneFileMock).toHaveBeenCalledTimes(1);
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}\\documents\\a.ows`,
            `${DATA_DIR}\\documents\\a.ows`,
        );
    });

    test('restores the bible data folder with no directory setting set', async () => {
        // Nothing points at it — the app fixed its place — so the "choose it in
        // Path Settings first" guard must not fire for it.
        getDirPathBySettingNameMock.mockReturnValue('');
        fsListMock.mockResolvedValue(genListEntries(['KJV.xml']));

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive('C:\\downloads\\a.tar', [
            { settingName: 'app-dir-bible-data', entry: 'bibles-data' },
        ]);

        expect(counts).toEqual({ copied: 1, reused: 0 });
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}\\bibles-data\\KJV.xml`,
            `${DATA_DIR}\\bibles-data\\KJV.xml`,
        );
    });

    test('recurses into sub-folders', async () => {
        getDirPathBySettingNameMock.mockReturnValue(`${DATA_DIR}\\documents`);
        fsListMock.mockImplementation(async (dirPath: string) => {
            if (dirPath.endsWith('nested')) {
                return genListEntries(['deep.ows']);
            }
            return dirPath.endsWith('documents')
                ? genListEntries([], ['nested'])
                : [];
        });

        const { importDataArchive } = await loadModule();
        const counts = await importDataArchive('C:\\downloads\\a.tar', FOLDERS);

        expect(counts).toEqual({ copied: 1, reused: 0 });
        expect(ensureDirectoryMock).toHaveBeenCalledWith(
            `${DATA_DIR}\\documents\\nested`,
        );
    });
});
