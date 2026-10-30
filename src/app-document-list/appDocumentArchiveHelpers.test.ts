import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    askAndImportSingleItemArchiveFromUrlMock: vi.fn(),
    checkIsSingleItemArchiveFileFullNameMock: vi.fn(),
    createSingleItemArchiveMock: vi.fn(),
    exportSingleItemMock: vi.fn(),
    importDroppedSingleItemArchiveMock: vi.fn(),
    importSingleItemArchiveMock: vi.fn(),
    selectAndImportSingleItemArchiveMock: vi.fn(),
}));

vi.mock('../helper/singleItemArchiveHelpers', () => ({
    askAndImportSingleItemArchiveFromUrl:
        mocks.askAndImportSingleItemArchiveFromUrlMock,
    checkIsSingleItemArchiveFileFullName:
        mocks.checkIsSingleItemArchiveFileFullNameMock,
    createSingleItemArchive: mocks.createSingleItemArchiveMock,
    exportSingleItem: mocks.exportSingleItemMock,
    importDroppedSingleItemArchive: mocks.importDroppedSingleItemArchiveMock,
    importSingleItemArchive: mocks.importSingleItemArchiveMock,
    selectAndImportSingleItemArchive:
        mocks.selectAndImportSingleItemArchiveMock,
}));

import type { DroppedFileType } from '../others/droppingFileHelpers';
import {
    APP_DOCUMENT_ARCHIVE_DOT_EXTENSION,
    askAndImportAppDocumentArchiveFromUrl,
    checkIsAppDocumentArchiveFileFullName,
    createAppDocumentArchive,
    exportAppDocument,
    importAppDocumentArchive,
    importDroppedAppDocumentArchive,
    selectAndImportAppDocumentArchive,
} from './appDocumentArchiveHelpers';

const CONFIG = {
    itemKind: 'document',
    dotExtension: '.owadoc.tar.gz',
    fallbackName: 'Document',
    workDirPrefix: 'owadoc',
    exportTitle: 'Export Document',
    importTitle: 'Import Document',
    urlLabel: 'Document Archive URL:',
    itemLabel: 'document',
};

beforeEach(() => {
    for (const mock of Object.values(mocks)) {
        mock.mockReturnValue('answer');
    }
});

describe('appDocumentArchiveHelpers', () => {
    test('a document bundle is a .owadoc.tar.gz', () => {
        expect(APP_DOCUMENT_ARCHIVE_DOT_EXTENSION).toBe('.owadoc.tar.gz');
    });

    test('every call is the generic bundle, configured for documents', () => {
        const droppedFile = { name: 'a.owadoc.tar.gz' } as DroppedFileType;

        expect(checkIsAppDocumentArchiveFileFullName('a.owadoc.tar.gz')).toBe(
            'answer',
        );
        expect(createAppDocumentArchive('/docs/a.ows')).toBe('answer');
        expect(createAppDocumentArchive('/docs/a.ows', 'secret')).toBe(
            'answer',
        );
        expect(exportAppDocument('/docs/a.ows')).toBe('answer');
        expect(importAppDocumentArchive('/in/a.owadoc.tar.gz')).toBe('answer');
        expect(selectAndImportAppDocumentArchive()).toBe('answer');
        expect(askAndImportAppDocumentArchiveFromUrl()).toBe('answer');
        expect(importDroppedAppDocumentArchive(droppedFile)).toBe('answer');

        expect(
            mocks.checkIsSingleItemArchiveFileFullNameMock,
        ).toHaveBeenCalledWith('a.owadoc.tar.gz', CONFIG);
        expect(mocks.createSingleItemArchiveMock.mock.calls).toEqual([
            ['/docs/a.ows', CONFIG, null],
            ['/docs/a.ows', CONFIG, 'secret'],
        ]);
        expect(mocks.exportSingleItemMock).toHaveBeenCalledWith(
            '/docs/a.ows',
            CONFIG,
        );
        expect(mocks.importSingleItemArchiveMock).toHaveBeenCalledWith(
            '/in/a.owadoc.tar.gz',
            CONFIG,
        );
        expect(mocks.selectAndImportSingleItemArchiveMock).toHaveBeenCalledWith(
            CONFIG,
        );
        expect(
            mocks.askAndImportSingleItemArchiveFromUrlMock,
        ).toHaveBeenCalledWith(CONFIG);
        expect(mocks.importDroppedSingleItemArchiveMock).toHaveBeenCalledWith(
            droppedFile,
            CONFIG,
        );
    });
});
