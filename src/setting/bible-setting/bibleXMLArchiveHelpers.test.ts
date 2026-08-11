// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        existingFilePaths: new Set<string>(),
        bibleKeyByFilePath: new Map<string, string | null>(),
        installedBibleKeys: {} as { [bibleKey: string]: string },
        clonedFiles: [] as { source: string; destination: string }[],
        writtenManifests: [] as { stagingDir: string; manifest: any }[],
        tarCreateMock: vi.fn(),
        tarExtractMock: vi.fn(),
        openArchiveForReadingMock: vi.fn(),
        protectArchiveFileMock: vi.fn(),
        readArchiveManifestMock: vi.fn(),
        reset() {
            mocks.existingFilePaths.clear();
            mocks.bibleKeyByFilePath.clear();
            mocks.installedBibleKeys = {};
            mocks.clonedFiles = [];
            mocks.writtenManifests = [];
        },
    };
});

vi.mock('../../helper/appArchiveHelpers', () => ({
    ARCHIVE_FILES_DIR: 'files',
    ARCHIVE_VERSION: 1,
    MANIFEST_FILE_NAME: 'manifest.json',
    createWorkDir: vi.fn(async (prefix: string) => `/tmp/${prefix}-id`),
    safeDeleteDir: vi.fn(async () => {}),
    readArchiveManifest: mocks.readArchiveManifestMock,
    writeArchiveManifest: vi.fn(async (stagingDir: string, manifest: any) => {
        mocks.writtenManifests.push({ stagingDir, manifest });
    }),
}));

vi.mock('../../helper/archivePasswordHelpers', () => ({
    openArchiveForReading: mocks.openArchiveForReadingMock,
    protectArchiveFile: mocks.protectArchiveFileMock,
}));

