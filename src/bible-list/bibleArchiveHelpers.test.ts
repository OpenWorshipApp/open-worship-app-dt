import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    askAndImportSingleItemArchiveFromUrl: vi.fn(),
    checkIsSingleItemArchiveFileFullName: vi.fn(),
    createSingleItemArchive: vi.fn(),
    exportSingleItem: vi.fn(),
    importDroppedSingleItemArchive: vi.fn(),
    importSingleItemArchive: vi.fn(),
    selectAndImportSingleItemArchive: vi.fn(),
    getDirSourceSettingName: vi.fn(),
}));

// The shared bundle flow is tested on its own; here only the config a bible
// list hands it matters.
vi.mock('../helper/singleItemArchiveHelpers', () => ({
    askAndImportSingleItemArchiveFromUrl:
        h.askAndImportSingleItemArchiveFromUrl,
    checkIsSingleItemArchiveFileFullName:
        h.checkIsSingleItemArchiveFileFullName,
    createSingleItemArchive: h.createSingleItemArchive,
    exportSingleItem: h.exportSingleItem,
    importDroppedSingleItemArchive: h.importDroppedSingleItemArchive,
    importSingleItemArchive: h.importSingleItemArchive,
    selectAndImportSingleItemArchive: h.selectAndImportSingleItemArchive,
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

function getConfig() {
    createBibleArchive('/bibles/Easter.owb');
    return h.createSingleItemArchive.mock.calls.at(-1)![1];
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('a bible list as a bundle', () => {
    test('is a .owbible.tar.gz of the bible kind', async () => {
        expect(BIBLE_ARCHIVE_DOT_EXTENSION).toBe('.owbible.tar.gz');
        h.createSingleItemArchive.mockResolvedValue(
            '/downloads/Easter.owbible.tar.gz',
        );
        expect(await createBibleArchive('/bibles/Easter.owb')).toBe(
            '/downloads/Easter.owbible.tar.gz',
        );
        const [filePath, config, password] =
            h.createSingleItemArchive.mock.calls[0];
        expect(filePath).toBe('/bibles/Easter.owb');
        expect(password).toBeNull();
        expect(config).toMatchObject({
            itemKind: 'bible',
            dotExtension: '.owbible.tar.gz',
            fallbackName: 'Bible List',
            workDirPrefix: 'owbible',
            exportTitle: 'Export Bible List',
            importTitle: 'Import Bible List',
            urlLabel: 'Bible List Archive URL:',
            itemLabel: 'bible list',
        });
        createBibleArchive('/bibles/Easter.owb', 'secret');
        expect(h.createSingleItemArchive.mock.calls[1][2]).toBe('secret');
    });

    test('is imported into the folder of the page asking, read at import time', () => {
        const config = getConfig();
        h.getDirSourceSettingName.mockReturnValue('selected-dir-bible-read');
        expect(config.getItemDirSettingName()).toBe('selected-dir-bible-read');
        h.getDirSourceSettingName.mockReturnValue(
            'selected-dir-bible-presenter',
        );
        expect(config.getItemDirSettingName()).toBe(
            'selected-dir-bible-presenter',
        );
    });

    test('every entry point hands that one config to the shared flow', () => {
        const config = getConfig();
        h.checkIsSingleItemArchiveFileFullName.mockReturnValue(true);
        expect(checkIsBibleArchiveFileFullName('Easter.owbible.tar.gz')).toBe(
            true,
        );
        expect(h.checkIsSingleItemArchiveFileFullName).toHaveBeenCalledWith(
            'Easter.owbible.tar.gz',
            config,
        );
        exportBible('/bibles/Easter.owb');
        expect(h.exportSingleItem).toHaveBeenCalledWith(
            '/bibles/Easter.owb',
            config,
        );
        importBibleArchive('/in/Easter.owbible.tar.gz');
        expect(h.importSingleItemArchive).toHaveBeenCalledWith(
            '/in/Easter.owbible.tar.gz',
            config,
        );
        selectAndImportBibleArchive();
        expect(h.selectAndImportSingleItemArchive).toHaveBeenCalledWith(config);
        askAndImportBibleArchiveFromUrl();
        expect(h.askAndImportSingleItemArchiveFromUrl).toHaveBeenCalledWith(
            config,
        );
        const dropped = { name: 'Easter.owbible.tar.gz' } as any;
        importDroppedBibleArchive(dropped);
        expect(h.importDroppedSingleItemArchive).toHaveBeenCalledWith(
            dropped,
            config,
        );
    });
});
