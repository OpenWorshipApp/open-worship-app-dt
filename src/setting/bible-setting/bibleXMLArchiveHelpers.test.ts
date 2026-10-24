import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        files: new Set<string>(),
        installed: {} as Record<string, string>,
        extractedKeys: new Map<string, string | null>(),
        heads: new Map<string, { title: string }>(),
        manifest: null as unknown,
        destination: null as string | null,
        openPath: '/tmp/plain.tar' as string | null,
    },
    mocks: {
        clone: vi.fn(),
        tarCreate: vi.fn(),
        tarExtract: vi.fn(),
        protect: vi.fn(),
        open: vi.fn(),
        writeManifest: vi.fn(),
        readManifest: vi.fn(),
        cleanup: vi.fn(),
        clearCache: vi.fn(),
    },
}));

vi.mock('../../helper/appArchiveHelpers', () => ({
    ARCHIVE_FILES_DIR: 'files',
    ARCHIVE_VERSION: 1,
    BIBLE_XML_ARCHIVE_ITEM_KIND: 'bible-xml',
    MANIFEST_FILE_NAME: 'manifest.json',
    createWorkDir: async () => '/tmp/staging',
    readArchiveManifest: mocks.readManifest,
    safeDeleteDir: mocks.cleanup,
    writeArchiveManifest: mocks.writeManifest,
}));
vi.mock('../../helper/archivePasswordHelpers', () => ({
    openArchiveForReading: mocks.open,
    protectArchiveFile: mocks.protect,
}));
vi.mock('../../server/appHelpers', () => ({
    tarCreate: mocks.tarCreate,
    tarExtract: mocks.tarExtract,
}));
vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: async () => true,
    fsCheckFileExist: async (path: string) => state.files.has(path),
    fsCloneFile: mocks.clone,
    getDownloadPath: () => '/downloads',
    pathBasename: (path: string) => path.split('/').at(-1) ?? '',
    pathJoin: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
}));
vi.mock('./bibleXMLJsonDataHelpers', () => ({
    bibleKeyToXMLFilePath: async (key: string) =>
        state.destination ?? `/bibles/${key}.xml`,
    getAllXMLFileKeys: async () => state.installed,
    getBibleHeadInfoFromFile: async (path: string) =>
        state.heads.get(path) ?? null,
    getBibleKeyFromFile: async (path: string) =>
        state.extractedKeys.get(path) ?? null,
}));
vi.mock('./bibleXMLHelpers', () => ({ clearBibleXMLCache: mocks.clearCache }));

import {
    checkIsBibleXMLArchiveFileFullName,
    createBibleXMLArchive,
    getExportableBibleXMLEntries,
    importBibleXMLEntries,
    openBibleXMLArchive,
    resolveBibleXMLImportEntries,
    toBibleXMLArchiveFileName,
    type BibleXMLArchiveManifestType,
    type BibleXMLImportEntryType,
} from './bibleXMLArchiveHelpers';

function manifest(
    bibles: BibleXMLArchiveManifestType['bibles'] = [],
): BibleXMLArchiveManifestType {
    return {
        version: 1,
        itemKind: 'bible-xml',
        bibles,
    } as BibleXMLArchiveManifestType;
}

function entry(
    bibleKey: string,
    archivePath = `files/${bibleKey}.xml`,
): BibleXMLArchiveManifestType['bibles'][number] {
    return {
        bibleKey,
        title: bibleKey,
        fileFullName: `${bibleKey}.xml`,
        archivePath,
    };
}