vi.mock('../../server/appHelpers', () => ({
    tarCreate: mocks.tarCreateMock,
    tarExtract: mocks.tarExtractMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: vi.fn(async () => {}),
    fsCheckFileExist: vi.fn(async (filePath: string) => {
        return mocks.existingFilePaths.has(filePath);
    }),
    fsCloneFile: vi.fn(async (source: string, destination: string) => {
        mocks.clonedFiles.push({ source, destination });
        mocks.existingFilePaths.add(destination);
    }),
    getDownloadPath: () => '/downloads',
    pathBasename: (filePath: string) => filePath.split('/').pop() ?? '',
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('./bibleXMLJsonDataHelpers', () => ({
    getAllXMLFileKeys: vi.fn(async () => mocks.installedBibleKeys),
    getBibleKeyFromFile: vi.fn(async (filePath: string) => {
        return mocks.bibleKeyByFilePath.get(filePath) ?? null;
    }),
    getBibleHeadInfoFromFile: vi.fn(async (filePath: string) => {
        const bibleKey = mocks.bibleKeyByFilePath.get(filePath) ?? null;
        return bibleKey === null
            ? null
            : { bibleKey, title: `${bibleKey} Title` };
    }),
    bibleKeyToXMLFilePath: vi.fn(async (bibleKey: string) => {
        return `/bibles/${bibleKey}.xml`;
    }),
}));

async function loadModule() {
    return await import('./bibleXMLArchiveHelpers');
}

function toManifest(
    bibles: {
        bibleKey: string;
        archivePath: string;
        title?: string;
        fileFullName?: string;
    }[],
) {
    return {
        version: 1,
        itemKind: 'bible-xml',
        bibles: bibles.map((bible) => {
            return {
                title: '',
                fileFullName: `${bible.bibleKey}.xml`,
                ...bible,
            };
        }),
    };
}

describe('bibleXMLArchiveHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.reset();
    });

    test('recognises its own bundle name in every shape on disk', async () => {
        const { checkIsBibleXMLArchiveFileFullName } = await loadModule();

        expect(
            checkIsBibleXMLArchiveFileFullName('Bible Data.owabdata.tar.gz'),
        ).toBe(true);
        // The password protected shape of the same bundle.
        expect(
            checkIsBibleXMLArchiveFileFullName('Bible Data.owabdata.enc'),
        ).toBe(true);
        // What older builds wrote for a second export: the de-duplicating
        // suffix went in before the LAST dot.
        expect(
            checkIsBibleXMLArchiveFileFullName(
                'Bible Data.owabdata.tar (1).gz',
            ),
        ).toBe(true);
        // Another feature's bundle, and a plain file, are not ours.
        expect(
            checkIsBibleXMLArchiveFileFullName('Sunday.owbible.tar.gz'),
        ).toBe(false);
        expect(checkIsBibleXMLArchiveFileFullName('KJV.xml')).toBe(false);
    });

    test('names the bundle after whether it is protected', async () => {
        const { toBibleXMLArchiveFileName } = await loadModule();

        expect(toBibleXMLArchiveFileName('Bible Data')).toBe(
            'Bible Data.owabdata.tar.gz',
        );
        expect(toBibleXMLArchiveFileName('Bible Data', 'secret')).toBe(
            'Bible Data.owabdata.enc',
        );
        expect(toBibleXMLArchiveFileName(' Bible:/Data* ')).toBe(
            'Bible_Data.owabdata.tar.gz',
        );
    });

    test('stages every chosen bible and writes a manifest naming them', async () => {
        const { createBibleXMLArchive } = await loadModule();

        const archiveFilePath = await createBibleXMLArchive([
            {
                bibleKey: 'KJV',
                title: 'English KJV',
                filePath: '/bibles/a.xml',
            },
            { bibleKey: 'NIV', title: '', filePath: '/bibles/b.xml' },
        ]);

        expect(archiveFilePath).toBe('/downloads/Bible Data.owabdata.tar.gz');
        expect(mocks.clonedFiles).toEqual([
            {
                source: '/bibles/a.xml',
                destination: '/tmp/owabdata-export-id/files/001-KJV.xml',
            },
            {
                source: '/bibles/b.xml',
                destination: '/tmp/owabdata-export-id/files/002-NIV.xml',
            },
        ]);
        expect(mocks.writtenManifests[0].manifest).toEqual({
            version: 1,
            itemKind: 'bible-xml',
            bibles: [
                {
                    bibleKey: 'KJV',
                    title: 'English KJV',
                    fileFullName: 'KJV.xml',
                    archivePath: 'files/001-KJV.xml',
                },
                {
                    bibleKey: 'NIV',
                    title: '',
                    fileFullName: 'NIV.xml',
                    archivePath: 'files/002-NIV.xml',
                },
            ],
        });
        // An explicit entry list, so tar never packs anything else the staging
        // dir happens to hold.
        expect(mocks.tarCreateMock).toHaveBeenCalledWith(
            '/tmp/owabdata-export-id',
            '/downloads/Bible Data.owabdata.tar.gz',
            ['manifest.json', 'files'],
            true,
        );
        expect(mocks.protectArchiveFileMock).not.toHaveBeenCalled();
    });

    test('wraps a protected export and never leaves the plain tar in Downloads', async () => {
        const { createBibleXMLArchive } = await loadModule();
        mocks.protectArchiveFileMock.mockImplementation(
            async (_plain: string, output: string) => output,
        );

        const archiveFilePath = await createBibleXMLArchive(
            [{ bibleKey: 'KJV', title: '', filePath: '/bibles/a.xml' }],
            'secret',
        );

        expect(archiveFilePath).toBe('/downloads/Bible Data.owabdata.enc');
        // The plain tar is written INSIDE the staging dir, which is deleted in
        // `finally` either way.
        expect(mocks.tarCreateMock.mock.calls[0][1]).toBe(
            '/tmp/owabdata-export-id/plain-archive.tmp',
        );
        expect(mocks.protectArchiveFileMock).toHaveBeenCalledWith(
            '/tmp/owabdata-export-id/plain-archive.tmp',
            '/downloads/Bible Data.owabdata.enc',
            'secret',
        );
    });

    test('refuses another feature bundle and a cancelled password', async () => {
        const { openBibleXMLArchive } = await loadModule();
        mocks.openArchiveForReadingMock.mockResolvedValue({
            filePath: '/downloads/x.owabdata.tar.gz',
            dispose: async () => {},
        });
        mocks.readArchiveManifestMock.mockResolvedValue({
            version: 1,
            itemKind: 'document',
            bibles: [],
        });

        await expect(
            openBibleXMLArchive('/downloads/x.owabdata.tar.gz', '/tmp/e', 'T'),
        ).rejects.toThrow('not bible data');

        // A cancelled password prompt is not a failure and gets no manifest.
        mocks.openArchiveForReadingMock.mockResolvedValue(null);
        expect(
            await openBibleXMLArchive(
                '/downloads/x.owabdata.tar.gz',
                '/tmp/e',
                'T',
            ),
        ).toBeNull();
    });

    test('reds out an already-installed key regardless of its case', async () => {
        const { resolveBibleXMLImportEntries } = await loadModule();
        mocks.installedBibleKeys = { KJV: '/bibles/KJV.xml' };
        mocks.existingFilePaths.add('/tmp/e/files/001-kjv.xml');
        mocks.bibleKeyByFilePath.set('/tmp/e/files/001-kjv.xml', 'kjv');

        const entries = await resolveBibleXMLImportEntries(
            '/tmp/e',
            toManifest([
                { bibleKey: 'kjv', archivePath: 'files/001-kjv.xml' },
            ]) as any,
        );

        expect(entries).toHaveLength(1);
        expect(entries[0].issue).toBe('duplicate');
    });

    test('reds out only the SECOND of two entries colliding inside one bundle', async () => {
        const { resolveBibleXMLImportEntries } = await loadModule();
        mocks.existingFilePaths.add('/tmp/e/files/001-KJV.xml');
        mocks.existingFilePaths.add('/tmp/e/files/002-kjv.xml');
        mocks.bibleKeyByFilePath.set('/tmp/e/files/001-KJV.xml', 'KJV');
        mocks.bibleKeyByFilePath.set('/tmp/e/files/002-kjv.xml', 'kjv');

        const entries = await resolveBibleXMLImportEntries(
            '/tmp/e',
            toManifest([
                { bibleKey: 'KJV', archivePath: 'files/001-KJV.xml' },
                { bibleKey: 'kjv', archivePath: 'files/002-kjv.xml' },
            ]) as any,
        );

        expect(entries[0].issue).toBeNull();
        expect(entries[1].issue).toBe('duplicate-in-archive');
    });

    test('reds out a file it cannot check, including a lying manifest', async () => {
        const { resolveBibleXMLImportEntries } = await loadModule();
        // Present but holding no readable bible key.
        mocks.existingFilePaths.add('/tmp/e/files/001-A.xml');
        mocks.bibleKeyByFilePath.set('/tmp/e/files/001-A.xml', null);
        // Present, readable, but NOT the key the manifest promised — trusting
        // the manifest here is what would let an import overwrite a bible.
        mocks.existingFilePaths.add('/tmp/e/files/002-B.xml');
        mocks.bibleKeyByFilePath.set('/tmp/e/files/002-B.xml', 'NIV');

        const entries = await resolveBibleXMLImportEntries(
            '/tmp/e',
            toManifest([
                { bibleKey: 'A', archivePath: 'files/001-A.xml' },
                { bibleKey: 'B', archivePath: 'files/002-B.xml' },
                // Named in the manifest but missing from the bundle.
                { bibleKey: 'C', archivePath: 'files/003-C.xml' },
            ]) as any,
        );

        expect(
            entries.map((entry) => {
                return entry.issue;
            }),
        ).toEqual(['unreadable', 'unreadable', 'unreadable']);
    });

    test('refuses an archive path that climbs out of the extract dir', async () => {
        const { resolveBibleXMLImportEntries } = await loadModule();

        await expect(
            resolveBibleXMLImportEntries(
                '/tmp/e',
                toManifest([
                    { bibleKey: 'KJV', archivePath: '../../KJV.xml' },
                ]) as any,
            ),
        ).rejects.toThrow('Invalid archive file path');
    });

    test('imports clean rows and never overwrites an existing bible', async () => {
        const { importBibleXMLEntries } = await loadModule();
        mocks.installedBibleKeys = { NIV: '/bibles/NIV.xml' };

        const { importedBibleKeys, skippedBibleKeys } =
            await importBibleXMLEntries([
                {
                    bibleKey: 'KJV',
                    title: '',
                    fileFullName: 'KJV.xml',
                    archivePath: 'files/001-KJV.xml',
                    extractedFilePath: '/tmp/e/files/001-KJV.xml',
                    issue: null,
                },
                // A red row is never written, even if it is handed over.
                {
                    bibleKey: 'ASV',
                    title: '',
                    fileFullName: 'ASV.xml',
                    archivePath: 'files/002-ASV.xml',
                    extractedFilePath: '/tmp/e/files/002-ASV.xml',
                    issue: 'unreadable',
                },
                // Became installed while the picker sat open — re-checked here.
                {
                    bibleKey: 'niv',
                    title: '',
                    fileFullName: 'niv.xml',
                    archivePath: 'files/003-niv.xml',
                    extractedFilePath: '/tmp/e/files/003-niv.xml',
                    issue: null,
                },
            ]);

        expect(importedBibleKeys).toEqual(['KJV']);
        expect(skippedBibleKeys).toEqual(['ASV', 'niv']);
        expect(mocks.clonedFiles).toEqual([
            {
                source: '/tmp/e/files/001-KJV.xml',
                destination: '/bibles/KJV.xml',
            },
        ]);
    });

    test('skips a key whose destination file is already on disk', async () => {
        const { importBibleXMLEntries } = await loadModule();
        // Not in `getAllXMLFileKeys` — e.g. a file whose key cannot be read —
        // but the name is taken, and this import must not clobber it.
        mocks.existingFilePaths.add('/bibles/KJV.xml');

        const { importedBibleKeys, skippedBibleKeys } =
            await importBibleXMLEntries([
                {
                    bibleKey: 'KJV',
                    title: '',
                    fileFullName: 'KJV.xml',
                    archivePath: 'files/001-KJV.xml',
                    extractedFilePath: '/tmp/e/files/001-KJV.xml',
                    issue: null,
                },
            ]);

        expect(importedBibleKeys).toEqual([]);
        expect(skippedBibleKeys).toEqual(['KJV']);
        expect(mocks.clonedFiles).toEqual([]);
    });
});
