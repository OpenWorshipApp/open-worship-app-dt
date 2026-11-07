import { beforeEach, describe, expect, test, vi } from 'vitest';

// The bible-list bundle is the generic single-item bundle with a config of its
// own; what is worth holding is that config, and that every door hands it,
// with its own arguments, to the shared helper.
const h = vi.hoisted(() => ({
    askFromUrl: vi.fn(),
    checkFullName: vi.fn(),
    create: vi.fn(),
    exportItem: vi.fn(),
    importDropped: vi.fn(),
    importArchive: vi.fn(),
    selectAndImport: vi.fn(),
    getDirSourceSettingName: vi.fn(),
}));

vi.mock('../helper/singleItemArchiveHelpers', () => ({
    askAndImportSingleItemArchiveFromUrl: h.askFromUrl,
    checkIsSingleItemArchiveFileFullName: h.checkFullName,
    createSingleItemArchive: h.create,
    exportSingleItem: h.exportItem,
    importDroppedSingleItemArchive: h.importDropped,
    importSingleItemArchive: h.importArchive,
    selectAndImportSingleItemArchive: h.selectAndImport,
}));
vi.mock('./Bible', () => ({
    default: { getDirSourceSettingName: h.getDirSourceSettingName },
}));

import {
    BIBLE_ARCHIVE_DOT_EXTENSION,
    askAndImportBibleArchiveFromUrl,
    checkIsBibleArchiveFileFullName,
    createBibleArchive,
    exportBible,
    importBibleArchive,
    importDroppedBibleArchive,
    selectAndImportBibleArchive,
} from './bibleArchiveHelpers';

function readConfig() {
    h.checkFullName.mockReturnValueOnce(false);
    checkIsBibleArchiveFileFullName('probe');
    return h.checkFullName.mock.lastCall![1];
}

beforeEach(() => {
    h.checkFullName.mockImplementation((fileFullName: string) =>
        fileFullName.endsWith('.owbible.tar.gz'),
    );
});

describe('bibleArchiveHelpers', () => {
    test('a bible list bundles as .owbible.tar.gz under its own names', () => {
        expect(BIBLE_ARCHIVE_DOT_EXTENSION).toBe('.owbible.tar.gz');
        expect(checkIsBibleArchiveFileFullName('Easter.owbible.tar.gz')).toBe(
            true,
        );
        expect(checkIsBibleArchiveFileFullName('Easter.owb')).toBe(false);
        expect(h.checkFullName).toHaveBeenNthCalledWith(
            1,
            'Easter.owbible.tar.gz',
            expect.anything(),
        );
        expect(readConfig()).toMatchObject({
            itemKind: 'bible',
            dotExtension: '.owbible.tar.gz',
            fallbackName: 'Bible List',
            workDirPrefix: 'owbible',
            exportTitle: 'Export Bible List',
            importTitle: 'Import Bible List',
            urlLabel: 'Bible List Archive URL:',
            itemLabel: 'bible list',
        });
    });

    test('the destination folder is asked for at import time, per page', () => {
        const config = readConfig();
        expect(h.getDirSourceSettingName).not.toHaveBeenCalled();
        // The Presenter's folder, then the Reader's own: never one baked in.
        h.getDirSourceSettingName
            .mockReturnValueOnce('select-dir-bible-present')
            .mockReturnValueOnce('select-dir-bible-read');
        expect(config.getItemDirSettingName()).toBe('select-dir-bible-present');
        expect(config.getItemDirSettingName()).toBe('select-dir-bible-read');
        expect(h.getDirSourceSettingName).toHaveBeenCalledTimes(2);
    });

    test('every door hands its arguments and the one config through, and answers what the bundle helper answers', async () => {
        const config = readConfig();
        h.create.mockResolvedValueOnce('/tmp/Easter.owbible.tar.gz');
        h.create.mockResolvedValueOnce('/tmp/Easter-locked.owbible.tar.gz');
        h.exportItem.mockResolvedValue(true);
        h.importArchive.mockResolvedValue('/bibles/Easter.owb');
        h.selectAndImport.mockResolvedValue(null);
        h.askFromUrl.mockResolvedValue('/bibles/From URL.owb');
        h.importDropped.mockResolvedValue('/bibles/Dropped.owb');

        expect(await createBibleArchive('/bibles/Easter.owb')).toBe(
            '/tmp/Easter.owbible.tar.gz',
        );
        expect(h.create).toHaveBeenLastCalledWith(
            '/bibles/Easter.owb',
            config,
            null,
        );
        expect(await createBibleArchive('/bibles/Easter.owb', 'secret')).toBe(
            '/tmp/Easter-locked.owbible.tar.gz',
        );
        expect(h.create).toHaveBeenLastCalledWith(
            '/bibles/Easter.owb',
            config,
            'secret',
        );

        expect(await exportBible('/bibles/Easter.owb')).toBe(true);
        expect(h.exportItem).toHaveBeenCalledWith('/bibles/Easter.owb', config);

        const archivePath = '/downloads/Easter.owbible.tar.gz';
        expect(await importBibleArchive(archivePath)).toBe(
            '/bibles/Easter.owb',
        );
        expect(h.importArchive).toHaveBeenCalledWith(archivePath, config);

        expect(await selectAndImportBibleArchive()).toBeNull();
        expect(h.selectAndImport).toHaveBeenCalledWith(config);

        expect(await askAndImportBibleArchiveFromUrl()).toBe(
            '/bibles/From URL.owb',
        );
        expect(h.askFromUrl).toHaveBeenCalledWith(config);

        const droppedFile = { name: 'Dropped.owbible.tar.gz' } as any;
        expect(await importDroppedBibleArchive(droppedFile)).toBe(
            '/bibles/Dropped.owb',
        );
        expect(h.importDropped).toHaveBeenCalledWith(droppedFile, config);

        // One config object for every door, so they cannot drift apart.
        for (const mock of [h.exportItem, h.importArchive, h.importDropped]) {
            expect(mock.mock.lastCall![1]).toBe(config);
        }
        expect(h.selectAndImport.mock.lastCall![0]).toBe(config);
        expect(h.askFromUrl.mock.lastCall![0]).toBe(config);
    });
});