beforeEach(() => {
    state.files.clear();
    state.installed = {};
    state.extractedKeys.clear();
    state.heads.clear();
    state.manifest = null;
    state.destination = null;
    state.openPath = '/tmp/plain.tar';
    mocks.clone.mockResolvedValue(true);
    mocks.tarCreate.mockResolvedValue(undefined);
    mocks.tarExtract.mockResolvedValue(undefined);
    mocks.protect.mockResolvedValue('/downloads/protected.owabdata.enc');
    mocks.open.mockImplementation(async () =>
        state.openPath === null ? null : { filePath: state.openPath },
    );
    mocks.writeManifest.mockResolvedValue(undefined);
    mocks.readManifest.mockImplementation(async () => state.manifest);
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.clearCache.mockResolvedValue(undefined);
});

describe('Bible XML archive export', () => {
    test('lists local XML Bibles in key order without parsing their bodies', async () => {
        state.installed = {
            WEB: '/bibles/web-custom.xml',
            KJV: '/bibles/king.xml',
        };
        state.heads.set('/bibles/king.xml', { title: 'King James Version' });
        expect(await getExportableBibleXMLEntries()).toEqual([
            {
                bibleKey: 'KJV',
                title: 'King James Version',
                filePath: '/bibles/king.xml',
            },
            { bibleKey: 'WEB', title: '', filePath: '/bibles/web-custom.xml' },
        ]);
    });

    test('recognizes the bundle name and protected extension', () => {
        expect(
            checkIsBibleXMLArchiveFileFullName('Bibles.owabdata.tar.gz'),
        ).toBe(true);
        expect(checkIsBibleXMLArchiveFileFullName('Bibles.zip')).toBe(false);
        expect(toBibleXMLArchiveFileName('Sunday Bibles')).toBe(
            'Sunday Bibles.owabdata.tar.gz',
        );
        expect(toBibleXMLArchiveFileName('Sunday Bibles', 'secret')).toBe(
            'Sunday Bibles.owabdata.enc',
        );
    });

    test('copies selected files into a bundle with ordered safe names and a manifest', async () => {
        const path = await createBibleXMLArchive([
            {
                bibleKey: 'KJV',
                title: 'King James',
                filePath: '/bibles/odd.xml',
            },
            {
                bibleKey: 'WEB',
                title: 'World English',
                filePath: '/bibles/other.xml',
            },
        ]);
        expect(path).toBe('/downloads/Bible Data.owabdata.tar.gz');
        expect(mocks.clone.mock.calls).toEqual([
            ['/bibles/odd.xml', '/tmp/staging/files/001-KJV.xml'],
            ['/bibles/other.xml', '/tmp/staging/files/002-WEB.xml'],
        ]);
        expect(mocks.writeManifest.mock.calls[0][1]).toEqual(
            manifest([
                { ...entry('KJV', 'files/001-KJV.xml'), title: 'King James' },
                {
                    ...entry('WEB', 'files/002-WEB.xml'),
                    title: 'World English',
                },
            ]),
        );
        expect(mocks.tarCreate).toHaveBeenCalledWith(
            '/tmp/staging',
            path,
            ['manifest.json', 'files'],
            true,
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/staging');
    });

    test('protects the staged plain archive and cleans it even if tar fails', async () => {
        expect(
            await createBibleXMLArchive(
                [{ bibleKey: 'KJV', title: '', filePath: '/bibles/king.xml' }],
                'secret',
            ),
        ).toBe('/downloads/protected.owabdata.enc');
        expect(mocks.tarCreate.mock.calls[0][1]).toContain('/tmp/staging/');
        expect(mocks.protect).toHaveBeenCalledWith(
            mocks.tarCreate.mock.calls[0][1],
            '/downloads/Bible Data.owabdata.enc',
            'secret',
        );
        mocks.tarCreate.mockRejectedValue(new Error('tar failed'));
        await expect(createBibleXMLArchive([])).rejects.toThrow('tar failed');
        expect(mocks.cleanup).toHaveBeenCalledTimes(2);
    });
});

describe('Bible XML archive import', () => {
    test('opens once and validates the manifest before showing any rows', async () => {
        state.manifest = manifest([entry('KJV')]);
        expect(
            await openBibleXMLArchive(
                '/downloads/bibles.tar',
                '/tmp/extract',
                'Import',
            ),
        ).toEqual(manifest([entry('KJV')]));
        expect(mocks.tarExtract).toHaveBeenCalledWith(
            '/tmp/plain.tar',
            '/tmp/extract',
        );
        state.openPath = null;
        expect(
            await openBibleXMLArchive(
                '/downloads/missing',
                '/tmp/extract',
                'Import',
            ),
        ).toBeNull();
        expect(mocks.tarExtract).toHaveBeenCalledTimes(1);
    });

    test.each([
        [null, 'Invalid bible data archive manifest'],
        [
            { version: 2, itemKind: 'bible-xml', bibles: [] },
            'Invalid bible data archive manifest',
        ],
        [{ version: 1, itemKind: 'other', bibles: [] }, 'not bible data'],
        [
            {
                version: 1,
                itemKind: 'bible-xml',
                bibles: [{ title: 'No key' }],
            },
            'Invalid bible data archive entry',
        ],
    ])('rejects invalid manifest %j', async (value, message) => {
        state.manifest = value;
        await expect(
            openBibleXMLArchive('/archive', '/tmp/extract', 'Import'),
        ).rejects.toThrow(message);
    });

    test('derives keys from extracted files and marks collisions and unreadable rows', async () => {
        state.installed = { KJV: '/bibles/king.xml' };
        const bibles = [
            entry('kjv'),
            entry('WEB'),
            entry('web', 'files/another.xml'),
            entry('BAD'),
        ];
        for (const bible of bibles)
            state.files.add(`/tmp/extract/${bible.archivePath}`);
        state.extractedKeys.set('/tmp/extract/files/kjv.xml', 'KJV');
        state.extractedKeys.set('/tmp/extract/files/WEB.xml', 'WEB');
        state.extractedKeys.set('/tmp/extract/files/another.xml', 'web');
        state.extractedKeys.set('/tmp/extract/files/BAD.xml', 'OTHER');
        const result = await resolveBibleXMLImportEntries(
            '/tmp/extract',
            manifest(bibles),
        );
        expect(
            result.map(({ bibleKey, issue }) => ({ bibleKey, issue })),
        ).toEqual([
            { bibleKey: 'KJV', issue: 'duplicate' },
            { bibleKey: 'WEB', issue: null },
            { bibleKey: 'web', issue: 'duplicate-in-archive' },
            { bibleKey: 'BAD', issue: 'unreadable' },
        ]);
    });

    test.each(['../bibles/KJV.xml', 'files/..\\KJV.xml', ''])(
        'refuses an unsafe extracted path %j',
        async (archivePath) => {
            await expect(
                resolveBibleXMLImportEntries(
                    '/tmp/extract',
                    manifest([entry('KJV', archivePath)]),
                ),
            ).rejects.toThrow('Invalid archive file path');
        },
    );

    test('rechecks the destination before each copy and clears only imported keys', async () => {
        state.installed = { KJV: '/bibles/king.xml' };
        state.files.add('/bibles/WEB.xml');
        const entries = ['KJV', 'WEB', 'NEW', 'BAD'].map((key) => ({
            ...entry(key),
            extractedFilePath: `/tmp/extract/files/${key}.xml`,
            issue: key === 'BAD' ? 'unreadable' : null,
        })) as BibleXMLImportEntryType[];
        expect(await importBibleXMLEntries(entries)).toEqual({
            importedBibleKeys: ['NEW'],
            skippedBibleKeys: ['KJV', 'WEB', 'BAD'],
        });
        expect(mocks.clone).toHaveBeenCalledWith(
            '/tmp/extract/files/NEW.xml',
            '/bibles/NEW.xml',
        );
        expect(mocks.clone).toHaveBeenCalledTimes(1);
        expect(mocks.clearCache).toHaveBeenCalledWith('NEW');
    });
});
